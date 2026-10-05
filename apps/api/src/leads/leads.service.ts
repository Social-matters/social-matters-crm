import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateLeadDto,
  UpdateLeadStatusDto,
  AddLeadNoteDto,
  ScheduleFollowUpDto,
  UpdateFollowUpStatusDto,
  RecordConversionDto,
  AssignSalesUserDto,
} from './dto/create-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { LeadStatus, UserRole, FollowUpStatus } from '@sm-crm/shared';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Phone number normalizer for reliable duplicate matching
   */
  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    // If standard 10 digit Indian number without country code, prefix +91
    if (/^\d{10}$/.test(cleaned)) {
      return `+91${cleaned}`;
    }
    if (!cleaned.startsWith('+') && cleaned.length > 10) {
      return `+${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Helper to ensure tenant authorization on an organization
   */
  private async validateOrgAccess(organizationId: string, user: AuthenticatedUser) {
    if (user.role === UserRole.SUPER_ADMIN) return true;

    if (user.role === UserRole.AGENCY_ACCOUNT_MANAGER) {
      const assignment = await this.prisma.clientAssignment.findUnique({
        where: {
          agencyUserId_clientId: {
            agencyUserId: user.id,
            clientId: organizationId,
          },
        },
      });
      if (!assignment) {
        throw new ForbiddenException('Access to this client organization is denied');
      }
      return true;
    }

    if (user.organizationId !== organizationId) {
      throw new ForbiddenException('Access to this client organization is denied');
    }
    return true;
  }

  /**
   * Ingest a lead enquiry (used by Manual Entry, Form Builder, and Platform Webhooks)
   */
  async ingestLead(dto: CreateLeadDto, creatorUserId?: string) {
    const normalizedPhone = this.normalizePhone(dto.phone);
    const email = dto.email?.trim().toLowerCase() || null;

    // Use Prisma transaction to ensure atomicity of contact matching and enquiry creation
    const leadResult = await this.prisma.$transaction(async (tx) => {
      // 1. Duplicate detection: Check phone first, then email
      let contact = await tx.contact.findUnique({
        where: {
          organizationId_phone: {
            organizationId: dto.organizationId,
            phone: normalizedPhone,
          },
        },
      });

      let isDuplicate = false;

      if (contact) {
        isDuplicate = true;
      } else if (email) {
        const contactByEmail = await tx.contact.findFirst({
          where: {
            organizationId: dto.organizationId,
            email,
          },
        });
        if (contactByEmail) {
          contact = contactByEmail;
          isDuplicate = true;
        }
      }

      // If still no contact, create new contact profile
      if (!contact) {
        contact = await tx.contact.create({
          data: {
            organizationId: dto.organizationId,
            fullName: dto.fullName,
            phone: normalizedPhone,
            email,
            city: dto.city,
          },
        });
      }

      // 2. Find or create Campaign if campaignName provided
      let campaignId: string | undefined = undefined;
      if (dto.campaignName) {
        const campaign = await tx.campaign.upsert({
          where: {
            organizationId_platform_externalId: {
              organizationId: dto.organizationId,
              platform: dto.sourcePlatform,
              externalId: dto.campaignName.toLowerCase().replace(/\s+/g, '-'),
            },
          },
          create: {
            organizationId: dto.organizationId,
            platform: dto.sourcePlatform,
            name: dto.campaignName,
            externalId: dto.campaignName.toLowerCase().replace(/\s+/g, '-'),
          },
          update: {},
        });
        campaignId = campaign.id;
      }

      // 3. Create the Enquiry (Lead) with immutable snapshot
      if (dto.externalLeadId) {
        const existingExternalLead = await tx.lead.findUnique({
          where: {
            organizationId_externalLeadId: {
              organizationId: dto.organizationId,
              externalLeadId: dto.externalLeadId,
            },
          },
        });
        if (existingExternalLead) {
          return existingExternalLead;
        }
      }

      const lead = await tx.lead.create({
        data: {
          organizationId: dto.organizationId,
          contactId: contact.id,
          rawFullName: dto.fullName,
          rawPhone: normalizedPhone,
          rawEmail: email,
          sourcePlatform: dto.sourcePlatform,
          externalLeadId: dto.externalLeadId || null,
          campaignId,
          status: LeadStatus.NEW,
          isDuplicate,
          submittedAt: new Date(),
        },
      });

      // 4. Save dynamic form fields
      if (dto.fieldValues && dto.fieldValues.length > 0) {
        await tx.leadFieldValue.createMany({
          data: dto.fieldValues.map((fv) => ({
            leadId: lead.id,
            fieldKey: fv.fieldKey,
            fieldLabel: fv.fieldLabel,
            fieldValue: fv.fieldValue,
            fieldType: fv.fieldType || 'text',
          })),
        });
      }

      // 5. Initial note if provided
      if (dto.initialNote && creatorUserId) {
        await tx.leadNote.create({
          data: {
            leadId: lead.id,
            userId: creatorUserId,
            content: dto.initialNote,
          },
        });
      }

      // 6. Record initial status history
      if (creatorUserId) {
        await tx.leadStatusHistory.create({
          data: {
            leadId: lead.id,
            changedById: creatorUserId,
            oldStatus: LeadStatus.NEW,
            newStatus: LeadStatus.NEW,
            notes: 'Lead created via manual entry',
          },
        });
      }

      return lead;
    });

    // Notify organization admins and account managers
    this.notificationsService
      .notifyOrganizationAdmins(
        dto.organizationId,
        'New Lead Ingested',
        `${dto.fullName} submitted via ${dto.sourcePlatform} (${dto.campaignName || 'Direct'})`,
        'NEW_LEAD',
        leadResult.id,
      )
      .catch(() => {});

    return leadResult;
  }

  /**
   * Find all leads with multi-filter bar, search, and pagination
   */
  async findAll(filter: LeadFilterDto, user: AuthenticatedUser) {
    const where: any = {};

    // 1. Tenant Scoping
    if (user.role === UserRole.SUPER_ADMIN) {
      if (filter.organizationId) {
        where.organizationId = filter.organizationId;
      }
    } else if (user.role === UserRole.AGENCY_ACCOUNT_MANAGER) {
      const assignments = await this.prisma.clientAssignment.findMany({
        where: { agencyUserId: user.id },
        select: { clientId: true },
      });
      const allowedClientIds = assignments.map((a) => a.clientId);

      if (filter.organizationId) {
        if (!allowedClientIds.includes(filter.organizationId)) {
          throw new ForbiddenException('You do not have access to this client organization');
        }
        where.organizationId = filter.organizationId;
      } else {
        where.organizationId = { in: allowedClientIds };
      }
    } else {
      // Client Admin or Client Sales User
      where.organizationId = user.organizationId;

      // If Client Sales User has restricted permissions, only view assigned leads
      if (
        user.role === UserRole.CLIENT_SALES_USER &&
        !user.permissions.includes('leads:view_all')
      ) {
        where.assignedUserId = user.id;
      }
    }

    // 2. Query Filters
    if (filter.sourcePlatform) {
      where.sourcePlatform = filter.sourcePlatform;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.campaignId) {
      where.campaignId = filter.campaignId;
    }
    if (filter.assignedUserId) {
      where.assignedUserId = filter.assignedUserId;
    }
    if (filter.startDate || filter.endDate) {
      where.submittedAt = {};
      if (filter.startDate) where.submittedAt.gte = new Date(filter.startDate);
      if (filter.endDate) where.submittedAt.lte = new Date(filter.endDate);
    }

    // 3. Search across Contact Name, Phone, and Email
    if (filter.search) {
      const q = filter.search.trim();
      where.OR = [
        { rawFullName: { contains: q } },
        { rawPhone: { contains: q } },
        { rawEmail: { contains: q } },
        {
          contact: {
            OR: [
              { fullName: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q } },
            ],
          },
        },
      ];
    }

    // 4. Follow-up status filter
    if (filter.followUpStatus) {
      where.followUps = {
        some: {
          status: filter.followUpStatus,
        },
      };
    }

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 20));
    const skip = (page - 1) * limit;

    const [total, leads] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [filter.sortBy || 'submittedAt']: filter.sortOrder || 'desc' },
        include: {
          contact: true,
          campaign: { select: { id: true, name: true, platform: true } },
          assignedUser: { select: { id: true, name: true, email: true } },
          followUps: {
            where: { status: FollowUpStatus.PENDING },
            orderBy: { scheduledAt: 'asc' },
            take: 1,
          },
          conversions: {
            select: { id: true, value: true, conversionDate: true },
          },
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single lead with full audit trail, dynamic form values, and contact history
   */
  async findOne(id: string, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        contact: {
          include: {
            leads: {
              where: { id: { not: id } },
              select: {
                id: true,
                status: true,
                sourcePlatform: true,
                submittedAt: true,
                campaign: { select: { name: true } },
              },
              orderBy: { submittedAt: 'desc' },
            },
          },
        },
        fieldValues: true,
        campaign: true,
        adSet: true,
        ad: true,
        assignedUser: { select: { id: true, name: true, email: true, phone: true } },
        organization: { select: { id: true, name: true, slug: true } },
        notes: {
          include: { author: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          include: { changedBy: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        followUps: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { scheduledAt: 'desc' },
        },
        conversions: {
          include: { createdBy: { select: { id: true, name: true } } },
          orderBy: { conversionDate: 'desc' },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Tenant check
    await this.validateOrgAccess(lead.organizationId, user);

    // Sales user permission check
    if (
      user.role === UserRole.CLIENT_SALES_USER &&
      !user.permissions.includes('leads:view_all') &&
      lead.assignedUserId !== user.id
    ) {
      throw new ForbiddenException('You are not authorized to view this lead');
    }

    return lead;
  }

  /**
   * Update lead lifecycle status with audit history
   */
  async updateStatus(id: string, dto: UpdateLeadStatusDto, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.validateOrgAccess(lead.organizationId, user);

    const oldStatus = lead.status;
    const newStatus = dto.status;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          status: newStatus,
          lastContactedAt: newStatus === LeadStatus.CONTACTED ? new Date() : undefined,
        },
      });

      await tx.leadStatusHistory.create({
        data: {
          leadId: id,
          changedById: user.id,
          oldStatus,
          newStatus,
          notes: dto.notes,
        },
      });

      return updated;
    });
  }

  /**
   * Append note to lead (immutable for ordinary users)
   */
  async addNote(id: string, dto: AddLeadNoteDto, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.validateOrgAccess(lead.organizationId, user);

    return this.prisma.leadNote.create({
      data: {
        leadId: id,
        userId: user.id,
        content: dto.content,
      },
      include: {
        author: { select: { id: true, name: true, role: true } },
      },
    });
  }

  /**
   * Schedule follow-up
   */
  async scheduleFollowUp(id: string, dto: ScheduleFollowUpDto, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.validateOrgAccess(lead.organizationId, user);

    const followUp = await this.prisma.followUp.create({
      data: {
        leadId: id,
        createdById: user.id,
        scheduledAt: new Date(dto.scheduledAt),
        reminderNote: dto.reminderNote,
        status: FollowUpStatus.PENDING,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    // Automatically transition lead status to FOLLOW_UP if currently NEW or CONTACTED
    if (lead.status === LeadStatus.NEW || lead.status === LeadStatus.CONTACTED) {
      await this.updateStatus(
        id,
        { status: LeadStatus.FOLLOW_UP, notes: 'Follow-up scheduled' },
        user,
      );
    }

    this.notificationsService
      .createNotification({
        organizationId: lead.organizationId,
        userId: user.id,
        title: 'Follow-up Scheduled',
        message: `Follow-up scheduled with ${lead.rawFullName} for ${new Date(dto.scheduledAt).toLocaleString()}`,
        type: 'FOLLOW_UP_DUE',
        entityId: lead.id,
      })
      .catch(() => {});

    return followUp;
  }

  /**
   * Update follow-up status (e.g. mark COMPLETED)
   */
  async updateFollowUpStatus(followUpId: string, dto: UpdateFollowUpStatusDto, user: AuthenticatedUser) {
    const followUp = await this.prisma.followUp.findUnique({
      where: { id: followUpId },
      include: { lead: true },
    });
    if (!followUp) throw new NotFoundException('Follow-up not found');

    await this.validateOrgAccess(followUp.lead.organizationId, user);

    return this.prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: dto.status,
        completedAt: dto.status === FollowUpStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  /**
   * Record conversion event with revenue
   */
  async recordConversion(id: string, dto: RecordConversionDto, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    await this.validateOrgAccess(lead.organizationId, user);

    const conversionResult = await this.prisma.$transaction(async (tx) => {
      const conversion = await tx.conversion.create({
        data: {
          leadId: id,
          createdById: user.id,
          value: dto.value,
          notes: dto.notes,
          conversionDate: dto.conversionDate ? new Date(dto.conversionDate) : new Date(),
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });

      // Update lead status to CONVERTED
      await tx.lead.update({
        where: { id },
        data: { status: LeadStatus.CONVERTED },
      });

      await tx.leadStatusHistory.create({
        data: {
          leadId: id,
          changedById: user.id,
          oldStatus: lead.status,
          newStatus: LeadStatus.CONVERTED,
          notes: `Conversion recorded: ₹${dto.value}`,
        },
      });

      return conversion;
    });

    this.notificationsService
      .notifyOrganizationAdmins(
        lead.organizationId,
        '🎉 Lead Converted!',
        `${lead.rawFullName} converted with order value ₹${Number(dto.value).toLocaleString()}`,
        'CONVERSION',
        lead.id,
      )
      .catch(() => {});

    return conversionResult;
  }

  /**
   * Assign sales user to lead (Client Admin only, agency users prohibited by PRD)
   */
  async assignSalesUser(id: string, dto: AssignSalesUserDto, user: AuthenticatedUser) {
    const lead = await this.prisma.lead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Rule from PRD Section 5: Agency employees will not assign individual leads to clients or their sales teams.
    if (user.organizationType === 'AGENCY') {
      throw new ForbiddenException(
        'Agency users cannot assign individual leads. Lead distribution is managed by the client organization.',
      );
    }

    if (user.role !== UserRole.CLIENT_ADMIN) {
      throw new ForbiddenException('Only Client Admin can assign leads to sales users');
    }

    // Verify assigned user belongs to the same client organization
    const salesUser = await this.prisma.user.findUnique({
      where: { id: dto.assignedUserId },
    });
    if (!salesUser || salesUser.organizationId !== lead.organizationId) {
      throw new BadRequestException('Assigned user must belong to your client organization');
    }

    return this.prisma.lead.update({
      where: { id },
      data: { assignedUserId: dto.assignedUserId },
      include: {
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Export leads to CSV
   */
  async exportCsv(filter: LeadFilterDto, user: AuthenticatedUser): Promise<string> {
    const result = await this.findAll({ ...filter, limit: 10000 }, user);
    const leads = result.data;

    const headers = [
      'Lead ID',
      'Client Workspace',
      'Full Name',
      'Phone',
      'Email',
      'Source Platform',
      'Campaign',
      'Status',
      'Is Duplicate',
      'Assigned Rep',
      'Total Conversions',
      'Submitted At',
    ];

    const rows = leads.map((lead: any) => [
      lead.id,
      `"${lead.organization?.name || ''}"`,
      `"${lead.contact?.fullName || lead.rawFullName || ''}"`,
      `"${lead.contact?.phone || lead.rawPhone || ''}"`,
      `"${lead.contact?.email || lead.rawEmail || ''}"`,
      lead.sourcePlatform,
      `"${lead.campaign?.name || ''}"`,
      lead.status,
      lead.isDuplicate ? 'YES' : 'NO',
      `"${lead.assignedUser?.name || 'Unassigned'}"`,
      lead.conversions?.length || 0,
      lead.submittedAt?.toISOString() || '',
    ]);

    return [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
  }

  /**
   * List follow-ups for a user / organization
   */
  async findFollowUps(status: FollowUpStatus | undefined, user: AuthenticatedUser) {
    const where: any = {
      lead: {
        organizationId: user.organizationType === 'AGENCY' ? undefined : user.organizationId,
      },
    };

    if (status) {
      where.status = status;
    }

    if (user.role === UserRole.CLIENT_SALES_USER) {
      where.lead.assignedUserId = user.id;
    }

    return this.prisma.followUp.findMany({
      where,
      include: {
        lead: {
          include: {
            contact: true,
            organization: { select: { name: true } },
          },
        },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
