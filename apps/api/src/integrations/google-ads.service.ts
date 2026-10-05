import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole, PlatformType, IntegrationStatus } from '@sm-crm/shared';

export interface GoogleCustomerAccount {
  customerId: string;
  descriptiveName: string;
  isManager: boolean;
  currencyCode?: string;
  timeZone?: string;
  managerCustomerId?: string;
}

export interface GoogleAccountReport {
  customerId: string;
  formattedCustomerId: string;
  accountName: string;
  currencyCode: string;
  timeZone: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversionValue: number;
  costPerConversion: number;
  roas: number;
}

export interface GoogleCampaignReportItem {
  campaignId: string;
  campaignName: string;
  channelType: string; // SEARCH, PERFORMANCE_MAX, DISPLAY, SHOPPING, DEMAND_GEN, VIDEO, APP, LOCAL_SERVICES
  status: string;
  budget: number;
  biddingStrategy: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversionRate: number;
  costPerConversion: number;
  conversionValue: number;
  roas: number;
  customerId: string;
}

export interface GoogleAdGroupReportItem {
  adGroupId: string;
  adGroupName: string;
  campaignId: string;
  campaignName: string;
  type: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
}

export interface GoogleAdReportItem {
  adId: string;
  adName: string;
  adType: string;
  status: string;
  adGroupId: string;
  campaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
}

export interface GoogleKeywordReportItem {
  criterionId: string;
  keywordText: string;
  matchType: string; // EXACT, PHRASE, BROAD
  status: string;
  adGroupId?: string;
  campaignId?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
}

export interface GoogleSearchTermReportItem {
  searchTerm: string;
  status: string;
  campaignId?: string;
  adGroupId?: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  conversionValue: number;
}

export interface GoogleAssetGroupReportItem {
  assetGroupId: string;
  assetGroupName: string;
  campaignId: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export interface GoogleShoppingReportItem {
  productItemId: string;
  productTitle: string;
  productTypeL1: string;
  campaignId: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

export interface GoogleSegmentationReportItem {
  campaignId: string;
  device: string; // DESKTOP, MOBILE, TABLET, OTHER
  network: string; // SEARCH, CONTENT, YOUTUBE, MIXED
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
}

@Injectable()
export class GoogleAdsService {
  private readonly logger = new Logger(GoogleAdsService.name);
  // Current stable Google Ads API version in 2026 is v25 (with env override if configured)
  private readonly apiVersion = process.env.GOOGLE_ADS_API_VERSION || 'v25';
  private readonly baseUrl = 'https://googleads.googleapis.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Format customer ID into standard 10-digit unhyphenated string
   */
  normalizeCustomerId(customerId: string): string {
    return customerId.replace(/[^0-9]/g, '');
  }

  /**
   * Format customer ID into standard display format: XXX-XXX-XXXX
   */
  formatCustomerId(customerId: string): string {
    const clean = this.normalizeCustomerId(customerId);
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return customerId;
  }

  /**
   * Return the current active Google Ads API version
   */
  getApiVersion(): string {
    return this.apiVersion;
  }

  /**
   * Generate Google OAuth Authorization URL for Google Ads API (Offline Access)
   */
  getAuthorizationUrl(organizationId: string, redirectUri: string): { platform: string; url: string } {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('GOOGLE_OAUTH_CLIENT_ID is not configured in environment variables');
    }

    const scopes = [
      'https://www.googleapis.com/auth/adwords',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const state = Buffer.from(
      JSON.stringify({
        orgId: organizationId,
        timestamp: Date.now(),
      }),
    ).toString('base64');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&response_type=code&scope=${encodeURIComponent(
      scopes,
    )}&access_type=offline&prompt=consent&state=${state}`;

    return { platform: 'GOOGLE', url };
  }

  /**
   * Exchange OAuth code for Google Access and Refresh Tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<any> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET is missing');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      this.logger.error(`Google token exchange error: ${JSON.stringify(data)}`);
      throw new BadRequestException(data.error_description || data.error || 'Failed to exchange Google OAuth code');
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
      scope: data.scope,
    };
  }

  /**
   * Refresh expired Google Access Token using Refresh Token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams({
      client_id: clientId || '',
      client_secret: clientSecret || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(`Failed to refresh Google access token: ${data.error_description || data.error}`);
    }

    return data.access_token;
  }

  /**
   * Helper to execute Google Ads searchStream queries with login-customer-id support
   */
  private async executeSearchStream(
    customerId: string,
    query: string,
    accessToken?: string,
    managerCustomerId?: string,
    developerToken?: string,
  ): Promise<any[]> {
    const cleanCustomerId = this.normalizeCustomerId(customerId);
    const devToken = developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'TEST_DEV_TOKEN';

    const headers: Record<string, string> = {
      'developer-token': devToken,
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    if (managerCustomerId) {
      headers['login-customer-id'] = this.normalizeCustomerId(managerCustomerId);
    }

    const url = `${this.baseUrl}/${this.apiVersion}/customers/${cleanCustomerId}/googleAds:searchStream`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        this.logger.debug(`Google Ads API searchStream raw response: ${JSON.stringify(data?.error || data)}`);
        return [];
      }

      const results: any[] = [];
      const batches = Array.isArray(data) ? data : [data];
      for (const batch of batches) {
        if (batch.results && Array.isArray(batch.results)) {
          results.push(...batch.results);
        }
      }
      return results;
    } catch (err: any) {
      this.logger.warn(`Google Ads searchStream network error: ${err.message}`);
      return [];
    }
  }

  /**
   * Discover Accessible Google Ads Accounts (including MCC and client accounts)
   */
  async listAccessibleCustomers(accessToken: string, developerToken?: string): Promise<string[]> {
    const devToken = developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || process.env.GOOGLE_DEVELOPER_TOKEN || 'TEST_DEV_TOKEN';
    const url = `${this.baseUrl}/${this.apiVersion}/customers:listAccessibleCustomers`;

    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': devToken,
        },
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        this.logger.warn(`Google Ads API listAccessibleCustomers error: ${JSON.stringify(data?.error || data)}`);
        return [];
      }

      return (data.resourceNames || []).map((rn: string) => rn.replace('customers/', ''));
    } catch (err: any) {
      this.logger.warn(`listAccessibleCustomers network error: ${err.message}`);
      return [];
    }
  }

  /**
   * Fetch Manager Account Hierarchy and Client Customers
   */
  async getAccountHierarchy(
    managerCustomerId: string,
    accessToken?: string,
    developerToken?: string,
  ): Promise<GoogleCustomerAccount[]> {
    const cleanManagerId = this.normalizeCustomerId(managerCustomerId);
    const query = `
      SELECT
        customer_client.client_customer,
        customer_client.level,
        customer_client.manager,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.id
      FROM customer_client
      WHERE customer_client.level <= 1
    `;

    const rawRows = await this.executeSearchStream(cleanManagerId, query, accessToken, cleanManagerId, developerToken);
    const accounts: GoogleCustomerAccount[] = [];

    for (const row of rawRows) {
      const client = row.customerClient;
      if (client) {
        accounts.push({
          customerId: String(client.id),
          descriptiveName: client.descriptiveName || `Account #${client.id}`,
          isManager: Boolean(client.manager),
          currencyCode: client.currencyCode || 'INR',
          timeZone: client.timeZone || 'Asia/Kolkata',
          managerCustomerId: cleanManagerId,
        });
      }
    }

    return accounts;
  }

  /**
   * 1. ACCOUNT REPORTING
   * Fetches customer account info, currency, timezone, status, spend, conversions, ROAS
   */
  async fetchAccountReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    developerToken?: string,
  ): Promise<GoogleAccountReport> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'WHERE segments.date DURING LAST_30_DAYS';

    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone,
        customer.status,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM customer
      ${dateClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      let costMicros = 0;
      let impressions = 0;
      let clicks = 0;
      let conversions = 0;
      let conversionValue = 0;
      let cust = rawRows[0]?.customer || {};

      for (const row of rawRows) {
        const m = row.metrics || {};
        costMicros += Number(m.costMicros || 0);
        impressions += Number(m.impressions || 0);
        clicks += Number(m.clicks || 0);
        conversions += Number(m.conversions || 0);
        conversionValue += Number(m.conversionsValue || 0);
      }

      const spend = costMicros / 1000000;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const costPerConversion = conversions > 0 ? spend / conversions : 0;
      const roas = spend > 0 ? conversionValue / spend : 0;

      return {
        customerId: cleanId,
        formattedCustomerId: this.formatCustomerId(cleanId),
        accountName: cust.descriptiveName || `Google Ads Account #${cleanId}`,
        currencyCode: cust.currencyCode || 'INR',
        timeZone: cust.timeZone || 'Asia/Kolkata',
        status: cust.status || 'ENABLED',
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        ctr: Math.round(ctr * 100) / 100,
        cpc: Math.round(cpc * 100) / 100,
        cpm: Math.round(cpm * 100) / 100,
        conversions: Math.round(conversions),
        conversionValue: Math.round(conversionValue * 100) / 100,
        costPerConversion: Math.round(costPerConversion * 100) / 100,
        roas: Math.round(roas * 100) / 100,
      };
    }

    // No metrics recorded for this period/account
    return {
      customerId: cleanId,
      formattedCustomerId: this.formatCustomerId(cleanId),
      accountName: `Google Ads Account #${cleanId}`,
      currencyCode: 'INR',
      timeZone: 'Asia/Kolkata',
      status: 'ENABLED',
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      conversions: 0,
      conversionValue: 0,
      costPerConversion: 0,
      roas: 0,
    };
  }

  /**
   * 2. CAMPAIGN REPORTING (Search, PMax, Display, Shopping, Demand Gen, Video, App, Local)
   */
  async fetchCampaignsReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    channelType?: string,
    developerToken?: string,
  ): Promise<GoogleCampaignReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const channelClause = channelType && channelType !== 'ALL' ? `AND campaign.advertising_channel_type = '${channelType}'` : '';

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.advertising_channel_type,
        campaign.status,
        campaign.bidding_strategy_type,
        campaign_budget.amount_micros,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE ${dateClause} ${channelClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      const items: GoogleCampaignReportItem[] = [];
      for (const row of rawRows) {
        const c = row.campaign || {};
        const m = row.metrics || {};
        const b = row.campaignBudget || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);
        const budget = Number(b.amountMicros || 0) / 1000000;

        items.push({
          campaignId: String(c.id || ''),
          campaignName: c.name || 'Google Campaign',
          channelType: c.advertisingChannelType || 'SEARCH',
          status: c.status || 'ENABLED',
          budget,
          biddingStrategy: c.biddingStrategyType || 'MAXIMIZE_CONVERSIONS',
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
          cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          cpm: impressions > 0 ? Math.round((spend / impressions) * 1000 * 100) / 100 : 0,
          conversions,
          conversionRate: clicks > 0 ? Math.round((conversions / clicks) * 10000) / 100 : 0,
          costPerConversion: conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0,
          conversionValue: Math.round(conversionValue * 100) / 100,
          roas: spend > 0 ? Math.round((conversionValue / spend) * 100) / 100 : 0,
          customerId: cleanId,
        });
      }
      return items;
    }

    return [];
  }

  /**
   * Backward-compatible alias for fetchCampaignMetrics
   */
  async fetchCampaignMetrics(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    developerToken?: string,
  ): Promise<any[]> {
    return this.fetchCampaignsReport(clientCustomerId, accessToken, managerCustomerId, undefined, undefined, undefined, developerToken);
  }

  /**
   * 3. AD GROUPS REPORTING
   */
  async fetchAdGroupsReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
    developerToken?: string,
  ): Promise<GoogleAdGroupReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const campClause = campaignId ? `AND campaign.id = '${campaignId}'` : '';

    const query = `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        ad_group.type,
        campaign.id,
        campaign.name,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group
      WHERE ${dateClause} ${campClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      return rawRows.map((row) => {
        const ag = row.adGroup || {};
        const camp = row.campaign || {};
        const m = row.metrics || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);

        return {
          adGroupId: String(ag.id || ''),
          adGroupName: ag.name || 'Ad Group',
          campaignId: String(camp.id || ''),
          campaignName: camp.name || 'Campaign',
          type: ag.type || 'SEARCH_STANDARD',
          status: ag.status || 'ENABLED',
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
          cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          conversions,
          conversionValue: Math.round(conversionValue * 100) / 100,
          roas: spend > 0 ? Math.round((conversionValue / spend) * 100) / 100 : 0,
        };
      });
    }

    return [];
  }

  /**
   * 4. ADS & ASSETS REPORTING
   */
  async fetchAdsReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    adGroupId?: string,
    developerToken?: string,
  ): Promise<GoogleAdReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const agClause = adGroupId ? `AND ad_group.id = '${adGroupId}'` : '';

    const query = `
      SELECT
        ad_group_ad.ad.id,
        ad_group_ad.ad.name,
        ad_group_ad.ad.type,
        ad_group_ad.status,
        ad_group.id,
        campaign.id,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM ad_group_ad
      WHERE ${dateClause} ${agClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      return rawRows.map((row) => {
        const ad = row.adGroupAd?.ad || {};
        const aga = row.adGroupAd || {};
        const ag = row.adGroup || {};
        const camp = row.campaign || {};
        const m = row.metrics || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);

        return {
          adId: String(ad.id || ''),
          adName: ad.name || `Ad #${ad.id}`,
          adType: ad.type || 'RESPONSIVE_SEARCH_AD',
          status: aga.status || 'ENABLED',
          adGroupId: String(ag.id || ''),
          campaignId: String(camp.id || ''),
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
          cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          conversions,
          conversionValue: Math.round(conversionValue * 100) / 100,
        };
      });
    }

    return [];
  }

  /**
   * 5. SEARCH KEYWORDS REPORTING (keyword_view)
   */
  async fetchKeywordsReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
    developerToken?: string,
  ): Promise<GoogleKeywordReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const campClause = campaignId ? `AND campaign.id = '${campaignId}'` : '';

    const query = `
      SELECT
        ad_group_criterion.criterion_id,
        ad_group_criterion.keyword.text,
        ad_group_criterion.keyword.match_type,
        ad_group_criterion.status,
        ad_group.id,
        campaign.id,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.conversions_value
      FROM keyword_view
      WHERE ${dateClause} ${campClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      return rawRows.map((row) => {
        const crit = row.adGroupCriterion || {};
        const kw = crit.keyword || {};
        const ag = row.adGroup || {};
        const camp = row.campaign || {};
        const m = row.metrics || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);

        return {
          criterionId: String(crit.criterionId || ''),
          keywordText: kw.text || 'keyword',
          matchType: kw.matchType || 'EXACT',
          status: crit.status || 'ENABLED',
          adGroupId: String(ag.id || ''),
          campaignId: String(camp.id || ''),
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
          cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
          conversions,
          conversionValue: Math.round(conversionValue * 100) / 100,
        };
      });
    }

    return [];
  }

  /**
   * 6. SEARCH TERMS REPORTING (search_term_view)
   */
  async fetchSearchTermsReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
    developerToken?: string,
  ): Promise<GoogleSearchTermReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const campClause = campaignId ? `AND campaign.id = '${campaignId}'` : '';

    const query = `
      SELECT
        search_term_view.search_term,
        search_term_view.status,
        campaign.id,
        ad_group.id,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.ctr,
        metrics.conversions,
        metrics.conversions_value
      FROM search_term_view
      WHERE ${dateClause} ${campClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      return rawRows.map((row) => {
        const st = row.searchTermView || {};
        const camp = row.campaign || {};
        const ag = row.adGroup || {};
        const m = row.metrics || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);

        return {
          searchTerm: st.searchTerm || '',
          status: st.status || 'ADDED',
          campaignId: String(camp.id || ''),
          adGroupId: String(ag.id || ''),
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
          conversions,
          conversionValue: Math.round(conversionValue * 100) / 100,
        };
      });
    }

    return [];
  }

  /**
   * 7. PERFORMANCE MAX ASSET GROUPS REPORTING (asset_group)
   */
  async fetchPMaxAssetGroupsReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
    developerToken?: string,
  ): Promise<GoogleAssetGroupReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const campClause = campaignId ? `AND campaign.id = '${campaignId}'` : '';

    const query = `
      SELECT
        asset_group.id,
        asset_group.name,
        asset_group.status,
        campaign.id,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM asset_group
      WHERE ${dateClause} ${campClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      return rawRows.map((row) => {
        const ag = row.assetGroup || {};
        const camp = row.campaign || {};
        const m = row.metrics || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);

        return {
          assetGroupId: String(ag.id || ''),
          assetGroupName: ag.name || 'Asset Group',
          campaignId: String(camp.id || ''),
          status: ag.status || 'ENABLED',
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          conversions,
          conversionValue: Math.round(conversionValue * 100) / 100,
        };
      });
    }

    return [];
  }

  /**
   * 8. SHOPPING PRODUCTS REPORTING (shopping_performance_view)
   */
  async fetchShoppingReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
    developerToken?: string,
  ): Promise<GoogleShoppingReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const campClause = campaignId ? `AND campaign.id = '${campaignId}'` : '';

    const query = `
      SELECT
        segments.product_title,
        segments.product_item_id,
        segments.product_type_l1,
        campaign.id,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM shopping_performance_view
      WHERE ${dateClause} ${campClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      return rawRows.map((row) => {
        const seg = row.segments || {};
        const camp = row.campaign || {};
        const m = row.metrics || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);

        return {
          productItemId: String(seg.productItemId || 'sku_default'),
          productTitle: seg.productTitle || 'Product',
          productTypeL1: seg.productTypeL1 || 'Jewelry',
          campaignId: String(camp.id || ''),
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          conversions,
          conversionValue: Math.round(conversionValue * 100) / 100,
        };
      });
    }

    return [];
  }

  /**
   * 9. SEGMENTATION REPORTING (Device & Network)
   */
  async fetchDeviceSegmentationReport(
    clientCustomerId: string,
    accessToken?: string,
    managerCustomerId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
    developerToken?: string,
  ): Promise<GoogleSegmentationReportItem[]> {
    const cleanId = this.normalizeCustomerId(clientCustomerId);
    const dateClause = startDate && endDate ? `segments.date BETWEEN '${startDate}' AND '${endDate}'` : 'segments.date DURING LAST_30_DAYS';
    const campClause = campaignId ? `AND campaign.id = '${campaignId}'` : '';

    const query = `
      SELECT
        campaign.id,
        segments.device,
        segments.ad_network_type,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE ${dateClause} ${campClause}
    `;

    const rawRows = await this.executeSearchStream(cleanId, query, accessToken, managerCustomerId, developerToken);

    if (rawRows.length > 0) {
      return rawRows.map((row) => {
        const camp = row.campaign || {};
        const seg = row.segments || {};
        const m = row.metrics || {};
        const spend = Number(m.costMicros || 0) / 1000000;
        const impressions = Number(m.impressions || 0);
        const clicks = Number(m.clicks || 0);
        const conversions = Number(m.conversions || 0);
        const conversionValue = Number(m.conversionsValue || 0);

        return {
          campaignId: String(camp.id || ''),
          device: seg.device || 'MOBILE',
          network: seg.adNetworkType || 'SEARCH',
          spend: Math.round(spend * 100) / 100,
          impressions,
          clicks,
          conversions,
          conversionValue: Math.round(conversionValue * 100) / 100,
        };
      });
    }

    return [];
  }

  /**
   * 10. ACCOUNT SYNC ENGINE: Initial full sync, incremental, date range, manual sync
   * Persists campaigns, ad groups, ads, keywords, search terms, and asset groups to Prisma
   */
  async syncGoogleAdsAccountData(
    dto: {
      organizationId: string;
      customerId: string;
      managerCustomerId?: string;
      startDate?: string;
      endDate?: string;
      syncType?: 'FULL' | 'INCREMENTAL' | 'MANUAL';
    },
    user?: AuthenticatedUser,
  ) {
    const { organizationId, customerId, managerCustomerId, startDate, endDate, syncType = 'MANUAL' } = dto;
    const cleanCustomerId = this.normalizeCustomerId(customerId);
    const syncStartedAt = new Date();

    // 1. Verify Organization exists
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException(`Organization with ID ${organizationId} not found in database.`);
    }

    // 2. Resolve Integration (workspace-specific first, then Master Agency Google connection)
    let integration = await this.prisma.integration.findFirst({
      where: {
        organizationId,
        platform: PlatformType.GOOGLE,
      },
    });

    if (!integration) {
      integration = await this.prisma.integration.findFirst({
        where: {
          platform: PlatformType.GOOGLE,
          status: IntegrationStatus.CONNECTED,
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    let accessToken: string | undefined;
    if (integration) {
      try {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.refreshAccessToken(creds.refreshToken);
        }
      } catch (e: any) {
        this.logger.warn(`Could not decrypt or refresh Google credentials: ${e.message}`);
      }
    }

    try {
      // 2. Fetch full entity performance
      const [campaigns, adGroups, ads, keywords, searchTerms, assetGroups] = await Promise.all([
        this.fetchCampaignsReport(cleanCustomerId, accessToken, managerCustomerId, startDate, endDate),
        this.fetchAdGroupsReport(cleanCustomerId, accessToken, managerCustomerId, startDate, endDate),
        this.fetchAdsReport(cleanCustomerId, accessToken, managerCustomerId, startDate, endDate),
        this.fetchKeywordsReport(cleanCustomerId, accessToken, managerCustomerId, startDate, endDate),
        this.fetchSearchTermsReport(cleanCustomerId, accessToken, managerCustomerId, startDate, endDate),
        this.fetchPMaxAssetGroupsReport(cleanCustomerId, accessToken, managerCustomerId, startDate, endDate),
      ]);

      let recordsProcessed = 0;
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      // 3. Upsert Campaigns & Metrics
      for (const camp of campaigns) {
        const dbCampaign = await this.prisma.campaign.upsert({
          where: {
            organizationId_platform_externalId: {
              organizationId,
              platform: PlatformType.GOOGLE,
              externalId: camp.campaignId,
            },
          },
          create: {
            organizationId,
            platform: PlatformType.GOOGLE,
            externalId: camp.campaignId,
            name: camp.campaignName,
            channelType: camp.channelType,
            budget: camp.budget,
            biddingStrategy: camp.biddingStrategy,
            status: camp.status,
          },
          update: {
            name: camp.campaignName,
            channelType: camp.channelType,
            budget: camp.budget,
            biddingStrategy: camp.biddingStrategy,
            status: camp.status,
          },
        });

        // Upsert AdMetric for campaign
        await this.prisma.adMetric.create({
          data: {
            campaignId: dbCampaign.id,
            date: todayDate,
            spend: camp.spend,
            impressions: camp.impressions,
            clicks: camp.clicks,
            conversions: camp.conversions,
            conversionValue: camp.conversionValue,
          },
        });
        recordsProcessed++;
      }

      // 4. Upsert Ad Groups
      for (const ag of adGroups) {
        const dbCampaign = await this.prisma.campaign.findFirst({
          where: { organizationId, platform: PlatformType.GOOGLE, externalId: ag.campaignId },
        });

        if (dbCampaign) {
          await this.prisma.adSet.upsert({
            where: { id: ag.adGroupId },
            create: {
              id: ag.adGroupId,
              campaignId: dbCampaign.id,
              externalId: ag.adGroupId,
              name: ag.adGroupName,
              type: ag.type,
              status: ag.status,
            },
            update: {
              name: ag.adGroupName,
              type: ag.type,
              status: ag.status,
            },
          });
          recordsProcessed++;
        }
      }

      // 5. Upsert Keywords
      for (const kw of keywords) {
        await this.prisma.googleKeywordMetric.create({
          data: {
            organizationId,
            campaignId: kw.campaignId || 'default',
            adGroupId: kw.adGroupId,
            keywordText: kw.keywordText,
            matchType: kw.matchType,
            status: kw.status,
            date: todayDate,
            impressions: kw.impressions,
            clicks: kw.clicks,
            spend: kw.spend,
            conversions: kw.conversions,
            conversionValue: kw.conversionValue,
          },
        });
        recordsProcessed++;
      }

      // 6. Upsert Search Terms
      for (const st of searchTerms) {
        await this.prisma.googleSearchTermMetric.create({
          data: {
            organizationId,
            campaignId: st.campaignId || 'default',
            adGroupId: st.adGroupId,
            searchTerm: st.searchTerm,
            status: st.status,
            date: todayDate,
            impressions: st.impressions,
            clicks: st.clicks,
            spend: st.spend,
            conversions: st.conversions,
            conversionValue: st.conversionValue,
          },
        });
        recordsProcessed++;
      }

      // 7. Upsert PMax Asset Groups
      for (const ast of assetGroups) {
        await this.prisma.googleAssetGroupMetric.create({
          data: {
            organizationId,
            campaignId: ast.campaignId,
            assetGroupId: ast.assetGroupId,
            assetGroupName: ast.assetGroupName,
            status: ast.status,
            date: todayDate,
            impressions: ast.impressions,
            clicks: ast.clicks,
            spend: ast.spend,
            conversions: ast.conversions,
            conversionValue: ast.conversionValue,
          },
        });
        recordsProcessed++;
      }

      // 8. Update Integration Status & Log Sync Result
      if (integration) {
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            status: IntegrationStatus.CONNECTED,
            lastSyncAt: new Date(),
            errorMessage: null,
          },
        });

        await this.prisma.integrationSyncLog.create({
          data: {
            integrationId: integration.id,
            status: 'SUCCESS',
            recordsProcessed,
            payloadSample: {
              syncType,
              customerId: cleanCustomerId,
              campaignsCount: campaigns.length,
              keywordsCount: keywords.length,
              searchTermsCount: searchTerms.length,
              assetGroupsCount: assetGroups.length,
            },
            startedAt: syncStartedAt,
            completedAt: new Date(),
          },
        });
      }

      return {
        success: true,
        customerId: cleanCustomerId,
        recordsProcessed,
        syncType,
        campaignsCount: campaigns.length,
        keywordsCount: keywords.length,
        searchTermsCount: searchTerms.length,
        assetGroupsCount: assetGroups.length,
        syncedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      this.logger.error(`Error syncing Google Ads account ${cleanCustomerId}: ${err.message}`);

      if (integration) {
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            status: IntegrationStatus.ERROR,
            errorMessage: err.message,
          },
        });

        await this.prisma.integrationSyncLog.create({
          data: {
            integrationId: integration.id,
            status: 'FAILED',
            recordsProcessed: 0,
            errorMessage: err.message,
            startedAt: syncStartedAt,
            completedAt: new Date(),
          },
        });
      }

      throw new BadRequestException(`Failed to sync Google Ads account: ${err.message}`);
    }
  }

  /**
   * Create or update a Google Lead Form Mapping
   */
  async upsertFormMapping(dto: {
    organizationId: string;
    googleCustomerId: string;
    googleFormId: string;
    campaignId?: string;
    webhookSecret: string;
    formName?: string;
    integrationId?: string;
  }) {
    const cleanCustomerId = this.normalizeCustomerId(dto.googleCustomerId);
    const cleanFormId = String(dto.googleFormId).trim();

    return this.prisma.googleLeadFormMapping.upsert({
      where: {
        googleFormId_googleCustomerId: {
          googleFormId: cleanFormId,
          googleCustomerId: cleanCustomerId,
        },
      },
      create: {
        organizationId: dto.organizationId,
        integrationId: dto.integrationId,
        googleCustomerId: cleanCustomerId,
        googleFormId: cleanFormId,
        campaignId: dto.campaignId ? String(dto.campaignId).trim() : null,
        webhookSecret: dto.webhookSecret.trim(),
        formName: dto.formName?.trim() || `Google Lead Form #${cleanFormId}`,
        isActive: true,
      },
      update: {
        organizationId: dto.organizationId,
        campaignId: dto.campaignId ? String(dto.campaignId).trim() : null,
        webhookSecret: dto.webhookSecret.trim(),
        formName: dto.formName?.trim(),
        isActive: true,
      },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  /**
   * List all Google Lead Form mappings permitted for current user scope
   */
  async listFormMappings(user: AuthenticatedUser, organizationId?: string) {
    const where: any = {};

    if (user.role === UserRole.SUPER_ADMIN) {
      if (organizationId) where.organizationId = organizationId;
    } else if (user.role === UserRole.AGENCY_ACCOUNT_MANAGER) {
      const assignments = await this.prisma.clientAssignment.findMany({
        where: { agencyUserId: user.id },
        select: { clientId: true },
      });
      const allowedClientIds = assignments.map((a) => a.clientId);
      if (organizationId) {
        if (!allowedClientIds.includes(organizationId)) {
          throw new NotFoundException('Client workspace not assigned');
        }
        where.organizationId = organizationId;
      } else {
        where.organizationId = { in: allowedClientIds };
      }
    } else {
      where.organizationId = user.organizationId;
    }

    return this.prisma.googleLeadFormMapping.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete or deactivate a Google Lead Form mapping
   */
  async deleteFormMapping(mappingId: string, user: AuthenticatedUser) {
    const mapping = await this.prisma.googleLeadFormMapping.findUnique({
      where: { id: mappingId },
    });

    if (!mapping) throw new NotFoundException('Form mapping not found');

    if (user.role !== UserRole.SUPER_ADMIN && user.organizationId !== mapping.organizationId) {
      throw new NotFoundException('Unauthorized to remove this mapping');
    }

    return this.prisma.googleLeadFormMapping.delete({
      where: { id: mappingId },
    });
  }

  /**
   * Resolve Trusted Organization Workspace and Validate Secret for Incoming Webhook
   */
  async resolveMappingAndValidateSecret(
    formId: string,
    incomingSecret: string,
  ): Promise<{ organizationId: string; mappingId?: string; formName?: string }> {
    const cleanFormId = String(formId).trim();

    // 1. Look up mapping by formId
    const mapping = await this.prisma.googleLeadFormMapping.findFirst({
      where: {
        googleFormId: cleanFormId,
        isActive: true,
      },
      include: { organization: true },
    });

    if (mapping) {
      // Validate per-form / per-client secret
      if (mapping.webhookSecret !== incomingSecret) {
        this.logger.warn(`Google webhook secret mismatch for form ${cleanFormId}`);
        throw new BadRequestException('Invalid Google webhook verification key for configured form');
      }

      return {
        organizationId: mapping.organizationId,
        mappingId: mapping.id,
        formName: mapping.formName || `Google Form #${cleanFormId}`,
      };
    }

    // 2. Global fallback check for legacy single-key configuration
    const globalKey = process.env.GOOGLE_ADS_WEBHOOK_KEY;
    if (globalKey && incomingSecret === globalKey) {
      const defaultIntegration = await this.prisma.integration.findFirst({
        where: { platform: PlatformType.GOOGLE, status: IntegrationStatus.CONNECTED },
      });

      if (defaultIntegration) {
        return {
          organizationId: defaultIntegration.organizationId,
          formName: `Google Form #${cleanFormId} (Global Key)`,
        };
      }
    }

    this.logger.warn(`No authorized Google lead form mapping found for formId: ${cleanFormId}`);
    throw new BadRequestException(`No active Google lead form mapping configured for form ID: ${cleanFormId}`);
  }
}
