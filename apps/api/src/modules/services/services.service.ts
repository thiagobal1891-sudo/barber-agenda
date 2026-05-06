import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, includeInactive = false) {
    return this.prisma.service.findMany({
      where: {
        tenantId,
        ...(!includeInactive && { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, tenantId },
    });
    if (!service) throw new NotFoundException(`Service ${id} not found`);
    return service;
  }

  async create(tenantId: string, dto: CreateServiceDto) {
    return this.prisma.service.create({
      data: { tenantId, ...dto },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateServiceDto) {
    await this.findOne(tenantId, id);
    return this.prisma.service.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
