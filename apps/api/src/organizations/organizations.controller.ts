import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, AssignAgencyManagerDto } from './dto/create-organization.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@sm-crm/shared';

@ApiTags('Organizations')
@Controller('api/v1/organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new client organization (Super Admin only)' })
  async create(@Body() createDto: CreateOrganizationDto) {
    return this.organizationsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List accessible organizations' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific organization' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.organizationsService.findOne(id, user);
  }

  @Post(':id/assign')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Assign an agency account manager to a client' })
  async assignManager(
    @Param('id') clientId: string,
    @Body() dto: AssignAgencyManagerDto,
  ) {
    return this.organizationsService.assignManager(clientId, dto.agencyUserId);
  }
}
