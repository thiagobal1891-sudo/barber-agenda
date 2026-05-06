import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateBarberDto, UpdateBarberDto } from './dto/barber.dto';

@Injectable()
export class BarbersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.barber.findMany({
      where: { isActive: true },
      include: {
        services: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id },
      include: {
        services: true,
        bookings: true,
      },
    });

    if (!barber) {
      throw new NotFoundException(`Barber ${id} not found`);
    }

    return barber;
  }

  async create(dto: CreateBarberDto) {
    return this.prisma.barber.create({
      data: {
        name: dto.name,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
      },
    });
  }

  async update(id: string, dto: UpdateBarberDto) {
    await this.findOne(id);
    return this.prisma.barber.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.barber.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
