import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@sm-crm/shared';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto, creator: AuthenticatedUser) {
    // 1. Role creation authorization
    if (creator.role === UserRole.CLIENT_ADMIN) {
      // Client Admin can ONLY create Client Admin or Client Sales User in their own organization
      if (
        dto.role === UserRole.SUPER_ADMIN ||
        dto.role === UserRole.AGENCY_ACCOUNT_MANAGER
      ) {
        throw new ForbiddenException(
          'Client Admins cannot create agency level users',
        );
      }
      // Force organizationId to be the creator's organization
      dto.organizationId = creator.organizationId;
    } else if (creator.role === UserRole.SUPER_ADMIN) {
      if (!dto.organizationId) {
        dto.organizationId = creator.organizationId;
      }
    } else {
      throw new ForbiddenException('You do not have permission to create users');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        organizationId: dto.organizationId,
        customRoleId: dto.customRoleId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        organizationId: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findAll(user: AuthenticatedUser) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          organization: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Client Admin or Agency Account Manager sees users in their organization
    return this.prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
