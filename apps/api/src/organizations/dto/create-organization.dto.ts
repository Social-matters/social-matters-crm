import { IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrgType } from '@sm-crm/shared';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Jewelry Mart' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'jewelry-mart' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must only contain lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @ApiProperty({ enum: OrgType, default: OrgType.CLIENT })
  @IsEnum(OrgType)
  @IsOptional()
  type?: OrgType;

  @ApiProperty({ required: false })
  @IsOptional()
  settings?: Record<string, any>;
}

export class AssignAgencyManagerDto {
  @ApiProperty({ example: 'user-uuid' })
  @IsString()
  @IsNotEmpty()
  agencyUserId: string;
}
