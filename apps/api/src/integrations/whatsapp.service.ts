import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

export interface WhatsAppInboundMessage {
  messageId: string;
  fromPhone: string;
  senderName: string;
  messageText: string;
  timestamp: Date;
  rawPayload: any;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  /**
   * Verify WhatsApp Webhook Challenge from Meta Developer Portal
   * Protocol: GET with hub.mode, hub.verify_token, hub.challenge
   */
  verifyWebhookChallenge(
    mode?: string,
    token?: string,
    challenge?: string,
  ): { isValid: boolean; challenge?: string } {
    const expectedToken =
      process.env.WHATSAPP_VERIFY_TOKEN ||
      process.env.META_VERIFY_TOKEN ||
      'social_matters_meta_verify_token_2026';

    if (mode === 'subscribe' && token === expectedToken && challenge) {
      return { isValid: true, challenge };
    }

    this.logger.warn(`WhatsApp webhook challenge failed: mode=${mode}, tokenProvided=${Boolean(token)}`);
    return { isValid: false };
  }

  /**
   * Verify HMAC-SHA256 signature for WhatsApp webhook requests
   */
  verifySignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      return true; // If not configured in dev, pass through
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      this.logger.warn('WhatsApp request missing sha256 signature');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const receivedSignature = signatureHeader.replace('sha256=', '');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(receivedSignature, 'hex'),
      );
    } catch {
      return false;
    }
  }

  /**
   * Parse inbound WhatsApp Cloud API webhook payload
   * Distinguishes message events from message status receipts (sent, delivered, read)
   */
  parseInboundMessage(payload: any): WhatsAppInboundMessage | null {
    // 1. Direct payload or nested within entry[].changes[].value
    const entry = payload?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value || payload;

    // 2. If it's a status notification (delivered, read, sent), DO NOT treat as a new lead
    if (value?.statuses && value.statuses.length > 0) {
      const status = value.statuses[0];
      this.logger.debug(`Received WhatsApp message status receipt: ${status.status} for ${status.id}`);
      return null;
    }

    // 3. Extract messages
    const message = value?.messages?.[0] || payload?.messages?.[0];
    if (!message) {
      return null;
    }

    const contacts = value?.contacts || payload?.contacts || [];
    const contactProfile = contacts[0]?.profile;
    const senderName = contactProfile?.name || payload?.senderName || 'WhatsApp Contact';
    const fromPhone = message.from || payload?.from || '';

    // Handle different message types: text, interactive, button
    let messageText = '';
    if (message.type === 'text') {
      messageText = message.text?.body || '';
    } else if (message.type === 'interactive') {
      messageText =
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        'Interactive response';
    } else if (message.type === 'button') {
      messageText = message.button?.text || 'Button clicked';
    } else {
      messageText = `[Received ${message.type || 'media'} attachment]`;
    }

    const timestamp = message.timestamp
      ? new Date(Number(message.timestamp) * 1000)
      : new Date();

    return {
      messageId: message.id || `wa_${Date.now()}`,
      fromPhone: fromPhone.startsWith('+') ? fromPhone : `+${fromPhone}`,
      senderName,
      messageText,
      timestamp,
      rawPayload: payload,
    };
  }
}
