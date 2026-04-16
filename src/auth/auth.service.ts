import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private platformSettings: PlatformSettingsService,
  ) {}

  async register(dto: RegisterDto) {
    return this.createUser(dto.email, dto.password, UserRole.CLIENT, null);
  }

  async registerOwner(dto: RegisterDto) {
    const settings = await this.platformSettings.getSettings();
    if (!settings.registrationEnabled) {
      throw new ForbiddenException('El registro está deshabilitado temporalmente');
    }
    return this.createUser(dto.email, dto.password, UserRole.OWNER, null);
  }

  async registerProvider(dto: RegisterDto, businessId: number) {
    return this.createUser(dto.email, dto.password, UserRole.PROVIDER, businessId);
  }

  async registerSuperAdmin(dto: RegisterDto, secret: string) {
    const expected = this.config.get<string>('SUPER_ADMIN_SECRET');
    if (!expected || secret !== expected) throw new ForbiddenException('Acceso denegado');
    return this.createUser(dto.email, dto.password, UserRole.SUPER_ADMIN, null);
  }

  private async createUser(email: string, password: string, role: UserRole, businessId: number | null) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, hashedPassword, role, businessId },
    });

    return this.signToken(user.id, user.email, user.role, user.businessId);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const valid = await bcrypt.compare(dto.password, user.hashedPassword);
    if (!valid) throw new UnauthorizedException('Credenciales inválidas');

    if ((user.role === 'OWNER' || user.role === 'PROVIDER') && user.businessId) {
      const business = await this.prisma.business.findUnique({
        where: { id: user.businessId },
        select: { suspended: true },
      });
      if (business?.suspended) {
        throw new ForbiddenException('Este negocio ha sido suspendido. Contacta al administrador de la plataforma.');
      }
    }

    return this.signToken(user.id, user.email, user.role, user.businessId);
  }

  private signToken(id: number, email: string, role: string, businessId: number | null) {
    return { access_token: this.jwt.sign({ sub: id, email, role, businessId }) };
  }
}
