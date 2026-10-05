import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole, PlatformType } from '@sm-crm/shared';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveAllowedOrgIds(filterOrgId: string | undefined, user: AuthenticatedUser): Promise<string[]> {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (filterOrgId) return [filterOrgId];
      const orgs = await this.prisma.organization.findMany({
        where: { type: 'CLIENT' },
        select: { id: true },
      });
      return orgs.map((o) => o.id);
    }

    if (user.role === UserRole.AGENCY_ACCOUNT_MANAGER) {
      const assignments = await this.prisma.clientAssignment.findMany({
        where: { agencyUserId: user.id },
        select: { clientId: true },
      });
      const assignedIds = assignments.map((a) => a.clientId);

      if (filterOrgId) {
        if (!assignedIds.includes(filterOrgId)) {
          throw new ForbiddenException('Not assigned to this client organization');
        }
        return [filterOrgId];
      }
      return assignedIds;
    }

    // Client Admin or Client Sales User
    return [user.organizationId];
  }

  async getOverview(filter: AnalyticsFilterDto, user: AuthenticatedUser) {
    const orgIds = await this.resolveAllowedOrgIds(filter.organizationId, user);
    if (orgIds.length === 0) {
      return this.emptyOverviewResponse();
    }

    const startDate = filter.startDate ? new Date(filter.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = filter.endDate ? new Date(filter.endDate) : new Date();

    // 1. Aggregate Ad Metrics from campaigns
    const campaigns = await this.prisma.campaign.findMany({
      where: {
        organizationId: { in: orgIds },
        ...(filter.platform ? { platform: filter.platform } : {}),
      },
      include: {
        metrics: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalReach = 0;

    const platformSpendMap: Record<string, { spend: number; impressions: number; clicks: number }> = {
      [PlatformType.META]: { spend: 0, impressions: 0, clicks: 0 },
      [PlatformType.GOOGLE]: { spend: 0, impressions: 0, clicks: 0 },
      [PlatformType.LINKEDIN]: { spend: 0, impressions: 0, clicks: 0 },
      [PlatformType.WEBSITE]: { spend: 0, impressions: 0, clicks: 0 },
      [PlatformType.WHATSAPP]: { spend: 0, impressions: 0, clicks: 0 },
    };

    campaigns.forEach((c) => {
      c.metrics.forEach((m) => {
        const s = Number(m.spend);
        totalSpend += s;
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalReach += m.reach;

        if (platformSpendMap[c.platform]) {
          platformSpendMap[c.platform].spend += s;
          platformSpendMap[c.platform].impressions += m.impressions;
          platformSpendMap[c.platform].clicks += m.clicks;
        }
      });
    });

    // 2. Aggregate CRM Leads
    const leads = await this.prisma.lead.findMany({
      where: {
        organizationId: { in: orgIds },
        submittedAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(filter.platform ? { sourcePlatform: filter.platform } : {}),
      },
      include: {
        conversions: true,
      },
    });

    const totalLeads = leads.length;
    let totalConversions = 0;
    let totalRevenue = 0;

    const platformLeadsMap: Record<string, { leads: number; conversions: number; revenue: number }> = {
      [PlatformType.META]: { leads: 0, conversions: 0, revenue: 0 },
      [PlatformType.GOOGLE]: { leads: 0, conversions: 0, revenue: 0 },
      [PlatformType.LINKEDIN]: { leads: 0, conversions: 0, revenue: 0 },
      [PlatformType.WEBSITE]: { leads: 0, conversions: 0, revenue: 0 },
      [PlatformType.WHATSAPP]: { leads: 0, conversions: 0, revenue: 0 },
    };

    leads.forEach((l) => {
      const p = l.sourcePlatform;
      if (platformLeadsMap[p]) {
        platformLeadsMap[p].leads += 1;
      }

      if (l.conversions && l.conversions.length > 0) {
        totalConversions += l.conversions.length;
        if (platformLeadsMap[p]) {
          platformLeadsMap[p].conversions += l.conversions.length;
        }

        l.conversions.forEach((conv) => {
          const val = Number(conv.value);
          totalRevenue += val;
          if (platformLeadsMap[p]) {
            platformLeadsMap[p].revenue += val;
          }
        });
      }
    });

    // 3. Derived KPIs
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0;
    const roas = totalSpend > 0 ? totalRevenue / totalSpend : totalRevenue > 0 ? 999 : 0;

    // 4. Platform Breakdowns
    const platformBreakdown = Object.values(PlatformType).map((platform) => {
      const spendData = platformSpendMap[platform] || { spend: 0, impressions: 0, clicks: 0 };
      const leadData = platformLeadsMap[platform] || { leads: 0, conversions: 0, revenue: 0 };
      const pCpl = leadData.leads > 0 ? spendData.spend / leadData.leads : 0;
      const pRoas = spendData.spend > 0 ? leadData.revenue / spendData.spend : leadData.revenue > 0 ? 100 : 0;

      return {
        platform,
        spend: Math.round(spendData.spend),
        impressions: spendData.impressions,
        clicks: spendData.clicks,
        leads: leadData.leads,
        conversions: leadData.conversions,
        revenue: Math.round(leadData.revenue),
        cpl: Math.round(pCpl),
        roas: Number(pRoas.toFixed(2)),
      };
    });

    // 5. Daily Trend Generation (Grouping by date for charts)
    const dailyMap = new Map<string, { date: string; spend: number; leads: number; conversions: number; revenue: number }>();
    
    // Initialize past 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      dailyMap.set(dateStr, { date: dateStr, spend: 0, leads: 0, conversions: 0, revenue: 0 });
    }

    campaigns.forEach((c) => {
      c.metrics.forEach((m) => {
        const dateStr = m.date.toISOString().split('T')[0];
        const cur = dailyMap.get(dateStr);
        if (cur) {
          cur.spend += Number(m.spend);
        }
      });
    });

    leads.forEach((l) => {
      const dateStr = l.submittedAt.toISOString().split('T')[0];
      const cur = dailyMap.get(dateStr);
      if (cur) {
        cur.leads += 1;
        l.conversions.forEach((conv) => {
          cur.conversions += 1;
          cur.revenue += Number(conv.value);
        });
      }
    });

    const dailyTrend = Array.from(dailyMap.values()).map((item) => ({
      ...item,
      spend: Math.round(item.spend),
      revenue: Math.round(item.revenue),
    }));

    return {
      kpis: {
        totalSpend: Math.round(totalSpend),
        totalImpressions,
        totalClicks,
        totalReach,
        ctr: Number(ctr.toFixed(2)),
        totalLeads,
        cpl: Math.round(cpl),
        totalConversions,
        conversionRate: Number(conversionRate.toFixed(2)),
        totalRevenue: Math.round(totalRevenue),
        roas: Number(roas.toFixed(2)),
      },
      platformBreakdown,
      dailyTrend,
    };
  }

  async getCampaigns(filter: AnalyticsFilterDto, user: AuthenticatedUser) {
    const orgIds = await this.resolveAllowedOrgIds(filter.organizationId, user);
    if (orgIds.length === 0) return [];

    const campaigns = await this.prisma.campaign.findMany({
      where: {
        organizationId: { in: orgIds },
        ...(filter.platform ? { platform: filter.platform } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        metrics: true,
        adSets: {
          include: {
            ads: {
              include: {
                metrics: true,
                leads: { select: { id: true, status: true, conversions: true } },
              },
            },
            metrics: true,
            leads: { select: { id: true, status: true, conversions: true } },
          },
        },
        leads: {
          select: {
            id: true,
            status: true,
            conversions: { select: { id: true, value: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns.map((campaign) => {
      const spend = campaign.metrics.reduce((acc, m) => acc + Number(m.spend), 0);
      const impressions = campaign.metrics.reduce((acc, m) => acc + m.impressions, 0);
      const clicks = campaign.metrics.reduce((acc, m) => acc + m.clicks, 0);
      const totalLeads = campaign.leads.length;
      
      let totalRevenue = 0;
      let conversionsCount = 0;
      campaign.leads.forEach((l) => {
        if (l.conversions && l.conversions.length > 0) {
          conversionsCount += l.conversions.length;
          l.conversions.forEach((conv) => {
            totalRevenue += Number(conv.value);
          });
        }
      });

      const cpl = totalLeads > 0 ? spend / totalLeads : 0;
      const roas = spend > 0 ? totalRevenue / spend : totalRevenue > 0 ? 100 : 0;

      return {
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        organizationName: campaign.organization.name,
        status: campaign.status,
        spend: Math.round(spend),
        impressions,
        clicks,
        leadsCount: totalLeads,
        conversionsCount,
        revenue: Math.round(totalRevenue),
        cpl: Math.round(cpl),
        roas: Number(roas.toFixed(2)),
        adSets: campaign.adSets.map((as) => {
          const asSpend = as.metrics.reduce((acc, m) => acc + Number(m.spend), 0);
          const asLeads = as.leads.length;
          return {
            id: as.id,
            name: as.name,
            spend: Math.round(asSpend),
            leadsCount: asLeads,
            adsCount: as.ads.length,
          };
        }),
      };
    });
  }

  private emptyOverviewResponse() {
    return {
      kpis: {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalReach: 0,
        ctr: 0,
        totalLeads: 0,
        cpl: 0,
        totalConversions: 0,
        conversionRate: 0,
        totalRevenue: 0,
        roas: 0,
      },
      platformBreakdown: [],
      dailyTrend: [],
    };
  }
}
