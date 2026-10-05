import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { OrgType, UserRole } from '@sm-crm/shared';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateOrganizationDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: createDto.slug },
    });
    if (existing) {
      throw new ConflictException(`Organization with slug "${createDto.slug}" already exists`);
    }

    return this.prisma.organization.create({
      data: {
        name: createDto.name,
        slug: createDto.slug,
        type: createDto.type || OrgType.CLIENT,
        settings: createDto.settings || {},
      },
    });
  }

  async findAll(user: AuthenticatedUser) {
    // Super admin can see all clients
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.prisma.organization.findMany({
        where: { type: OrgType.CLIENT },
        include: {
          _count: {
            select: {
              leads: true,
              users: true,
              campaigns: true,
              integrations: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Agency account managers can only see assigned clients
    if (user.role === UserRole.AGENCY_ACCOUNT_MANAGER) {
      const assignments = await this.prisma.clientAssignment.findMany({
        where: { agencyUserId: user.id },
        include: {
          client: {
            include: {
              _count: {
                select: {
                  leads: true,
                  users: true,
                  campaigns: true,
                  integrations: true,
                },
              },
            },
          },
        },
      });
      return assignments.map((a) => a.client);
    }

    // Client users can only see their own organization
    return this.prisma.organization.findMany({
      where: { id: user.organizationId },
      include: {
        _count: {
          select: {
            leads: true,
            users: true,
            campaigns: true,
            integrations: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    // Check permission to view this organization
    if (user.role !== UserRole.SUPER_ADMIN) {
      if (user.role === UserRole.AGENCY_ACCOUNT_MANAGER) {
        const assignment = await this.prisma.clientAssignment.findUnique({
          where: {
            agencyUserId_clientId: {
              agencyUserId: user.id,
              clientId: id,
            },
          },
        });
        if (!assignment) {
          throw new ForbiddenException('Access to this client organization is denied');
        }
      } else if (user.organizationId !== id) {
        throw new ForbiddenException('Access to this client organization is denied');
      }
    }

    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
        integrations: {
          select: {
            id: true,
            platform: true,
            status: true,
            accountName: true,
            lastSyncAt: true,
            errorMessage: true,
          },
        },
        _count: {
          select: {
            leads: true,
            contacts: true,
            campaigns: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async assignManager(clientId: string, agencyUserId: string) {
    const client = await this.prisma.organization.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Client organization not found');

    const agencyUser = await this.prisma.user.findUnique({
      where: { id: agencyUserId },
    });
    if (!agencyUser) throw new NotFoundException('Agency user not found');

    return this.prisma.clientAssignment.upsert({
      where: {
        agencyUserId_clientId: {
          agencyUserId,
          clientId,
        },
      },
      create: {
        agencyUserId,
        clientId,
      },
      update: {},
    });
  }
}
