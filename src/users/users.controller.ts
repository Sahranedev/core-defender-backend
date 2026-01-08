import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import type { User } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Post()
  create(@Body() user: User) {
    return this.usersService.create(user);
  }

  @Get(':id/profile')
  @UseGuards(AuthGuard)
  async getUserProfile(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      throw new NotFoundException('User not found');
    }

    const profile = await this.usersService.getUserProfile(userId);
    if (!profile) {
      throw new NotFoundException('User not found');
    }

    return profile;
  }
}
