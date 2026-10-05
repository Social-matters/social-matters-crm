const API_URL = 'http://localhost:4000/api/v1';

async function runTests() {
  console.log('--- 1. Testing Public Form Submission ---');
  try {
    const formRes = await fetch(`${API_URL}/forms/aura-vip-consultation/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Vikram Malhotra',
        email: 'vikram@malhotra.in',
        phone: '+919876543299',
        utmSource: 'meta_instagram',
        utmMedium: 'cpc',
        utmCampaign: 'diwali_2026_solitaires',
        category: 'Solitaire Engagement Rings',
        budget: '₹3,00,000 - ₹5,00,000',
        notes: 'Looking for 2ct radiant cut solitaire for anniversary'
      })
    });
    const formData = await formRes.json();
    console.log('Form Submit Status:', formRes.status, formData);
  } catch (err) {
    console.error('Form Submit Error:', err);
  }

  console.log('\n--- 2. Testing Meta Webhook Verification (GET hub.challenge) ---');
  try {
    const metaVerifyRes = await fetch(`${API_URL}/webhooks/meta?hub.mode=subscribe&hub.challenge=test_challenge_12345&hub.verify_token=social_matters_meta_verify_token_2026`);
    const metaVerifyText = await metaVerifyRes.text();
    console.log('Meta Verification Status:', metaVerifyRes.status, 'Response:', metaVerifyText);
  } catch (err) {
    console.error('Meta Verify Error:', err);
  }

  console.log('\n--- 3. Testing Meta Webhook Ingestion (POST) ---');
  try {
    const metaIngestRes = await fetch(`${API_URL}/webhooks/meta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: 'page',
        entry: [
          {
            id: 'page_12345',
            time: Date.now(),
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: 'meta_lead_999888',
                  page_id: 'page_12345',
                  form_id: 'meta_form_456',
                  created_time: Math.floor(Date.now() / 1000),
                  ad_id: 'ad_789',
                  adgroup_id: 'adset_101',
                  campaign_id: 'campaign_202',
                  // In real life graph API returns field_data, our mock/handler handles both graph API mock or direct fields
                  fullName: 'Ananya Sharma',
                  email: 'ananya.sharma@example.com',
                  phone: '+919811223344',
                  city: 'Mumbai',
                  notes: 'Interested in bespoke bridal set'
                }
              }
            ]
          }
        ]
      })
    });
    const metaIngestData = await metaIngestRes.json();
    console.log('Meta Ingest Status:', metaIngestRes.status, metaIngestData);
  } catch (err) {
    console.error('Meta Ingest Error:', err);
  }

  console.log('\n--- 4. Testing Google Ads Webhook Ingestion ---');
  try {
    const googleRes = await fetch(`${API_URL}/webhooks/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: 'google_lead_555444',
        user_column_data: [
          { column_id: 'FULL_NAME', string_value: 'Rohan Verma' },
          { column_id: 'EMAIL', string_value: 'rohan.verma@corp.in' },
          { column_id: 'PHONE_NUMBER', string_value: '+919988776655' }
        ],
        campaign_id: '123456789',
        google_key: 'google_lead_secret_2026'
      })
    });
    const googleData = await googleRes.json();
    console.log('Google Ingest Status:', googleRes.status, googleData);
  } catch (err) {
    console.error('Google Ingest Error:', err);
  }

  console.log('\n--- 5. Testing WhatsApp Inbound Webhook ---');
  try {
    const waRes = await fetch(`${API_URL}/webhooks/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ profile: { name: 'Kavita Roy' }, wa_id: '919876500001' }],
                  messages: [
                    {
                      from: '919876500001',
                      id: 'wamid.HBgLOTE5ODc2NTAwMDAx...',
                      timestamp: `${Math.floor(Date.now() / 1000)}`,
                      text: { body: 'Hi, I saw your ad for heritage choker necklaces. Can I get a catalogue?' },
                      type: 'text'
                    }
                  ]
                }
              }
            ]
          }
        ]
      })
    });
    const waData = await waRes.json();
    console.log('WhatsApp Ingest Status:', waRes.status, waData);
  } catch (err) {
    console.error('WhatsApp Ingest Error:', err);
  }
}

runTests();
