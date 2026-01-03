import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import type { User } from '@prisma/client';

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
}
