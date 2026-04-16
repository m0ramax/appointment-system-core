import { Injectable, ForbiddenException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  businessId: number | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? '',
    });
  }

  async validate(payload: JwtPayload) {
    if ((payload.role === 'OWNER' || payload.role === 'PROVIDER') && payload.businessId) {
      const business = await this.prisma.business.findUnique({
        where: { id: payload.businessId },
        select: { suspended: true },
      });
      if (business?.suspended) {
        throw new ForbiddenException('Este negocio ha sido suspendido');
      }
    }
    return { id: payload.sub, email: payload.email, role: payload.role, businessId: payload.businessId };
  }
}
