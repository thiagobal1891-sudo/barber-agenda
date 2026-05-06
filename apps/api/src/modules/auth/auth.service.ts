import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from '../../common/utils/date.utils';
import { JwtPayload } from '../../@types/shared';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  // ── Register new tenant + admin user ───────────────────────────────────────

  async register(dto: RegisterDto) {
    // Check slug uniqueness
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (existingTenant) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create tenant + admin user in a single transaction
    const result = await this.prisma.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: dto.slug,
          name: dto.barbershopName,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'ADMIN',
        },
      });

      return { tenant, user };
    });

    this.logger.log(`New tenant registered: ${result.tenant.slug}`);

    const tokens = await this.generateTokens(result.user);
    return { user: this.sanitizeUser(result.user), ...tokens };
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email: dto.email } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);
    return { user: this.sanitizeUser(user), ...tokens };
  }

  // ── Refresh token ──────────────────────────────────────────────────────────

  async refreshTokens(dto: RefreshTokenDto) {
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: dto.refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Rotate refresh token (revoke old, issue new)
    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.generateTokens(storedToken.user);
    return tokens;
  }

  // ── Logout ─────────────────────────────────────────────────────────────────

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    });
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  private async generateTokens(user: { id: string; email: string; role: string; tenantId: string }) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.accessExpiration', '15m'),
    });

    const refreshToken = uuidv4();
    const refreshExpirationDays = 7;

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: addDays(new Date(), refreshExpirationDays),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // seconds
    };
  }

  private sanitizeUser(user: any) {
    const { passwordHash: _ph, ...safeUser } = user;
    return safeUser;
  }
}
