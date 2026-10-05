import { PrismaClient, OrgType, UserRole, PlatformType, LeadStatus, FollowUpStatus, IntegrationStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Social Matters CRM database...');

  // 1. Seed Permissions
  const permissionsList = [
    'clients:manage',
    'clients:view_all',
    'clients:view_assigned',
    'agency_users:manage',
    'client_users:manage',
    'leads:view_all',
    'leads:view_assigned',
    'leads:change_status',
    'leads:add_notes',
    'leads:schedule_followup',
    'leads:record_conversion',
    'leads:assign_sales_user',
    'leads:export',
    'analytics:agency_consolidated',
    'analytics:client_view',
    'integrations:configure',
    'integrations:monitor',
    'forms:manage',
  ];

  for (const action of permissionsList) {
    await prisma.permission.upsert({
      where: { action },
      create: { action, description: `Permission for ${action}` },
      update: {},
    });
  }

  // 2. Create Agency Organization
  const agency = await prisma.organization.upsert({
    where: { slug: 'social-matters' },
    create: {
      name: 'Social Matters Agency',
      slug: 'social-matters',
      type: OrgType.AGENCY,
      settings: { timezone: 'Asia/Kolkata', currency: 'INR' },
    },
    update: {},
  });

  // 3. Create Client Organizations
  const clientAura = await prisma.organization.upsert({
    where: { slug: 'aura-jewelry' },
    create: {
      name: 'Aura Fine Jewelry',
      slug: 'aura-jewelry',
      type: OrgType.CLIENT,
      settings: { industry: 'Luxury Goods', primaryContact: 'Aura Director' },
    },
    update: {},
  });

  const clientZenith = await prisma.organization.upsert({
    where: { slug: 'zenith-realestate' },
    create: {
      name: 'Zenith Real Estate',
      slug: 'zenith-realestate',
      type: OrgType.CLIENT,
      settings: { industry: 'Real Estate', primaryContact: 'Zenith Sales Head' },
    },
    update: {},
  });

  // Default Passwords
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const managerPassword = await bcrypt.hash('Manager123!', 10);
  const clientAdminPassword = await bcrypt.hash('ClientAdmin123!', 10);
  const salesPassword = await bcrypt.hash('Sales123!', 10);

  // 4. Create Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@socialmatters.com' },
    create: {
      name: 'Agency Super Admin',
      email: 'superadmin@socialmatters.com',
      passwordHash: adminPassword,
      role: UserRole.SUPER_ADMIN,
      organizationId: agency.id,
    },
    update: {},
  });

  // 5. Create Agency Account Manager
  const agencyManager = await prisma.user.upsert({
    where: { email: 'manager@socialmatters.com' },
    create: {
      name: 'Karan Patel (Account Mgr)',
      email: 'manager@socialmatters.com',
      passwordHash: managerPassword,
      role: UserRole.AGENCY_ACCOUNT_MANAGER,
      organizationId: agency.id,
    },
    update: {},
  });

  // Assign Agency Manager to Aura Jewelry
  await prisma.clientAssignment.upsert({
    where: {
      agencyUserId_clientId: {
        agencyUserId: agencyManager.id,
        clientId: clientAura.id,
      },
    },
    create: {
      agencyUserId: agencyManager.id,
      clientId: clientAura.id,
    },
    update: {},
  });

  // 6. Create Client Admin for Aura Jewelry
  const auraAdmin = await prisma.user.upsert({
    where: { email: 'admin@aurajewelry.com' },
    create: {
      name: 'Vikram Mehta (Client Admin)',
      email: 'admin@aurajewelry.com',
      passwordHash: clientAdminPassword,
      role: UserRole.CLIENT_ADMIN,
      organizationId: clientAura.id,
    },
    update: {},
  });

  // 7. Create Client Sales User for Aura Jewelry
  const auraSales = await prisma.user.upsert({
    where: { email: 'sales@aurajewelry.com' },
    create: {
      name: 'Pooja Verma (Sales Rep)',
      email: 'sales@aurajewelry.com',
      passwordHash: salesPassword,
      role: UserRole.CLIENT_SALES_USER,
      organizationId: clientAura.id,
    },
    update: {},
  });

  // 8. Create Campaigns
  const auraMetaCampaign = await prisma.campaign.upsert({
    where: {
      organizationId_platform_externalId: {
        organizationId: clientAura.id,
        platform: PlatformType.META,
        externalId: 'meta-diwali-bridal-2026',
      },
    },
    create: {
      organizationId: clientAura.id,
      platform: PlatformType.META,
      name: 'Diwali Bridal Jewellery Collection',
      externalId: 'meta-diwali-bridal-2026',
    },
    update: {},
  });

  const auraGoogleCampaign = await prisma.campaign.upsert({
    where: {
      organizationId_platform_externalId: {
        organizationId: clientAura.id,
        platform: PlatformType.GOOGLE,
        externalId: 'google-solitaire-search',
      },
    },
    create: {
      organizationId: clientAura.id,
      platform: PlatformType.GOOGLE,
      name: 'Solitaire Diamond Rings Search',
      externalId: 'google-solitaire-search',
    },
    update: {},
  });

  // 9. Create Contacts & Leads for Aura Fine Jewelry
  // Contact 1: Rahul Reddy
  const contactRahul = await prisma.contact.upsert({
    where: {
      organizationId_phone: {
        organizationId: clientAura.id,
        phone: '+919876543210',
      },
    },
    create: {
      organizationId: clientAura.id,
      fullName: 'Rahul Reddy',
      phone: '+919876543210',
      email: 'rahul@example.com',
      city: 'Hyderabad',
    },
    update: {},
  });

  // Lead 1: Rahul Reddy Enquiry 1 (Meta Lead Ad)
  const leadRahul1 = await prisma.lead.upsert({
    where: {
      organizationId_externalLeadId: {
        organizationId: clientAura.id,
        externalLeadId: 'fb_lead_8492048201',
      },
    },
    create: {
      organizationId: clientAura.id,
      contactId: contactRahul.id,
      assignedUserId: auraSales.id,
      rawFullName: 'Rahul Reddy',
      rawPhone: '+919876543210',
      rawEmail: 'rahul@example.com',
      sourcePlatform: PlatformType.META,
      externalLeadId: 'fb_lead_8492048201',
      campaignId: auraMetaCampaign.id,
      status: LeadStatus.INTERESTED,
      isDuplicate: false,
      submittedAt: new Date(Date.now() - 48 * 3600 * 1000),
      fieldValues: {
        create: [
          { fieldKey: 'product', fieldLabel: 'Interested Product', fieldValue: 'Gold Necklace & Solitaire Bangles', fieldType: 'text' },
          { fieldKey: 'budget', fieldLabel: 'Estimated Budget', fieldValue: '₹1,50,000', fieldType: 'text' },
          { fieldKey: 'visit_date', fieldLabel: 'Preferred Visit Date', fieldValue: '10 October', fieldType: 'text' },
          { fieldKey: 'custom_note', fieldLabel: 'Special Occasion', fieldValue: 'Sister Wedding Reception', fieldType: 'text' },
        ],
      },
      notes: {
        create: [
          { userId: auraSales.id, content: 'Spoke with Rahul. He is looking for a bridal choker set. Sent lookbook via WhatsApp.' },
        ],
      },
      followUps: {
        create: [
          {
            createdById: auraSales.id,
            scheduledAt: new Date(Date.now() + 24 * 3600 * 1000),
            reminderNote: 'Follow up after he discusses with family regarding in-store appointment.',
            status: FollowUpStatus.PENDING,
          },
        ],
      },
    },
    update: {},
  });

  // Lead 2: Rahul Reddy Enquiry 2 (Website Form - testing duplicate matching)
  const leadRahul2 = await prisma.lead.upsert({
    where: {
      organizationId_externalLeadId: {
        organizationId: clientAura.id,
        externalLeadId: 'web_form_9938201',
      },
    },
    create: {
      organizationId: clientAura.id,
      contactId: contactRahul.id,
      assignedUserId: auraSales.id,
      rawFullName: 'Rahul R',
      rawPhone: '+919876543210',
      rawEmail: 'rahul@example.com',
      sourcePlatform: PlatformType.WEBSITE,
      externalLeadId: 'web_form_9938201',
      status: LeadStatus.CONTACTED,
      isDuplicate: true, // Marked duplicate as contact exists!
      submittedAt: new Date(Date.now() - 6 * 3600 * 1000),
      fieldValues: {
        create: [
          { fieldKey: 'offer_code', fieldLabel: 'Claimed Promo Code', fieldValue: 'DIWALI20', fieldType: 'text' },
          { fieldKey: 'store_pref', fieldLabel: 'Store Preference', fieldValue: 'Banjara Hills Flagship', fieldType: 'text' },
        ],
      },
      notes: {
        create: [
          { userId: auraSales.id, content: 'Repeat enquiry: Rahul submitted website discount coupon form.' },
        ],
      },
    },
    update: {},
  });

  // Contact 2: Sneha Roy
  const contactSneha = await prisma.contact.upsert({
    where: {
      organizationId_phone: {
        organizationId: clientAura.id,
        phone: '+919811223344',
      },
    },
    create: {
      organizationId: clientAura.id,
      fullName: 'Sneha Roy',
      phone: '+919811223344',
      email: 'sneha.roy@example.com',
      city: 'Mumbai',
    },
    update: {},
  });

  // Lead 3: Sneha Roy (Converted with revenue)
  await prisma.lead.upsert({
    where: {
      organizationId_externalLeadId: {
        organizationId: clientAura.id,
        externalLeadId: 'fb_lead_77189201',
      },
    },
    create: {
      organizationId: clientAura.id,
      contactId: contactSneha.id,
      assignedUserId: auraSales.id,
      rawFullName: 'Sneha Roy',
      rawPhone: '+919811223344',
      rawEmail: 'sneha.roy@example.com',
      sourcePlatform: PlatformType.META,
      externalLeadId: 'fb_lead_77189201',
      campaignId: auraMetaCampaign.id,
      status: LeadStatus.CONVERTED,
      isDuplicate: false,
      submittedAt: new Date(Date.now() - 72 * 3600 * 1000),
      fieldValues: {
        create: [
          { fieldKey: 'category', fieldLabel: 'Category', fieldValue: 'Diamond Stud Earrings', fieldType: 'text' },
          { fieldKey: 'budget', fieldLabel: 'Budget', fieldValue: '₹75,000 - ₹1,00,000', fieldType: 'text' },
        ],
      },
      conversions: {
        create: [
          {
            createdById: auraSales.id,
            value: 85000.0,
            notes: 'Completed in-store purchase for 1.2 carat certified diamond earrings.',
            conversionDate: new Date(),
          },
        ],
      },
    },
    update: {},
  });

  // Contact 3: Ananya Sen (New Lead)
  const contactAnanya = await prisma.contact.upsert({
    where: {
      organizationId_phone: {
        organizationId: clientAura.id,
        phone: '+919700112233',
      },
    },
    create: {
      organizationId: clientAura.id,
      fullName: 'Ananya Sen',
      phone: '+919700112233',
      email: 'ananya@example.com',
      city: 'Delhi',
    },
    update: {},
  });

  await prisma.lead.upsert({
    where: {
      organizationId_externalLeadId: {
        organizationId: clientAura.id,
        externalLeadId: 'google_lead_55102',
      },
    },
    create: {
      organizationId: clientAura.id,
      contactId: contactAnanya.id,
      rawFullName: 'Ananya Sen',
      rawPhone: '+919700112233',
      rawEmail: 'ananya@example.com',
      sourcePlatform: PlatformType.GOOGLE,
      externalLeadId: 'google_lead_55102',
      campaignId: auraGoogleCampaign.id,
      status: LeadStatus.NEW,
      isDuplicate: false,
      submittedAt: new Date(Date.now() - 2 * 3600 * 1000),
      fieldValues: {
        create: [
          { fieldKey: 'ring_size', fieldLabel: 'Ring Size', fieldValue: '14', fieldType: 'text' },
          { fieldKey: 'metal', fieldLabel: 'Metal Preference', fieldValue: 'Platinum 950', fieldType: 'text' },
        ],
      },
    },
    update: {},
  });

  // 10. Seed Integrations for Aura Fine Jewelry
  const metaIntegration = await prisma.integration.upsert({
    where: {
      organizationId_platform_externalId: {
        organizationId: clientAura.id,
        platform: PlatformType.META,
        externalId: 'page_aura_fb_9901',
      },
    },
    create: {
      organizationId: clientAura.id,
      platform: PlatformType.META,
      accountName: 'Aura Fine Jewelry - Official FB & IG',
      externalId: 'page_aura_fb_9901',
      credentials: JSON.stringify({ token: 'simulated_meta_access_token_v1' }),
      status: IntegrationStatus.CONNECTED,
      lastSyncAt: new Date(),
    },
    update: {},
  });

  await prisma.integrationSyncLog.create({
    data: {
      integrationId: metaIntegration.id,
      status: 'SUCCESS',
      recordsProcessed: 2,
      payloadSample: { event: 'leadgen_sync', processedCount: 2 },
      completedAt: new Date(),
    },
  });

  await prisma.integration.upsert({
    where: {
      organizationId_platform_externalId: {
        organizationId: clientAura.id,
        platform: PlatformType.GOOGLE,
        externalId: 'google_ad_account_4401',
      },
    },
    create: {
      organizationId: clientAura.id,
      platform: PlatformType.GOOGLE,
      accountName: 'Aura Google Ads Lead Extensions',
      externalId: 'google_ad_account_4401',
      credentials: JSON.stringify({ token: 'simulated_google_token_v1' }),
      status: IntegrationStatus.CONNECTED,
      lastSyncAt: new Date(),
    },
    update: {},
  });

  await prisma.integration.upsert({
    where: {
      organizationId_platform_externalId: {
        organizationId: clientAura.id,
        platform: PlatformType.WHATSAPP,
        externalId: 'wa_phone_number_id_3301',
      },
    },
    create: {
      organizationId: clientAura.id,
      platform: PlatformType.WHATSAPP,
      accountName: 'Aura WhatsApp Concierge (+91 99001 12233)',
      externalId: 'wa_phone_number_id_3301',
      credentials: JSON.stringify({ token: 'simulated_wa_token_v1' }),
      status: IntegrationStatus.CONNECTED,
      lastSyncAt: new Date(),
    },
    update: {},
  });

  // 11. Seed Website Form
  await prisma.form.upsert({
    where: { slug: 'aura-vip-consultation' },
    create: {
      organizationId: clientAura.id,
      name: 'VIP Bridal Jewellery Consultation',
      slug: 'aura-vip-consultation',
      submitButtonText: 'Reserve In-Store Appointment',
      thankYouMessage: 'Thank you! Your private consultation at Aura Fine Jewelry is scheduled. A concierge will call you.',
      fieldsConfig: [
        { id: '1', name: 'fullName', label: 'Full Name', type: 'text', required: true, placeholder: 'Priya Sharma' },
        { id: '2', name: 'phone', label: 'Mobile Number', type: 'phone', required: true, placeholder: '+91 98765 43210' },
        { id: '3', name: 'email', label: 'Email Address', type: 'email', required: false, placeholder: 'priya@example.com' },
        { id: '4', name: 'category', label: 'Jewellery Category', type: 'select', required: true, options: ['Solitaire Engagement Rings', 'Bridal Diamond Choker Sets', 'Temple Heritage Gold', 'Everyday Luxury'] },
        { id: '5', name: 'budget', label: 'Budget Preference', type: 'select', required: true, options: ['Under ₹1,00,000', '₹1,00,000 - ₹3,00,000', '₹3,00,000 - ₹5,00,000', '₹5,00,000+'] },
        { id: '6', name: 'notes', label: 'Specific Requirements / Visit Date', type: 'textarea', required: false, placeholder: 'Visiting Banjara Hills flagship on Saturday...' },
      ],
    },
    update: {},
  });

  // 12. Seed Campaigns, Ad Sets, Ads and Ad Metrics for Analytics
  const metaCampaign = await prisma.campaign.upsert({
    where: {
      organizationId_platform_externalId: {
        organizationId: clientAura.id,
        platform: PlatformType.META,
        externalId: 'meta_camp_diwali_2026',
      },
    },
    create: {
      organizationId: clientAura.id,
      platform: PlatformType.META,
      name: 'Diwali Solitaire Exhibition 2026',
      externalId: 'meta_camp_diwali_2026',
      status: 'ACTIVE',
    },
    update: {},
  });

  const metaAdSet = await prisma.adSet.upsert({
    where: { id: 'meta_adset_bridal_hni' },
    create: {
      id: 'meta_adset_bridal_hni',
      campaignId: metaCampaign.id,
      name: 'Bridal Diamond Solitaires - Tier 1 Metro HNI',
      externalId: 'adset_meta_001',
    },
    update: {},
  });

  await prisma.ad.upsert({
    where: { id: 'meta_ad_video_carousel' },
    create: {
      id: 'meta_ad_video_carousel',
      adSetId: metaAdSet.id,
      name: 'Heritage Choker & Solitaire Video Ad',
      externalId: 'ad_meta_video_01',
    },
    update: {},
  });

  const googleCampaign = await prisma.campaign.upsert({
    where: {
      organizationId_platform_externalId: {
        organizationId: clientAura.id,
        platform: PlatformType.GOOGLE,
        externalId: 'google_camp_search_diamond',
      },
    },
    create: {
      organizationId: clientAura.id,
      platform: PlatformType.GOOGLE,
      name: 'Search - Luxury Diamond Jewellery Hyderabad & Mumbai',
      externalId: 'google_camp_search_diamond',
      status: 'ACTIVE',
    },
    update: {},
  });

  const googleAdSet = await prisma.adSet.upsert({
    where: { id: 'google_adset_exact_intent' },
    create: {
      id: 'google_adset_exact_intent',
      campaignId: googleCampaign.id,
      name: 'High Intent Keywords: Solitaire Rings & Polki',
      externalId: 'adset_google_001',
    },
    update: {},
  });

  await prisma.ad.upsert({
    where: { id: 'google_ad_responsive_search' },
    create: {
      id: 'google_ad_responsive_search',
      adSetId: googleAdSet.id,
      name: 'Responsive Search Ad: Certified Solitaires at Aura',
      externalId: 'ad_google_rsa_01',
    },
    update: {},
  });

  // Seed daily ad metrics for past 14 days
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);

    // Meta spend ~₹3,500/day, ~22,000 impressions, ~480 clicks
    await prisma.adMetric.create({
      data: {
        date: d,
        campaignId: metaCampaign.id,
        adSetId: metaAdSet.id,
        spend: 3500 + Math.floor(Math.random() * 800),
        impressions: 22000 + Math.floor(Math.random() * 4000),
        reach: 18000 + Math.floor(Math.random() * 3000),
        clicks: 480 + Math.floor(Math.random() * 90),
        platformLeads: 4 + Math.floor(Math.random() * 3),
      },
    });

    // Google spend ~₹2,800/day, ~12,000 impressions, ~340 clicks
    await prisma.adMetric.create({
      data: {
        date: d,
        campaignId: googleCampaign.id,
        adSetId: googleAdSet.id,
        spend: 2800 + Math.floor(Math.random() * 500),
        impressions: 12000 + Math.floor(Math.random() * 2500),
        reach: 9500 + Math.floor(Math.random() * 1500),
        clicks: 340 + Math.floor(Math.random() * 60),
        platformLeads: 3 + Math.floor(Math.random() * 2),
      },
    });
  }

  // 13. Seed In-App Notifications
  await prisma.notification.createMany({
    data: [
      {
        organizationId: clientAura.id,
        userId: auraAdmin.id,
        title: 'New Lead Ingested',
        message: 'Aarav Mehta submitted via META (Diwali Solitaire Exhibition 2026)',
        type: 'NEW_LEAD',
        isRead: false,
      },
      {
        organizationId: clientAura.id,
        userId: auraSales.id,
        title: 'Follow-up Due Today',
        message: 'Reminder: Scheduled private bridal showroom tour with Aarav Mehta at 4:00 PM',
        type: 'FOLLOW_UP_DUE',
        isRead: false,
      },
      {
        organizationId: clientAura.id,
        userId: auraAdmin.id,
        title: '🎉 Lead Converted!',
        message: 'Sunita Kapoor converted with order value ₹4,50,000 (Solitaire Engagement Ring)',
        type: 'CONVERSION',
        isRead: true,
      },
    ],
  });

  console.log('Seed completed successfully with realistic lead records, integrations, campaigns, and notifications!');
}

main()
  .catch((e) => {
    console.error('Error in seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
