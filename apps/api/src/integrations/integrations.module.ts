import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { WebhooksController } from './webhooks.controller';
import { WebhookGatewayService } from './webhook-gateway.service';
import { MetaGraphService } from './meta-graph.service';
import { WhatsAppService } from './whatsapp.service';
import { GoogleAdsService } from './google-ads.service';
import { LeadsModule } from '../leads/leads.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [LeadsModule, CommonModule],
  controllers: [IntegrationsController, WebhooksController],
  providers: [
    IntegrationsService,
    WebhookGatewayService,
    MetaGraphService,
    WhatsAppService,
    GoogleAdsService,
  ],
  exports: [
    IntegrationsService,
    WebhookGatewayService,
    MetaGraphService,
    WhatsAppService,
    GoogleAdsService,
  ],
})
export class IntegrationsModule {}
