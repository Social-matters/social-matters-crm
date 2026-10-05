import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IntegrationsService } from './integrations.service';
import { WebhookGatewayService } from './webhook-gateway.service';
import { ConnectIntegrationDto } from './dto/create-integration.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PlatformType } from '@sm-crm/shared';
import { GoogleAdsService } from './google-ads.service';

@ApiTags('Integrations Management')
@Controller('api/v1/integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly webhookGateway: WebhookGatewayService,
    private readonly googleAdsService: GoogleAdsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List connected integrations and status' })
  async findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.findAll(organizationId, user);
  }

  @Post('connect')
  @ApiOperation({ summary: 'Connect or update an advertising platform integration' })
  async connect(
    @Body() dto: ConnectIntegrationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.connect(dto, user);
  }

  @Get('events')
  @ApiOperation({ summary: 'Get live ingested webhook events stream' })
  async getEvents(
    @Query('platform') platform?: PlatformType,
    @Query('status') status?: string,
  ) {
    return this.webhookGateway.getEvents({ platform, status });
  }

  @Post('events/:id/retry')
  @ApiOperation({ summary: 'Retry a failed webhook event' })
  async retryEvent(@Param('id') id: string) {
    return this.webhookGateway.retryEvent(id);
  }

  @Get('oauth/:platform/url')
  @ApiOperation({ summary: 'Get OAuth Authorization URL for advertising platform' })
  async getOAuthUrl(
    @Param('platform') platform: PlatformType,
    @Query('organizationId') organizationId: string,
    @Query('redirectUri') redirectUri: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.getOAuthAuthorizationUrl(
      platform,
      organizationId || user.organizationId,
      redirectUri,
    );
  }

  @Post('oauth/:platform/callback')
  @ApiOperation({ summary: 'Handle OAuth callback and persist credentials' })
  async handleOAuthCallback(
    @Param('platform') platform: PlatformType,
    @Body() body: { code: string; redirectUri: string; organizationId?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.handleOAuthCallback(
      platform,
      body.code,
      body.redirectUri,
      body.organizationId || user.organizationId,
      user,
    );
  }

  @Get('resources/:platform')
  @ApiOperation({ summary: 'Discover available pages, forms, or ad accounts' })
  async getResources(
    @Param('platform') platform: PlatformType,
    @Query('integrationId') integrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.discoverResources(platform, integrationId, user);
  }

  // -------------------------------------------------------------
  // GOOGLE ADS REPORTING & MCC SYNC ROUTES (STATIC PRECEDENCE)
  // -------------------------------------------------------------
  @Get('google/mappings')
  @ApiOperation({ summary: 'List all configured Google Lead Form mappings' })
  async listGoogleMappings(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.googleAdsService.listFormMappings(user, organizationId);
  }

  @Post('google/mappings')
  @ApiOperation({ summary: 'Create or update Google Lead Form mapping to client workspace' })
  async upsertGoogleMapping(
    @Body()
    dto: {
      organizationId: string;
      googleCustomerId: string;
      googleFormId: string;
      campaignId?: string;
      webhookSecret: string;
      formName?: string;
      integrationId?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.googleAdsService.upsertFormMapping(dto);
  }

  @Delete('google/mappings/:id')
  @ApiOperation({ summary: 'Delete a Google Lead Form mapping' })
  async deleteGoogleMapping(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.googleAdsService.deleteFormMapping(id, user);
  }

  @Get('google/hierarchy')
  @ApiOperation({ summary: 'Get Google Ads MCC accounts and client customers' })
  async getGoogleHierarchy(
    @Query('integrationId') integrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.getGoogleAccountsHierarchy(integrationId, user);
  }

  @Get('google/metrics')
  @ApiOperation({ summary: 'Fetch campaign performance metrics for a client customer' })
  async getGoogleMetrics(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.getGoogleCampaignMetrics(customerId, integrationId, user);
  }

  @Get('google/account-report')
  @ApiOperation({ summary: 'Full Account Level Reporting: Currency, Timezone, Spend, Conversions, ROAS' })
  async getGoogleAccountReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.integrationsService.getGoogleAccountReport(customerId, integrationId, startDate, endDate);
  }

  @Get('google/campaigns-report')
  @ApiOperation({ summary: 'Full Campaign Reporting: Search, PMax, Shopping, Display, Demand Gen, Video' })
  async getGoogleCampaignsReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('channelType') channelType?: string,
  ) {
    return this.integrationsService.getGoogleCampaignsReport(customerId, integrationId, startDate, endDate, channelType);
  }

  @Get('google/adgroups-report')
  @ApiOperation({ summary: 'Ad Group Level Reporting' })
  async getGoogleAdGroupsReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.integrationsService.getGoogleAdGroupsReport(customerId, integrationId, startDate, endDate, campaignId);
  }

  @Get('google/ads-report')
  @ApiOperation({ summary: 'Ad Level Performance & Asset Information' })
  async getGoogleAdsReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('adGroupId') adGroupId?: string,
  ) {
    return this.integrationsService.getGoogleAdsReport(customerId, integrationId, startDate, endDate, adGroupId);
  }

  @Get('google/keywords-report')
  @ApiOperation({ summary: 'Search Keywords & Match Types (Exact, Phrase, Broad) Reporting' })
  async getGoogleKeywordsReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.integrationsService.getGoogleKeywordsReport(customerId, integrationId, startDate, endDate, campaignId);
  }

  @Get('google/search-terms-report')
  @ApiOperation({ summary: 'Actual Search Terms Query Reporting' })
  async getGoogleSearchTermsReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.integrationsService.getGoogleSearchTermsReport(customerId, integrationId, startDate, endDate, campaignId);
  }

  @Get('google/pmax-report')
  @ApiOperation({ summary: 'Performance Max Asset Groups & Creative Performance Reporting' })
  async getGooglePMaxReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.integrationsService.getGooglePMaxReport(customerId, integrationId, startDate, endDate, campaignId);
  }

  @Get('google/shopping-report')
  @ApiOperation({ summary: 'Google Shopping Product & Group Performance Reporting' })
  async getGoogleShoppingReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.integrationsService.getGoogleShoppingReport(customerId, integrationId, startDate, endDate, campaignId);
  }

  @Get('google/segmentation-report')
  @ApiOperation({ summary: 'Google Ads Segmentation: Device & Network Performance' })
  async getGoogleSegmentationReport(
    @Query('customerId') customerId: string,
    @Query('integrationId') integrationId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.integrationsService.getGoogleSegmentationReport(customerId, integrationId, startDate, endDate, campaignId);
  }

  @Post('google/sync')
  @ApiOperation({ summary: 'Trigger Initial, Incremental, or Date-Range Account Sync' })
  async triggerGoogleSync(
    @Body()
    dto: {
      organizationId: string;
      customerId: string;
      managerCustomerId?: string;
      startDate?: string;
      endDate?: string;
      syncType?: 'FULL' | 'INCREMENTAL' | 'MANUAL';
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.triggerGoogleAccountSync(dto, user);
  }

  // -------------------------------------------------------------
  // PARAMETERIZED :id ROUTES (REGISTERED LAST)
  // -------------------------------------------------------------
  @Delete(':id')
  @ApiOperation({ summary: 'Disconnect an advertising platform integration' })
  async disconnect(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.disconnect(id, user);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get sync history and error logs for an integration' })
  async getLogs(@Param('id') id: string) {
    return this.integrationsService.getSyncLogs(id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger immediate synchronization' })
  async sync(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.triggerManualSync(id, user);
  }

  @Post(':id/subscribe-meta-page')
  @ApiOperation({ summary: 'Subscribe a connected Facebook Page to Lead Ads webhooks' })
  async subscribeMetaPage(
    @Param('id') id: string,
    @Body() body: { pageId: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.integrationsService.subscribeMetaPage(id, body.pageId, user);
  }
}
