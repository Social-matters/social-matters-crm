import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MetaWebhookQueryDto } from './dto/create-integration.dto';
import { WebhookGatewayService } from './webhook-gateway.service';
import { MetaGraphService } from './meta-graph.service';
import { WhatsAppService } from './whatsapp.service';
import { PlatformType } from '@sm-crm/shared';

@ApiTags('Public Ingestion Webhooks')
@Controller('api/v1/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhookGateway: WebhookGatewayService,
    private readonly metaGraphService: MetaGraphService,
    private readonly whatsappService: WhatsAppService,
  ) {}

  /**
   * Meta Webhook Verification endpoint (hub.challenge)
   */
  @Get('meta')
  @ApiOperation({ summary: 'Meta Webhook Verification' })
  verifyMeta(@Query() query: MetaWebhookQueryDto, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken =
      process.env.META_VERIFY_TOKEN || 'social_matters_meta_verify_token_2026';

    if (mode === 'subscribe' && token === expectedToken) {
      this.logger.log('Meta Webhook challenge verified successfully');
      return res.status(HttpStatus.OK).send(challenge);
    }
    this.logger.warn('Meta Webhook verification token mismatch');
    return res.status(HttpStatus.FORBIDDEN).send('Verification token mismatch');
  }

  /**
   * Meta Lead Ads Ingestion endpoint
   */
  @Post('meta')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Meta Lead Ads Webhook Receiver' })
  async receiveMeta(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature?: string,
    @Req() req?: Request,
  ) {
    // If raw body exists and secret is set, verify signature
    if (signature && (req as any)?.rawBody) {
      const isValid = this.metaGraphService.verifySignature((req as any).rawBody, signature);
      if (!isValid) {
        throw new ForbiddenException('Invalid Meta HMAC signature');
      }
    }

    return this.webhookGateway.ingestEvent({
      platform: PlatformType.META,
      eventType: 'leadgen',
      payload,
      rawHeaders: req?.headers,
    });
  }

  /**
   * WhatsApp Business Cloud API Webhook Verification (hub.challenge)
   */
  @Get('whatsapp')
  @ApiOperation({ summary: 'WhatsApp Business API Webhook Verification' })
  verifyWhatsApp(@Query() query: MetaWebhookQueryDto, @Res() res: Response) {
    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const result = this.whatsappService.verifyWebhookChallenge(mode, token, challenge);
    if (result.isValid && result.challenge) {
      this.logger.log('WhatsApp Webhook challenge verified successfully');
      return res.status(HttpStatus.OK).send(result.challenge);
    }

    this.logger.warn('WhatsApp Webhook verification token mismatch');
    return res.status(HttpStatus.FORBIDDEN).send('Verification token mismatch');
  }

  /**
   * WhatsApp Business API inbound enquiry webhook
   */
  @Post('whatsapp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WhatsApp Business API Webhook Receiver' })
  async receiveWhatsApp(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature?: string,
    @Req() req?: Request,
  ) {
    if (signature && (req as any)?.rawBody) {
      const isValid = this.whatsappService.verifySignature((req as any).rawBody, signature);
      if (!isValid) {
        throw new ForbiddenException('Invalid WhatsApp HMAC signature');
      }
    }

    return this.webhookGateway.ingestEvent({
      platform: PlatformType.WHATSAPP,
      eventType: 'whatsapp_message',
      payload,
      rawHeaders: req?.headers,
    });
  }

  /**
   * Google Ads Lead Form webhook
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Google Ads Lead Form Webhook Receiver' })
  async receiveGoogle(
    @Body() payload: any,
    @Headers('google-key') googleKeyHeader?: string,
    @Req() req?: Request,
  ) {
    const key = googleKeyHeader || payload?.google_key;

    return this.webhookGateway.ingestEvent({
      platform: PlatformType.GOOGLE,
      eventType: 'google_lead_form',
      payload: { ...payload, __incomingKey: key },
      rawHeaders: req?.headers,
    });
  }

  /**
   * LinkedIn Lead Gen Form webhook
   */
  @Post('linkedin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'LinkedIn Lead Gen Form Webhook Receiver' })
  async receiveLinkedIn(@Body() payload: any, @Req() req?: Request) {
    return this.webhookGateway.ingestEvent({
      platform: PlatformType.LINKEDIN,
      eventType: 'linkedin_lead',
      payload,
      rawHeaders: req?.headers,
    });
  }
}
