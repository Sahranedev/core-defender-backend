import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SignupDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  private readonly resend: Resend;
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async signIn(SignInDto: SignInDto) {
    const { email, password } = SignInDto;
    // Vérifier si l'utilisateur est déjà inscrit

    const user = await this.usersService.findByEmail(email);

    if (!user) throw new NotFoundException('User not found');
    // Comparer le mot de passe
    const match = await bcrypt.compare(password, user.password);
    if (!match) throw new BadRequestException('Password does not match');
    // Retourner un token jwt
    const payload = {
      sub: user.id,
      email: user.email,
    };
    const token = this.jwtService.sign(payload, {
      expiresIn: '2h',
      secret: this.configService.get('SECRET_KEY'),
    });
    return {
      token,
      userId: user.id,
    };
  }

  async signUp(SignUpDto: SignupDto) {
    const { email, password, firstname, lastname } = SignUpDto;
    const saltRound = 10;

    const user = await this.usersService.findByEmail(email);
    if (user) throw new UnauthorizedException('User already exists');

    const hashPassword = await bcrypt.hash(password, saltRound);

    const newUser = await this.usersService.create({
      email,
      password: hashPassword,
      firstname,
      lastname,
    });

    await this.sendVerificationEmail(email);

    return { data: 'User créer avec succès', newUser };
  }

  async sendVerificationEmail(email: string) {
    const token = Math.random().toString(36).substring(2, 15);
    await this.prisma.verificationToken.create({
      data: {
        email,
        token,
      },
    });
    await this.resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Vérification de votre email',
      html: `
        <p>Veuillez cliquer sur le lien suivant pour vérifier votre email:</p>
        <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}">Vérifier mon email</a>
      `,
    });

    return token;
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException('Le token est requis');
    }

    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
    });
    if (!verificationToken) throw new BadRequestException('Token invalide');

    const user = await this.usersService.findByEmail(verificationToken.email);
    if (!user) throw new BadRequestException('Email invalide');

    await this.prisma.user.update({
      where: { email: verificationToken.email },
      data: { isVerified: true },
    });
    await this.prisma.verificationToken.delete({
      where: { token },
    });
    const JWTToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
      },
      {
        expiresIn: '2h',
        secret: this.configService.get('SECRET_KEY'),
      },
    );
    return {
      token: JWTToken,
      userId: user.id,
      email: user.email,
    };
  }
}
