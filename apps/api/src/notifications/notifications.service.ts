import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  title: string;
  message: string;
  type: 'NEW_LEAD' | 'FOLLOW_UP_DUE' | 'CONVERSION' | 'INTEGRATION_ERROR' | 'SYSTEM';
  entityId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const [unreadCount, notifications] = await Promise.all([
      this.prisma.notification.count({
        where: {
          userId: user.id,
          isRead: false,
        },
      }),
      this.prisma.notification.findMany({
        where: {
          userId: user.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      unreadCount,
      notifications,
    };
  }

  async markRead(id: string, user: AuthenticatedUser) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== user.id) {
      throw new ForbiddenException('Cannot modify notifications of other users');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllRead(user: AuthenticatedUser) {
    await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  }

  async createNotification(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        entityId: input.entityId,
      },
    });
  }

  /**
   * Broadcast notification to all managers/admins of an organization
   */
  async notifyOrganizationAdmins(
    organizationId: string,
    title: string,
    message: string,
    type: CreateNotificationInput['type'],
    entityId?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: { organizationId },
    });

    return Promise.all(
      users.map((u) =>
        this.createNotification({
          organizationId,
          userId: u.id,
          title,
          message,
          type,
          entityId,
        }),
      ),
    );
  }
}
