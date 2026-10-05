import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export interface FormFieldDefinition {
  id: string;
  label: string;
  name: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'radio' | 'checkbox' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select, radio, checkbox
}

export class CreateFormDto {
  @ApiProperty({ example: 'org-uuid' })
  @IsString()
  @IsNotEmpty()
  organizationId: string;

  @ApiProperty({ example: 'Diwali Exhibition RSVP Form' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'diwali-rsvp-2026' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must contain only lowercase letters, numbers, and dashes',
  })
  slug: string;

  @ApiProperty({ example: 'Submit Enquiry' })
  @IsString()
  @IsOptional()
  submitButtonText?: string;

  @ApiProperty({ example: 'Thank you! Our relationship manager will connect shortly.' })
  @IsString()
  @IsOptional()
  thankYouMessage?: string;

  @ApiProperty({ type: [Object] })
  @IsArray()
  @IsNotEmpty()
  fieldsConfig: FormFieldDefinition[];
}

export class SubmitFormDto {
  @ApiProperty({ required: false })
  @IsOptional()
  payload?: Record<string, any>;

  @ApiProperty({ required: false })
  @IsOptional()
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };

  @ApiProperty({ required: false })
  @IsOptional()
  fullName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  utmSource?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  utmMedium?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  utmCampaign?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  customFields?: Record<string, any>;
}
