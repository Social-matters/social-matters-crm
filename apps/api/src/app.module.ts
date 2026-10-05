import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { LeadsModule } from './leads/leads.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { FormsModule } from './forms/forms.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CommonModule } from './common/common.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    CommonModule,
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    LeadsModule,
    IntegrationsModule,
    FormsModule,
    AnalyticsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
