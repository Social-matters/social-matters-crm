import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface MetaLeadData {
  leadgenId: string;
  formId?: string;
  pageId?: string;
  adId?: string;
  adName?: string;
  campaignName?: string;
  fullName: string;
  phone?: string;
  email?: string;
  fieldValues: Array<{ fieldKey: string; fieldLabel: string; fieldValue: string }>;
  createdTime?: Date;
  rawPayload: any;
}

@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name);
  private readonly apiVersion = process.env.META_API_VERSION || 'v21.0';
  private readonly baseUrl = 'https://graph.facebook.com';

  /**
   * Verify HMAC-SHA256 signature from Meta webhook
   * Header: X-Hub-Signature-256: sha256={hash}
   */
  verifySignature(rawBody: string | Buffer, signatureHeader?: string): boolean {
    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      this.logger.warn('META_APP_SECRET is not configured; skipping signature verification');
      return true;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      this.logger.warn('Missing or invalid X-Hub-Signature-256 header');
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
   * Generate Facebook OAuth authorization URL for Lead Retrieval and Ads permissions
   */
  getAuthorizationUrl(organizationId: string, redirectUri: string): string {
    const appId = process.env.META_APP_ID;
    if (!appId) {
      throw new BadRequestException('META_APP_ID is not configured in environment variables');
    }

    const scopes = [
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_metadata',
      'leads_retrieval',
      'ads_read',
      'ads_management',
    ].join(',');

    const state = Buffer.from(
      JSON.stringify({
        orgId: organizationId,
        timestamp: Date.now(),
      }),
    ).toString('base64');

    return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&scope=${encodeURIComponent(scopes)}&state=${state}&response_type=code`;
  }

  /**
   * Exchange OAuth code for a long-lived user access token
   */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<{ accessToken: string; expiresIn: number }> {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      throw new BadRequestException('META_APP_ID or META_APP_SECRET is missing');
    }

    // 1. Get short-lived token
    const tokenUrl = `${this.baseUrl}/${this.apiVersion}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&code=${code}`;

    const res = await fetch(tokenUrl);
    const data = await res.json();

    if (!res.ok || data.error) {
      this.logger.error(`Failed to exchange Meta OAuth code: ${JSON.stringify(data.error)}`);
      throw new BadRequestException(data.error?.message || 'Failed to exchange Meta OAuth code');
    }

    const shortLivedToken = data.access_token;

    // 2. Exchange for 60-day long-lived token
    const longLivedUrl = `${this.baseUrl}/${this.apiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;

    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = await longLivedRes.json();

    if (!longLivedRes.ok || longLivedData.error) {
      this.logger.warn(`Could not exchange for long-lived token, falling back to short-lived: ${JSON.stringify(longLivedData.error)}`);
      return { accessToken: shortLivedToken, expiresIn: data.expires_in || 3600 };
    }

    return {
      accessToken: longLivedData.access_token,
      expiresIn: longLivedData.expires_in || 5184000, // 60 days
    };
  }

  /**
   * Retrieve Facebook Pages managed by the authenticated user with page access tokens
   */
  async getManagedPages(userAccessToken: string): Promise<Array<{ id: string; name: string; accessToken: string; category?: string }>> {
    const url = `${this.baseUrl}/${this.apiVersion}/me/accounts?fields=id,name,access_token,category&access_token=${userAccessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      this.logger.error(`Error fetching Meta pages: ${JSON.stringify(data.error)}`);
      throw new BadRequestException(data.error?.message || 'Failed to retrieve Facebook Pages');
    }

    return (data.data || []).map((page: any) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      category: page.category,
    }));
  }

  /**
   * Retrieve Instant Lead Gen Forms for a specific Facebook Page
   */
  async getPageLeadForms(pageId: string, pageAccessToken: string): Promise<Array<{ id: string; name: string; status: string; questions?: any[] }>> {
    const url = `${this.baseUrl}/${this.apiVersion}/${pageId}/leadgen_forms?fields=id,name,status,questions&access_token=${pageAccessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      this.logger.error(`Error fetching Lead Forms for page ${pageId}: ${JSON.stringify(data.error)}`);
      throw new BadRequestException(data.error?.message || 'Failed to retrieve Lead Gen Forms');
    }

    return data.data || [];
  }

  /**
   * Subscribe a Facebook Page to receive leadgen webhooks
   */
  async subscribePageToLeadWebhooks(pageId: string, pageAccessToken: string): Promise<boolean> {
    const url = `${this.baseUrl}/${this.apiVersion}/${pageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageAccessToken}`;
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();

    if (!res.ok || data.error) {
      this.logger.error(`Error subscribing page ${pageId} to leadgen webhooks: ${JSON.stringify(data.error)}`);
      return false;
    }

    return data.success === true;
  }

  /**
   * Fetch complete lead PII from Meta Graph API using leadgen_id
   * In production Meta Lead Ads, the webhook payload ONLY delivers { leadgen_id, page_id, form_id }.
   * The CRM MUST query the Graph API to fetch full name, email, phone number, and custom answers.
   */
  async fetchLeadDetails(leadgenId: string, accessToken: string): Promise<MetaLeadData> {
    const url = `${this.baseUrl}/${this.apiVersion}/${leadgenId}?fields=id,created_time,ad_id,ad_name,form_id,campaign_name,field_data&access_token=${accessToken}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      this.logger.error(`Failed to fetch Meta lead ${leadgenId}: ${JSON.stringify(data.error)}`);
      throw new Error(data.error?.message || `Meta Graph API lead retrieval failed: ${leadgenId}`);
    }

    let fullName = 'Meta Ad Lead';
    let phone = '';
    let email = '';
    const fieldValues: Array<{ fieldKey: string; fieldLabel: string; fieldValue: string }> = [];

    const fieldData = data.field_data || [];
    for (const item of fieldData) {
      const name = (item.name || '').toLowerCase();
      const val = (item.values && item.values[0]) ? String(item.values[0]) : '';

      if (name === 'full_name' || name === 'name' || name.includes('full_name')) {
        fullName = val;
      } else if (name === 'phone_number' || name === 'phone' || name.includes('phone')) {
        phone = val;
      } else if (name === 'email' || name.includes('email')) {
        email = val;
      } else {
        fieldValues.push({
          fieldKey: item.name,
          fieldLabel: (item.name || '').replace(/_/g, ' ').toUpperCase(),
          fieldValue: val,
        });
      }
    }

    return {
      leadgenId: data.id || leadgenId,
      formId: data.form_id,
      adId: data.ad_id,
      adName: data.ad_name,
      campaignName: data.campaign_name,
      fullName,
      phone,
      email,
      fieldValues,
      createdTime: data.created_time ? new Date(data.created_time) : new Date(),
      rawPayload: data,
    };
  }

  /**
   * Synchronize advertising campaign insights for an Ad Account
   */
  async fetchAdAccountInsights(adAccountId: string, accessToken: string): Promise<any> {
    const cleanId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    const url = `${this.baseUrl}/${this.apiVersion}/${cleanId}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,cpc,actions&date_preset=last_30d&access_token=${accessToken}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || data.error) {
      this.logger.warn(`Could not fetch insights for ${adAccountId}: ${JSON.stringify(data.error)}`);
      return [];
    }

    return data.data || [];
  }
}
