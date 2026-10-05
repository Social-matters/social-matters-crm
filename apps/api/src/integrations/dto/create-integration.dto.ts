import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PlatformType, IntegrationStatus } from '@sm-crm/shared';

export class ConnectIntegrationDto {
  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ enum: PlatformType })
  @IsEnum(PlatformType)
  platform: PlatformType;

  @ApiProperty({ example: 'Aura Fine Jewelry - Meta Page' })
  @IsString()
  @IsNotEmpty()
  accountName: string;

  @ApiProperty({ example: 'act_10293849102', required: false })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiProperty({ example: 'EAABwzL...', required: false })
  @IsString()
  @IsOptional()
  accessToken?: string;
}

export class MetaWebhookQueryDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  'hub.mode'?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  'hub.challenge'?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  'hub.verify_token'?: string;
}
