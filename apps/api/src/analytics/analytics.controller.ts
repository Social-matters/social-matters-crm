import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Analytics & Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'High-level aggregated KPIs, platform breakdown, and time-series trend' })
  async getOverview(
    @Query() filter: AnalyticsFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getOverview(filter, user);
  }

  @Get('campaigns')
  @ApiOperation({ summary: 'Hierarchical campaign performance drilldown (Campaign -> Ad Sets -> Ads) with ROAS' })
  async getCampaigns(
    @Query() filter: AnalyticsFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.analyticsService.getCampaigns(filter, user);
  }
}
