import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@sm-crm/shared';

@ApiTags('Users')
@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CLIENT_ADMIN)
  @ApiOperation({ summary: 'Create user (Super Admin or Client Admin)' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() creator: AuthenticatedUser,
  ) {
    return this.usersService.create(dto, creator);
  }

  @Get()
  @ApiOperation({ summary: 'List users permitted by role' })
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(user);
  }
}
