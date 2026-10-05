import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FormsService } from './forms.service';
import { CreateFormDto, SubmitFormDto } from './dto/create-form.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('Website Form Builder')
@Controller('api/v1/forms')
export class FormsController {
  constructor(private readonly formsService: FormsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create website form configuration' })
  async create(
    @Body() dto: CreateFormDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formsService.create(dto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List forms for organization' })
  async findAll(
    @Query('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.formsService.findAll(organizationId, user);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get public form schema for rendering' })
  async findBySlug(@Param('slug') slug: string) {
    return this.formsService.findBySlug(slug);
  }

  @Post(':slug/submit')
  @ApiOperation({ summary: 'Public form submission endpoint with UTM capture' })
  async submit(
    @Param('slug') slug: string,
    @Body() dto: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.formsService.submit(slug, dto, ip, userAgent);
  }
}
