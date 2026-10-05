import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { FollowUpStatus } from '@sm-crm/shared';

@ApiTags('Leads & Enquiries')
@Controller('api/v1/leads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('manual')
  @ApiOperation({ summary: 'Create a lead enquiry manually' })
  async createManual(
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // If client user, enforce organizationId
    if (user.organizationType === 'CLIENT') {
      dto.organizationId = user.organizationId;
    }
    return this.leadsService.ingestLead(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List leads with filters, search, and pagination' })
  async findAll(
    @Query() filter: LeadFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.findAll(filter, user);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export leads as CSV file' })
  async exportCsv(
    @Query() filter: LeadFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const csvContent = await this.leadsService.exportCsv(filter, user);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=leads-export-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    return res.send(csvContent);
  }

  @Get('follow-ups')
  @ApiOperation({ summary: 'List scheduled follow-ups' })
  async findFollowUps(
    @Query('status') status: FollowUpStatus,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.findFollowUps(status, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full lead details, contact history, and form responses' })
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.leadsService.findOne(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update lead status with audit history' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLeadStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.updateStatus(id, dto, user);
  }

  @Post(':id/notes')
  @ApiOperation({ summary: 'Add note to lead' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: AddLeadNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.addNote(id, dto, user);
  }

  @Post(':id/follow-ups')
  @ApiOperation({ summary: 'Schedule a follow-up' })
  async scheduleFollowUp(
    @Param('id') id: string,
    @Body() dto: ScheduleFollowUpDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.scheduleFollowUp(id, dto, user);
  }

  @Patch('follow-ups/:followUpId/status')
  @ApiOperation({ summary: 'Update follow-up status (e.g. mark COMPLETED)' })
  async updateFollowUpStatus(
    @Param('followUpId') followUpId: string,
    @Body() dto: UpdateFollowUpStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.updateFollowUpStatus(followUpId, dto, user);
  }

  @Post(':id/conversions')
  @ApiOperation({ summary: 'Record conversion with revenue and optional notes' })
  async recordConversion(
    @Param('id') id: string,
    @Body() dto: RecordConversionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.recordConversion(id, dto, user);
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assign lead to sales user (Client Admin only)' })
  async assignSalesUser(
    @Param('id') id: string,
    @Body() dto: AssignSalesUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadsService.assignSalesUser(id, dto, user);
  }
}
