import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { EncryptionService } from '../common/services/encryption.service';
import { MetaGraphService } from './meta-graph.service';
import { WhatsAppService } from './whatsapp.service';
import { GoogleAdsService } from './google-ads.service';
import { PlatformType, IntegrationStatus } from '@sm-crm/shared';

@Injectable()
export class WebhookGatewayService {
  private readonly logger = new Logger(WebhookGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
    private readonly encryptionService: EncryptionService,
    private readonly metaGraphService: MetaGraphService,
    private readonly whatsappService: WhatsAppService,
    private readonly googleAdsService: GoogleAdsService,
  ) {}

  /**
   * Universal Webhook Ingestion Engine with Full Event Lifecycle:
   * RECEIVED -> VALIDATED -> QUEUED -> PROCESSING -> PROCESSED (or INVALID, FAILED, DEAD_LETTERED)
   */
  async ingestEvent(params: {
    platform: PlatformType;
    eventType: string;
    payload: any;
    rawHeaders?: any;
    externalEventId?: string;
    organizationId?: string;
  }): Promise<{ success: boolean; eventId: string; leadId?: string; message?: string }> {
    // 1. Initial State: RECEIVED
    const event = await this.prisma.ingestedWebhookEvent.create({
      data: {
        platform: params.platform,
        eventType: params.eventType,
        externalEventId: params.externalEventId,
        organizationId: params.organizationId,
        status: 'RECEIVED',
        rawHeaders: params.rawHeaders || {},
        payload: params.payload,
      },
    });

    try {
      // 2. State: VALIDATED
      await this.prisma.ingestedWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'VALIDATED' },
      });

      // 3. Idempotency Check: prevent duplicate lead creation
      if (params.externalEventId) {
        const existingProcessed = await this.prisma.ingestedWebhookEvent.findFirst({
          where: {
            platform: params.platform,
            externalEventId: params.externalEventId,
            status: 'PROCESSED',
            id: { not: event.id },
          },
        });

        if (existingProcessed) {
          this.logger.log(
            `Duplicate webhook event detected (${params.platform}, ${params.externalEventId}). Skipping processing.`,
          );
          await this.prisma.ingestedWebhookEvent.update({
            where: { id: event.id },
            data: {
              status: 'PROCESSED',
              processedAt: new Date(),
              leadId: existingProcessed.leadId,
              errorMessage: 'Duplicate event skipped via idempotency check',
            },
          });
          return {
            success: true,
            eventId: event.id,
            leadId: existingProcessed.leadId || undefined,
            message: 'Duplicate event acknowledged',
          };
        }
      }

      // 4. State: PROCESSING
      await this.prisma.ingestedWebhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSING' },
      });

      let leadResult: { id: string } | null = null;

      switch (params.platform) {
        case PlatformType.META:
          leadResult = await this.processMetaEvent(event.id, params.payload);
          break;
        case PlatformType.WHATSAPP:
          leadResult = await this.processWhatsAppEvent(event.id, params.payload);
          break;
        case PlatformType.GOOGLE:
          leadResult = await this.processGoogleEvent(event.id, params.payload);
          break;
        case PlatformType.LINKEDIN:
          leadResult = await this.processLinkedInEvent(event.id, params.payload);
          break;
        default:
          throw new BadRequestException(`Unsupported platform: ${params.platform}`);
      }

      // 5. State: PROCESSED
      await this.prisma.ingestedWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          leadId: leadResult?.id || null,
        },
      });

      return {
        success: true,
        eventId: event.id,
        leadId: leadResult?.id,
        message: 'Lead processed successfully',
      };
    } catch (err: any) {
      this.logger.error(`Webhook processing error for event ${event.id}: ${err.message}`, err.stack);

      const isInvalid = err instanceof BadRequestException;
      const newStatus = isInvalid ? 'INVALID' : 'FAILED';

      await this.prisma.ingestedWebhookEvent.update({
        where: { id: event.id },
        data: {
          status: newStatus,
          errorMessage: err.message || 'Unknown processing error',
          retryCount: { increment: 1 },
        },
      });

      return {
        success: false,
        eventId: event.id,
        message: err.message,
      };
    }
  }

  /**
   * Process Meta Lead Ads Event with Graph API Lead Retrieval
   */
  private async processMetaEvent(eventId: string, payload: any): Promise<{ id: string } | null> {
    const entry = payload.entry?.[0];
    const change = entry?.changes?.[0];
    const val = change?.value || payload;

    const leadgenId = val.leadgen_id || val.lead_id;
    const pageId = val.page_id;
    const formId = val.form_id;

    if (!leadgenId) {
      this.logger.warn(`Meta webhook payload has no leadgen_id: ${JSON.stringify(payload).slice(0, 150)}`);
      return null;
    }

    // Update event with externalEventId if not already set
    await this.prisma.ingestedWebhookEvent.update({
      where: { id: eventId },
      data: { externalEventId: String(leadgenId) },
    });

    // Resolve integration by pageId or active Meta connection
    let integration = null;
    if (pageId) {
      integration = await this.prisma.integration.findFirst({
        where: { platform: PlatformType.META, externalId: String(pageId) },
      });
    }

    if (!integration) {
      integration = await this.prisma.integration.findFirst({
        where: { platform: PlatformType.META, status: IntegrationStatus.CONNECTED },
      });
    }

    if (!integration) {
      throw new Error(`No active Meta integration configured for page ${pageId || 'default'}`);
    }

    // Decrypt credentials
    const credentials = this.encryptionService.decrypt<any>(integration.credentials);
    const accessToken = credentials?.accessToken || process.env.META_ACCESS_TOKEN;

    let fullName = val.full_name || val.raw_name || 'Meta Ad Lead';
    let phone = val.phone_number || val.raw_phone || '';
    let email = val.email || '';
    let campaignName = val.campaign_name || 'Meta Lead Ads Campaign';
    let fieldValues: any[] = [];

    // Production Path: If access token is valid and payload lacks PII, fetch lead from Graph API
    if (accessToken && (!phone || !email)) {
      try {
        const leadData = await this.metaGraphService.fetchLeadDetails(String(leadgenId), accessToken);
        fullName = leadData.fullName || fullName;
        phone = leadData.phone || phone;
        email = leadData.email || email;
        campaignName = leadData.campaignName || campaignName;
        fieldValues = leadData.fieldValues;
      } catch (graphErr: any) {
        this.logger.warn(`Could not fetch lead details via Graph API: ${graphErr.message}. Using webhook fields.`);
      }
    }

    // Fallback parsing for custom questions in webhook payload
    if (fieldValues.length === 0 && val.custom_questions) {
      for (const [key, answer] of Object.entries(val.custom_questions)) {
        fieldValues.push({
          fieldKey: key,
          fieldLabel: key.replace(/_/g, ' ').toUpperCase(),
          fieldValue: String(answer),
        });
      }
    }

    const lead = await this.leadsService.ingestLead({
      organizationId: integration.organizationId,
      fullName,
      phone: phone || '+919876543210',
      email: email || `meta_lead_${leadgenId}@socialmatters.in`,
      sourcePlatform: PlatformType.META,
      externalLeadId: String(leadgenId),
      campaignName,
      fieldValues,
      initialNote: `Auto-ingested from Meta Lead Ads (Page: ${pageId || 'N/A'}, Form: ${formId || 'N/A'})`,
    });

    // Record Integration Sync Log
    await this.prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        status: 'SUCCESS',
        recordsProcessed: 1,
        payloadSample: { leadgenId, pageId, formId, leadId: lead.id },
        completedAt: new Date(),
      },
    });

    await this.prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() },
    });

    return { id: lead.id };
  }

  /**
   * Process WhatsApp Cloud API Inbound Message Event
   */
  private async processWhatsAppEvent(eventId: string, payload: any): Promise<{ id: string } | null> {
    const inbound = this.whatsappService.parseInboundMessage(payload);

    if (!inbound) {
      this.logger.log('WhatsApp webhook contained status update or no actionable message; acknowledged.');
      return null;
    }

    await this.prisma.ingestedWebhookEvent.update({
      where: { id: eventId },
      data: { externalEventId: inbound.messageId },
    });

    const integration = await this.prisma.integration.findFirst({
      where: { platform: PlatformType.WHATSAPP, status: IntegrationStatus.CONNECTED },
    });

    if (!integration) {
      throw new Error('No active WhatsApp integration connected');
    }

    const lead = await this.leadsService.ingestLead({
      organizationId: integration.organizationId,
      fullName: inbound.senderName,
      phone: inbound.fromPhone,
      sourcePlatform: PlatformType.WHATSAPP,
      externalLeadId: inbound.messageId,
      campaignName: 'Direct WhatsApp Chat',
      initialNote: `Inbound WhatsApp message: "${inbound.messageText}"`,
    });

    await this.prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        status: 'SUCCESS',
        recordsProcessed: 1,
        payloadSample: { messageId: inbound.messageId, from: inbound.fromPhone },
        completedAt: new Date(),
      },
    });

    return { id: lead.id };
  }

  /**
   * Process Google Ads Lead Form Webhook Event with Multi-Client Routing
   */
  private async processGoogleEvent(eventId: string, payload: any): Promise<{ id: string }> {
    const leadId = payload.lead_id;
    const formId = payload.form_id;

    if (!leadId) {
      throw new BadRequestException('Malformed Google payload: lead_id is required');
    }
    if (!formId) {
      throw new BadRequestException('Malformed Google payload: form_id is required');
    }

    const incomingKey = payload.__incomingKey || payload.google_key;
    if (!incomingKey) {
      throw new BadRequestException('Missing Google Ads webhook verification key (google-key header or google_key field required)');
    }

    // Resolve trusted client organization and validate per-form or per-client secret
    const mapping = await this.googleAdsService.resolveMappingAndValidateSecret(
      String(formId),
      String(incomingKey),
    );

    // Update event record with resolved organization and externalEventId
    await this.prisma.ingestedWebhookEvent.update({
      where: { id: eventId },
      data: {
        externalEventId: String(leadId),
        organizationId: mapping.organizationId,
      },
    });

    const userColumnData = payload.user_column_data || [];
    let fullName = payload.full_name || '';
    let firstName = '';
    let lastName = '';
    let phone = payload.phone_number || '';
    let email = payload.email || '';
    const fieldValues: any[] = [];

    for (const col of userColumnData) {
      const colId = (col.column_id || '').toUpperCase();
      const val = col.string_value || '';
      if (colId === 'FULL_NAME') fullName = val;
      else if (colId === 'FIRST_NAME') firstName = val;
      else if (colId === 'LAST_NAME') lastName = val;
      else if (colId === 'PHONE_NUMBER' || colId === 'WORK_PHONE') phone = val;
      else if (colId === 'EMAIL' || colId === 'WORK_EMAIL') email = val;
      else {
        fieldValues.push({
          fieldKey: col.column_id || 'custom_field',
          fieldLabel: col.column_name || col.column_id,
          fieldValue: val,
        });
      }
    }

    if (!fullName && (firstName || lastName)) {
      fullName = `${firstName} ${lastName}`.trim();
    }
    if (!fullName) {
      fullName = 'Google Ads Lead';
    }

    const isTest = Boolean(payload.is_test);
    const gclId = payload.gcl_id;
    const campaignId = payload.campaign_id;
    const adgroupId = payload.adgroup_id;
    const creativeId = payload.creative_id;

    if (gclId) {
      fieldValues.push({
        fieldKey: 'gcl_id',
        fieldLabel: 'Google Click ID',
        fieldValue: String(gclId),
      });
    }
    if (adgroupId) {
      fieldValues.push({
        fieldKey: 'adgroup_id',
        fieldLabel: 'Ad Group ID',
        fieldValue: String(adgroupId),
      });
    }
    if (creativeId) {
      fieldValues.push({
        fieldKey: 'creative_id',
        fieldLabel: 'Creative ID',
        fieldValue: String(creativeId),
      });
    }

    const testTag = isTest ? ' [OFFICIAL GOOGLE TEST DATA]' : '';
    const initialNote = `Auto-ingested from Google Ads Lead Form: ${mapping.formName || formId} (Form ID: ${formId}, Campaign ID: ${campaignId || 'N/A'})${testTag}`;

    const lead = await this.leadsService.ingestLead({
      organizationId: mapping.organizationId,
      fullName,
      phone: phone || '+919988776655',
      email: email || `google_lead_${leadId}@socialmatters.in`,
      sourcePlatform: PlatformType.GOOGLE,
      externalLeadId: String(leadId),
      campaignName: payload.campaign_name || (campaignId ? `Google Campaign #${campaignId}` : 'Google Ads Lead Form Campaign'),
      fieldValues,
      initialNote,
    });

    // Optional sync log recording if a Google integration is linked to this organization
    const integration = await this.prisma.integration.findFirst({
      where: { organizationId: mapping.organizationId, platform: PlatformType.GOOGLE },
    });

    if (integration) {
      await this.prisma.integrationSyncLog.create({
        data: {
          integrationId: integration.id,
          status: 'SUCCESS',
          recordsProcessed: 1,
          payloadSample: {
            leadId: lead.id,
            externalLeadId: leadId,
            formId,
            campaignId,
            isTest,
          },
          completedAt: new Date(),
        },
      });
    }

    return { id: lead.id };
  }

  /**
   * Process LinkedIn Lead Gen Webhook Event
   */
  private async processLinkedInEvent(eventId: string, payload: any): Promise<{ id: string }> {
    const leadId = payload.leadId || payload.id || `li_${Date.now()}`;

    await this.prisma.ingestedWebhookEvent.update({
      where: { id: eventId },
      data: { externalEventId: leadId },
    });

    const integration = await this.prisma.integration.findFirst({
      where: { platform: PlatformType.LINKEDIN, status: IntegrationStatus.CONNECTED },
    });

    if (!integration) {
      throw new Error('No active LinkedIn integration connected');
    }

    const fullName =
      payload.fullName ||
      `${payload.firstName || ''} ${payload.lastName || ''}`.trim() ||
      'LinkedIn Professional Lead';

    const lead = await this.leadsService.ingestLead({
      organizationId: integration.organizationId,
      fullName,
      phone: payload.phone || '+919123456780',
      email: payload.email || `linkedin_lead_${leadId}@socialmatters.in`,
      sourcePlatform: PlatformType.LINKEDIN,
      externalLeadId: leadId,
      campaignName: payload.campaignName || 'LinkedIn Lead Gen Campaign',
      initialNote: 'Auto-ingested from LinkedIn Lead Gen Form webhook',
    });

    await this.prisma.integrationSyncLog.create({
      data: {
        integrationId: integration.id,
        status: 'SUCCESS',
        recordsProcessed: 1,
        payloadSample: { leadId: lead.id, externalLeadId: leadId },
        completedAt: new Date(),
      },
    });

    return { id: lead.id };
  }

  /**
   * Retry a previously failed or invalid webhook event
   */
  async retryEvent(eventId: string): Promise<any> {
    const event = await this.prisma.ingestedWebhookEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Webhook event ${eventId} not found`);
    }

    this.logger.log(`Retrying webhook event ${eventId} (${event.platform})`);

    await this.prisma.ingestedWebhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'RETRYING',
        retryCount: { increment: 1 },
      },
    });

    return this.ingestEvent({
      platform: event.platform as unknown as PlatformType,
      eventType: event.eventType,
      payload: event.payload,
      rawHeaders: event.rawHeaders,
      externalEventId: event.externalEventId || undefined,
      organizationId: event.organizationId || undefined,
    });
  }

  /**
   * Get Webhook Event stream for the Integrations dashboard
   */
  async getEvents(query: { platform?: PlatformType; status?: string; limit?: number }) {
    const where: any = {};
    if (query.platform) where.platform = query.platform;
    if (query.status) where.status = query.status;

    return this.prisma.ingestedWebhookEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 50,
    });
  }
}
