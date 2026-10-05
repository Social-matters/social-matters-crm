import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeadsService } from '../leads/leads.service';
import { CreateFormDto, SubmitFormDto } from './dto/create-form.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PlatformType } from '@sm-crm/shared';

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leadsService: LeadsService,
  ) {}

  async create(dto: CreateFormDto, user: AuthenticatedUser) {
    if (user.organizationType === 'CLIENT' && user.organizationId !== dto.organizationId) {
      throw new BadRequestException('Cannot create forms for another client');
    }

    const existing = await this.prisma.form.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`A form with slug "${dto.slug}" already exists`);
    }

    return this.prisma.form.create({
      data: {
        organizationId: dto.organizationId,
        name: dto.name,
        slug: dto.slug,
        submitButtonText: dto.submitButtonText || 'Submit',
        thankYouMessage: dto.thankYouMessage || 'Thank you! We will get in touch with you shortly.',
        fieldsConfig: dto.fieldsConfig as any,
      },
    });
  }

  async findAll(organizationId: string | undefined, user: AuthenticatedUser) {
    const where: any = {};
    if (user.organizationType === 'CLIENT') {
      where.organizationId = user.organizationId;
    } else if (organizationId) {
      where.organizationId = organizationId;
    }

    return this.prisma.form.findMany({
      where,
      include: {
        _count: {
          select: { submissions: true, leads: true },
        },
        organization: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const form = await this.prisma.form.findUnique({
      where: { slug },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!form || !form.isPublished) {
      throw new NotFoundException('Form not found or currently inactive');
    }
    return form;
  }

  /**
   * Handle public form submission with UTM tracking & auto-lead creation
   */
  async submit(slug: string, dto: SubmitFormDto, ip?: string, userAgent?: string) {
    const form = await this.findBySlug(slug);
    const fieldsConfig = (form.fieldsConfig as any[]) || [];
    
    // Normalize payload from either dto.payload or flat fields
    const { payload: rawPayload, utm: rawUtm, utmSource, utmMedium, utmCampaign, customFields, ...restDto } = dto || {};
    const payload: Record<string, any> = {
      ...restDto,
      ...(customFields || {}),
      ...(rawPayload || {}),
    };
    if (payload.fullName && !payload.name) payload.name = payload.fullName;
    if (payload.name && !payload.fullName) payload.fullName = payload.name;

    const utm = rawUtm || {
      source: utmSource,
      medium: utmMedium,
      campaign: utmCampaign,
    };

    // Validate required fields
    for (const field of fieldsConfig) {
      if (field.required && !payload[field.name]) {
        throw new BadRequestException(`Field "${field.label}" is required`);
      }
    }

    // 1. Record raw submission
    const submission = await this.prisma.formSubmission.create({
      data: {
        formId: form.id,
        ipAddress: ip,
        userAgent,
        payload: {
          ...payload,
          utm,
        },
      },
    });

    // 2. Extract standard contact fields
    const fullName = payload.name || payload.fullName || payload.full_name || 'Website Lead';
    const phone = payload.phone || payload.phoneNumber || payload.mobile || '+919999999999';
    const email = payload.email || null;
    const city = payload.city || null;

    // 3. Extract dynamic fields
    const dynamicFields = [];
    for (const field of fieldsConfig) {
      if (!['name', 'fullName', 'full_name', 'phone', 'phoneNumber', 'email'].includes(field.name)) {
        if (payload[field.name] !== undefined) {
          dynamicFields.push({
            fieldKey: field.name,
            fieldLabel: field.label,
            fieldValue: String(payload[field.name]),
            fieldType: field.type,
          });
        }
      }
    }

    // 4. Ingest into CRM Enquiry system
    const lead = await this.leadsService.ingestLead({
      organizationId: form.organizationId,
      fullName,
      phone,
      email,
      city,
      sourcePlatform: PlatformType.WEBSITE,
      campaignName: utm?.campaign || form.name,
      fieldValues: dynamicFields,
      initialNote: `Submitted via website form: "${form.name}" (UTM: ${JSON.stringify(utm || {})})`,
    });

    return {
      success: true,
      message: form.thankYouMessage,
      submissionId: submission.id,
      leadId: lead.id,
    };
  }
}
