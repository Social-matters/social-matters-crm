import { PrismaClient, OrgType, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning all dump/demo data from TiDB Cloud ---');

  // 1. Delete all dump metrics and reporting data
  await prisma.googleKeywordMetric.deleteMany();
  await prisma.googleSearchTermMetric.deleteMany();
  await prisma.googleAssetGroupMetric.deleteMany();
  await prisma.adMetric.deleteMany();
  await prisma.ad.deleteMany();
  await prisma.adSet.deleteMany();
  await prisma.campaign.deleteMany();

  // 2. Delete all dump leads, follow-ups, and form submissions
  await prisma.conversion.deleteMany();
  await prisma.followUp.deleteMany();
  await prisma.leadStatusHistory.deleteMany();
  await prisma.leadNote.deleteMany();
  await prisma.leadFieldValue.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.contact.deleteMany();
  await prisma.formSubmission.deleteMany();
  await prisma.form.deleteMany();
  await prisma.googleLeadFormMapping.deleteMany();

  // 3. Delete all dump integrations & sync logs
  await prisma.ingestedWebhookEvent.deleteMany();
  await prisma.integrationSyncLog.deleteMany();
  await prisma.integration.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.clientAssignment.deleteMany();

  // 4. Delete old mock client users and client orgs
  await prisma.user.deleteMany({
    where: {
      email: {
        notIn: ['superadmin@socialmatters.com', 'socialmattersagency@gmail.com'],
      },
    },
  });

  await prisma.organization.deleteMany({
    where: {
      slug: {
        in: ['aura-jewelry', 'zenith-realestate'],
      },
    },
  });

  console.log('✅ Dump data removed successfully!');

  // 5. Setup Master Agency Organization
  const agency = await prisma.organization.upsert({
    where: { slug: 'social-matters' },
    create: {
      name: 'Social Matters',
      slug: 'social-matters',
      type: OrgType.AGENCY,
      settings: {
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        mccCustomerId: '171-403-1558',
        cleanMccId: '1714031558',
      },
    },
    update: {
      name: 'Social Matters',
      settings: {
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        mccCustomerId: '171-403-1558',
        cleanMccId: '1714031558',
      },
    },
  });

  const defaultPassword = await bcrypt.hash('password123', 10);

  // 6. Ensure Super Admins
  const agencyAdmin = await prisma.user.upsert({
    where: { email: 'socialmattersagency@gmail.com' },
    create: {
      name: 'Social Matters Admin',
      email: 'socialmattersagency@gmail.com',
      passwordHash: defaultPassword,
      role: UserRole.SUPER_ADMIN,
      organizationId: agency.id,
    },
    update: {
      organizationId: agency.id,
      role: UserRole.SUPER_ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'superadmin@socialmatters.com' },
    create: {
      name: 'Super Admin',
      email: 'superadmin@socialmatters.com',
      passwordHash: defaultPassword,
      role: UserRole.SUPER_ADMIN,
      organizationId: agency.id,
    },
    update: {
      organizationId: agency.id,
      role: UserRole.SUPER_ADMIN,
    },
  });

  console.log(`✅ Master Agency ready: ${agency.name} (Admin: ${agencyAdmin.email})`);

  // 7. Create REAL Clients from the user's Google Ads MCC (Account 171-403-1558)
  const realClients = [
    {
      name: 'Sapba Live',
      slug: 'sapba-live',
      googleCustomerId: '4068492164',
      formattedCustomerId: '406-849-2164',
      industry: 'E-Commerce & Retail',
    },
    {
      name: 'GrandNewSM',
      slug: 'grandnewsm',
      googleCustomerId: '6065351633',
      formattedCustomerId: '606-535-1633',
      industry: 'Digital Marketing',
    },
    {
      name: 'Carboys & Tybu',
      slug: 'carboys-tybu',
      googleCustomerId: '9499231649',
      formattedCustomerId: '949-923-1649',
      industry: 'Automotive Services',
    },
    {
      name: 'SKT Gold & Diamonds',
      slug: 'skt-gold-diamonds',
      googleCustomerId: '9241946594',
      formattedCustomerId: '924-194-6594',
      industry: 'Jewelry & Luxury',
    },
    {
      name: 'Cleo Skin Clinic',
      slug: 'cleo-skin-clinic',
      googleCustomerId: '3679769516',
      formattedCustomerId: '367-976-9516',
      industry: 'Healthcare & Dermatology',
    },
    {
      name: 'Lumaun Solar',
      slug: 'lumaun-solar',
      googleCustomerId: '8547838372',
      formattedCustomerId: '854-783-8372',
      industry: 'Renewable Energy & Solar',
    },
    {
      name: 'Georgia Trim Clinic',
      slug: 'georgia-trim-clinic',
      googleCustomerId: '7123984510',
      formattedCustomerId: '712-398-4510',
      industry: 'Wellness & Clinic',
    },
  ];

  console.log(`--- Creating ${realClients.length} real client workspaces ---`);

  for (const client of realClients) {
    const org = await prisma.organization.upsert({
      where: { slug: client.slug },
      create: {
        name: client.name,
        slug: client.slug,
        type: OrgType.CLIENT,
        settings: {
          industry: client.industry,
          googleAdsCustomerId: client.googleCustomerId,
          googleAdsFormattedId: client.formattedCustomerId,
          mccManagerId: '1714031558',
        },
      },
      update: {
        name: client.name,
        settings: {
          industry: client.industry,
          googleAdsCustomerId: client.googleCustomerId,
          googleAdsFormattedId: client.formattedCustomerId,
          mccManagerId: '1714031558',
        },
      },
    });

    console.log(`   + Created workspace: ${org.name} (Google Ads ID: ${client.formattedCustomerId})`);
  }

  console.log('--- Database cleanup & real clients setup complete! ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
