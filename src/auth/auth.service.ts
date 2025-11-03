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

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async signIn(SignInDto: SignInDto) {
    const { email, password } = SignInDto;
    // Vérifier si l'utilisateur est déjà inscrit

    const user = await this.usersService.findByEmail(email);
    console.log(user);

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

    return { data: 'User créer avec succès', newUser };
  }
}
