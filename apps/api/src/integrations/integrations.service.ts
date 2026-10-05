import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PlatformType, IntegrationStatus, UserRole } from '@sm-crm/shared';
import { EncryptionService } from '../common/services/encryption.service';
import { ConnectIntegrationDto } from './dto/create-integration.dto';
import { MetaGraphService } from './meta-graph.service';
import { GoogleAdsService } from './google-ads.service';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly encryptionService: EncryptionService,
    private readonly metaGraphService: MetaGraphService,
    private readonly googleAdsService: GoogleAdsService,
  ) {}

  /**
   * Connect or update an advertising platform integration
   */
  async connect(dto: ConnectIntegrationDto, user: AuthenticatedUser) {
    if (user.role === UserRole.CLIENT_SALES_USER) {
      throw new ForbiddenException('Sales reps cannot manage integrations');
    }

    if (user.organizationType === 'CLIENT' && user.organizationId !== dto.organizationId) {
      throw new ForbiddenException('Cannot configure integrations for other organizations');
    }

    const credentialsObj = {
      accessToken: dto.accessToken || 'sandbox_access_token_v1',
      connectedAt: new Date().toISOString(),
      connectedBy: user.email,
    };

    // Encrypt sensitive token at rest using AES-256-GCM
    const encryptedCredentials = this.encryptionService.encrypt(credentialsObj);

    return this.prisma.integration.upsert({
      where: {
        organizationId_platform_externalId: {
          organizationId: dto.organizationId,
          platform: dto.platform,
          externalId: dto.externalId || 'default',
        },
      },
      create: {
        organizationId: dto.organizationId,
        platform: dto.platform,
        accountName: dto.accountName,
        externalId: dto.externalId || 'default',
        credentials: encryptedCredentials,
        status: IntegrationStatus.CONNECTED,
        lastSyncAt: new Date(),
      },
      update: {
        accountName: dto.accountName,
        credentials: encryptedCredentials,
        status: IntegrationStatus.CONNECTED,
        lastSyncAt: new Date(),
        errorMessage: null,
      },
    });
  }

  /**
   * Disconnect an integration
   */
  async disconnect(id: string, user: AuthenticatedUser) {
    const integration = await this.prisma.integration.findUnique({
      where: { id },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    if (user.organizationType === 'CLIENT' && user.organizationId !== integration.organizationId) {
      throw new ForbiddenException('Cannot manage integrations for other organizations');
    }

    return this.prisma.integration.update({
      where: { id },
      data: {
        status: IntegrationStatus.DISCONNECTED,
        credentials: this.encryptionService.encrypt({ disconnectedAt: new Date().toISOString() }),
      },
    });
  }

  /**
   * List integrations permitted by user scope
   */
  async findAll(organizationId: string | undefined, user: AuthenticatedUser) {
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
          throw new ForbiddenException('Access denied');
        }
        where.organizationId = organizationId;
      } else {
        where.organizationId = { in: allowedClientIds };
      }
    } else {
      where.organizationId = user.organizationId;
    }

    return this.prisma.integration.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        _count: { select: { syncLogs: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get sync logs for an integration
   */
  async getSyncLogs(integrationId: string) {
    return this.prisma.integrationSyncLog.findMany({
      where: { integrationId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Generate OAuth Authorization URL for Supported Platforms
   */
  async getOAuthAuthorizationUrl(platform: PlatformType, organizationId: string, redirectUri: string) {
    switch (platform) {
      case PlatformType.META: {
        const url = this.metaGraphService.getAuthorizationUrl(organizationId, redirectUri);
        return { platform, url };
      }
      case PlatformType.GOOGLE: {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        if (!clientId) throw new BadRequestException('GOOGLE_OAUTH_CLIENT_ID is not configured');
        const scopes = encodeURIComponent('https://www.googleapis.com/auth/adwords');
        const statePayload = Buffer.from(JSON.stringify({ platform: PlatformType.GOOGLE, organizationId })).toString('base64');
        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri,
        )}&response_type=code&scope=${scopes}&access_type=offline&prompt=consent&state=${statePayload}`;
        return { platform, url };
      }
      case PlatformType.LINKEDIN: {
        const clientId = process.env.LINKEDIN_CLIENT_ID;
        if (!clientId) throw new BadRequestException('LINKEDIN_CLIENT_ID is not configured');
        const scopes = encodeURIComponent('r_liteprofile,r_emailaddress,r_ads_leadgen_automation');
        const url = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri,
        )}&scope=${scopes}`;
        return { platform, url };
      }
      default:
        throw new BadRequestException(`OAuth not supported for ${platform}`);
    }
  }

  /**
   * Handle OAuth Callback and persist encrypted tokens
   */
  async handleOAuthCallback(
    platform: PlatformType,
    code: string,
    redirectUri: string,
    organizationId: string,
    user: AuthenticatedUser,
  ) {
    if (platform === PlatformType.META) {
      const { accessToken } = await this.metaGraphService.exchangeCodeForToken(code, redirectUri);
      const pages = await this.metaGraphService.getManagedPages(accessToken);

      // Create or update primary Meta connection
      const credentialsObj = {
        userAccessToken: accessToken,
        pages,
        connectedAt: new Date().toISOString(),
        connectedBy: user.email,
      };

      const encrypted = this.encryptionService.encrypt(credentialsObj);

      const integration = await this.prisma.integration.upsert({
        where: {
          organizationId_platform_externalId: {
            organizationId,
            platform: PlatformType.META,
            externalId: pages[0]?.id || 'meta-user-account',
          },
        },
        create: {
          organizationId,
          platform: PlatformType.META,
          accountName: pages[0] ? `Meta - ${pages[0].name}` : 'Meta Account',
          externalId: pages[0]?.id || 'meta-user-account',
          credentials: encrypted,
          status: IntegrationStatus.CONNECTED,
          lastSyncAt: new Date(),
        },
        update: {
          credentials: encrypted,
          status: IntegrationStatus.CONNECTED,
          lastSyncAt: new Date(),
        },
      });

      return {
        success: true,
        integrationId: integration.id,
        pagesCount: pages.length,
        pages,
      };
    }

    if (platform === PlatformType.GOOGLE) {
      const tokens = await this.googleAdsService.exchangeCodeForTokens(code, redirectUri);
      const accessibleCustomers = await this.googleAdsService.listAccessibleCustomers(tokens.accessToken);

      const primaryCustomerId = accessibleCustomers[0] || 'google_ads_mcc_default';
      const formattedCustomerId = this.googleAdsService.formatCustomerId(primaryCustomerId);

      const credentialsObj = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
        accessibleCustomers,
        primaryCustomerId,
        connectedAt: new Date().toISOString(),
        connectedBy: user.email,
      };

      const encrypted = this.encryptionService.encrypt(credentialsObj);

      const integration = await this.prisma.integration.upsert({
        where: {
          organizationId_platform_externalId: {
            organizationId,
            platform: PlatformType.GOOGLE,
            externalId: primaryCustomerId,
          },
        },
        create: {
          organizationId,
          platform: PlatformType.GOOGLE,
          accountName: `Google Ads (${formattedCustomerId})`,
          externalId: primaryCustomerId,
          credentials: encrypted,
          status: IntegrationStatus.CONNECTED,
          lastSyncAt: new Date(),
        },
        update: {
          credentials: encrypted,
          status: IntegrationStatus.CONNECTED,
          lastSyncAt: new Date(),
        },
      });

      return {
        success: true,
        integrationId: integration.id,
        primaryCustomerId,
        formattedCustomerId,
        accessibleCustomersCount: accessibleCustomers.length,
        accessibleCustomers,
      };
    }

    throw new BadRequestException(`OAuth callback not implemented for ${platform}`);
  }

  /**
   * Discover resources (Pages, Lead Forms, Customer IDs)
   */
  async discoverResources(platform: PlatformType, integrationId: string, user: AuthenticatedUser) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) throw new NotFoundException('Integration not found');

    const creds = this.encryptionService.decrypt<any>(integration.credentials);

    if (platform === PlatformType.META) {
      const userToken = creds?.userAccessToken || creds?.accessToken;
      if (!userToken) {
        return { pages: creds?.pages || [] };
      }

      try {
        const pages = await this.metaGraphService.getManagedPages(userToken);
        return { pages };
      } catch (err: any) {
        return { pages: creds?.pages || [], error: err.message };
      }
    }

    return { resources: [] };
  }

  /**
   * Subscribe a Facebook Page to Lead Ads webhooks
   */
  async subscribeMetaPage(integrationId: string, pageId: string, user: AuthenticatedUser) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const creds = this.encryptionService.decrypt<any>(integration.credentials);
    const pages = creds?.pages || [];
    const targetPage = pages.find((p: any) => p.id === pageId);

    const pageToken = targetPage?.accessToken || creds?.accessToken;
    if (!pageToken) {
      throw new BadRequestException('No page access token available for subscription');
    }

    const subscribed = await this.metaGraphService.subscribePageToLeadWebhooks(pageId, pageToken);

    await this.prisma.integrationSyncLog.create({
      data: {
        integrationId,
        status: subscribed ? 'SUCCESS' : 'FAILED',
        recordsProcessed: 0,
        payloadSample: { action: 'subscribe_page', pageId, success: subscribed },
        completedAt: new Date(),
      },
    });

    return { success: subscribed, pageId };
  }

  /**
   * Trigger immediate manual sync for an integration
   */
  async triggerManualSync(integrationId: string, user: AuthenticatedUser) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    await this.prisma.integration.update({
      where: { id: integrationId },
      data: { status: IntegrationStatus.SYNCING },
    });

    let recordsProcessed = 0;
    const creds = this.encryptionService.decrypt<any>(integration.credentials);

    // If Meta, attempt to fetch live insights for associated ad account
    if (integration.platform === PlatformType.META && integration.externalId?.startsWith('act_')) {
      try {
        const insights = await this.metaGraphService.fetchAdAccountInsights(
          integration.externalId,
          creds?.accessToken,
        );
        recordsProcessed = insights.length;
      } catch (err: any) {
        this.logger.warn(`Insight sync failed: ${err.message}`);
      }
    }

    await this.prisma.integrationSyncLog.create({
      data: {
        integrationId,
        status: 'SUCCESS',
        recordsProcessed,
        payloadSample: {
          message: 'Manual sync completed',
          platform: integration.platform,
          initiatedBy: user.email,
          recordsProcessed,
        },
        completedAt: new Date(),
      },
    });

    return this.prisma.integration.update({
      where: { id: integrationId },
      data: { status: IntegrationStatus.CONNECTED, lastSyncAt: new Date() },
    });
  }

  /**
   * Fetch Google Ads MCC Accounts Hierarchy
   */
  async getGoogleAccountsHierarchy(integrationId: string, user: AuthenticatedUser) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const creds = this.encryptionService.decrypt<any>(integration.credentials);
    let accessToken = creds?.accessToken;

    if (!accessToken && creds?.refreshToken) {
      accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
    }

    if (!accessToken) {
      return { accounts: [], message: 'No Google Ads access token available' };
    }

    const managerId = creds?.primaryCustomerId || integration.externalId || '';
    const accounts = await this.googleAdsService.getAccountHierarchy(managerId, accessToken);

    return {
      managerCustomerId: managerId,
      formattedManagerId: this.googleAdsService.formatCustomerId(managerId),
      accounts,
    };
  }

  /**
   * Fetch Google Campaign Metrics for a client customer account
   */
  async getGoogleCampaignMetrics(customerId: string, integrationId: string, user: AuthenticatedUser) {
    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });
    if (!integration) throw new NotFoundException('Integration not found');

    const creds = this.encryptionService.decrypt<any>(integration.credentials);
    let accessToken = creds?.accessToken;

    if (!accessToken && creds?.refreshToken) {
      accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
    }

    const managerId = creds?.primaryCustomerId || integration.externalId || undefined;
    const metrics = await this.googleAdsService.fetchCampaignMetrics(
      customerId,
      accessToken,
      managerId,
    );

    return {
      customerId,
      formattedCustomerId: this.googleAdsService.formatCustomerId(customerId),
      metrics,
    };
  }

  async getGoogleAccountReport(customerId: string, integrationId?: string, startDate?: string, endDate?: string) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchAccountReport(customerId, accessToken, managerId, startDate, endDate);
  }

  async getGoogleCampaignsReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    channelType?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchCampaignsReport(customerId, accessToken, managerId, startDate, endDate, channelType);
  }

  async getGoogleAdGroupsReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchAdGroupsReport(customerId, accessToken, managerId, startDate, endDate, campaignId);
  }

  async getGoogleAdsReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    adGroupId?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchAdsReport(customerId, accessToken, managerId, startDate, endDate, adGroupId);
  }

  async getGoogleKeywordsReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchKeywordsReport(customerId, accessToken, managerId, startDate, endDate, campaignId);
  }

  async getGoogleSearchTermsReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchSearchTermsReport(customerId, accessToken, managerId, startDate, endDate, campaignId);
  }

  async getGooglePMaxReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchPMaxAssetGroupsReport(customerId, accessToken, managerId, startDate, endDate, campaignId);
  }

  async getGoogleShoppingReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchShoppingReport(customerId, accessToken, managerId, startDate, endDate, campaignId);
  }

  async getGoogleSegmentationReport(
    customerId: string,
    integrationId?: string,
    startDate?: string,
    endDate?: string,
    campaignId?: string,
  ) {
    let accessToken: string | undefined;
    let managerId: string | undefined;

    if (integrationId) {
      const integration = await this.prisma.integration.findUnique({ where: { id: integrationId } });
      if (integration) {
        const creds = this.encryptionService.decrypt<any>(integration.credentials);
        accessToken = creds?.accessToken;
        if (!accessToken && creds?.refreshToken) {
          accessToken = await this.googleAdsService.refreshAccessToken(creds.refreshToken);
        }
        managerId = creds?.primaryCustomerId || integration.externalId || undefined;
      }
    }

    return this.googleAdsService.fetchDeviceSegmentationReport(customerId, accessToken, managerId, startDate, endDate, campaignId);
  }

  async triggerGoogleAccountSync(dto: any, user: AuthenticatedUser) {
    return this.googleAdsService.syncGoogleAdsAccountData(dto, user);
  }
}
