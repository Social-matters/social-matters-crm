import { IsEnum, IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { LeadStatus, PlatformType, FollowUpStatus } from '@sm-crm/shared';

export class LeadFilterDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ enum: PlatformType, required: false })
  @IsEnum(PlatformType)
  @IsOptional()
  sourcePlatform?: PlatformType;

  @ApiProperty({ enum: LeadStatus, required: false })
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  campaignId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @ApiProperty({ enum: FollowUpStatus, required: false })
  @IsEnum(FollowUpStatus)
  @IsOptional()
  followUpStatus?: FollowUpStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ default: 1, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @ApiProperty({ default: 20, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  @ApiProperty({ default: 'submittedAt', required: false })
  @IsString()
  @IsOptional()
  sortBy: string = 'submittedAt';

  @ApiProperty({ enum: ['asc', 'desc'], default: 'desc', required: false })
  @IsString()
  @IsOptional()
  sortOrder: 'asc' | 'desc' = 'desc';
}
