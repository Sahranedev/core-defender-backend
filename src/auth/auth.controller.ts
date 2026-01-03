import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async signIn(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signIn(signInDto);
    res.cookie('jwt_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 2 * 60 * 60 * 1000, // 2 heures (aligné avec la durée du JWT)
    });
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('signup')
  signUp(@Body() signUpDto: SignupDto) {
    return this.authService.signUp(signUpDto);
  }
}
