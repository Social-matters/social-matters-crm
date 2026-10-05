import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LeadStatus, PlatformType, FollowUpStatus } from '@sm-crm/shared';

export class DynamicFieldValueDto {
  @ApiProperty({ example: 'budget' })
  @IsString()
  @IsNotEmpty()
  fieldKey: string;

  @ApiProperty({ example: 'What is your budget?' })
  @IsString()
  @IsNotEmpty()
  fieldLabel: string;

  @ApiProperty({ example: '100000' })
  @IsString()
  @IsNotEmpty()
  fieldValue: string;

  @ApiProperty({ example: 'text', required: false })
  @IsString()
  @IsOptional()
  fieldType?: string;
}

export class CreateLeadDto {
  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'Rahul Reddy' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: 'rahul@example.com', required: false })
  @IsString()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'Hyderabad', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ enum: PlatformType, default: PlatformType.MANUAL })
  @IsEnum(PlatformType)
  sourcePlatform: PlatformType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  externalLeadId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  campaignName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  adSetName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  adName?: string;

  @ApiProperty({ type: [DynamicFieldValueDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DynamicFieldValueDto)
  @IsOptional()
  fieldValues?: DynamicFieldValueDto[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  initialNote?: string;
}

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  status: LeadStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddLeadNoteDto {
  @ApiProperty({ example: 'Spoke with client, interested in solitaire rings.' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ScheduleFollowUpDto {
  @ApiProperty({ example: '2026-10-05T14:30:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiProperty({ example: 'Call regarding wedding catalogue confirmation' })
  @IsString()
  @IsOptional()
  reminderNote?: string;
}

export class UpdateFollowUpStatusDto {
  @ApiProperty({ enum: FollowUpStatus })
  @IsEnum(FollowUpStatus)
  status: FollowUpStatus;
}

export class RecordConversionDto {
  @ApiProperty({ example: 85000.0 })
  @IsNumber()
  value: number;

  @ApiProperty({ example: 'Purchased 18k diamond pendant necklace' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ example: '2026-10-01T12:00:00Z', required: false })
  @IsDateString()
  @IsOptional()
  conversionDate?: string;
}

export class AssignSalesUserDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  assignedUserId: string;
}
