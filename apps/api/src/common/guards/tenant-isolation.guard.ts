import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '@sm-crm/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Super Admin has global access to all organizations
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Extract target organizationId from route params, query, or body
    const targetOrgId =
      request.params?.orgId ||
      request.params?.organizationId ||
      request.query?.orgId ||
      request.query?.organizationId ||
      request.body?.organizationId;

    // If no specific organization is targeted by the endpoint, proceed
    if (!targetOrgId) {
      return true;
    }

    // For Client Users (Client Admin, Client Sales User), org must strictly match their own
    if (user.role === UserRole.CLIENT_ADMIN || user.role === UserRole.CLIENT_SALES_USER) {
      if (user.organizationId !== targetOrgId) {
        throw new ForbiddenException(
          'Tenant isolation violation: Access to other client organizations is denied',
        );
      }
      return true;
    }

    // For Agency Account Managers, check if assigned to this client organization
    if (user.role === UserRole.AGENCY_ACCOUNT_MANAGER) {
      const assignment = await this.prisma.clientAssignment.findUnique({
        where: {
          agencyUserId_clientId: {
            agencyUserId: user.id,
            clientId: targetOrgId,
          },
        },
      });

      if (!assignment) {
        throw new ForbiddenException(
          'Tenant isolation violation: You are not assigned to this client organization',
        );
      }
      return true;
    }

    return false;
  }
}
