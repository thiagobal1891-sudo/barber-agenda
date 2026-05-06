import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { ConfigService } from '@nestjs/config';
import { SetAvailabilityDto } from './dto/availability.dto';
import { addMinutes, parseTimeToMinutes } from '../../common/utils/date.utils';
import { SlotDto } from '@barberos/types';
import dayjs from 'dayjs';

@Injectable()
export class AvailabilityService {
  private readonly SLOT_TTL: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
  ) {
    this.SLOT_TTL = this.configService.get<number>('redis.ttl.slots', 300);
  }

  // ── Get available slots for a barber on a specific date ────────────────────
  // Cache key: slots:{barberId}:{date}
  async getSlots(tenantId: string, barberId: string, date: string): Promise<SlotDto[]> {
    // Validate date format
    if (!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
      throw new BadRequestException('Date must be in YYYY-MM-DD format');
    }

    const cacheKey = `slots:${barberId}:${date}`;
    const cached = await this.redis.getJson<SlotDto[]>(cacheKey);
    if (cached) return cached;

    // Verify barber belongs to tenant
    const barber = await this.prisma.barber.findFirst({
      where: { id: barberId, tenantId, isActive: true },
    });
    if (!barber) throw new NotFoundException(`Barber ${barberId} not found`);

    const slots = await this.generateSlots(barberId, date);

    await this.redis.setJson(cacheKey, slots, this.SLOT_TTL);
    return slots;
  }

  // ── Internal slot generation ───────────────────────────────────────────────
  private async generateSlots(barberId: string, date: string): Promise<SlotDto[]> {
    const targetDate = dayjs(date);
    const dayName = targetDate.format('dddd').toUpperCase() as any;

    // Get barber's availability for that day
    const availability = await this.prisma.availability.findUnique({
      where: { barberId_dayOfWeek: { barberId, dayOfWeek: dayName } },
    });

    if (!availability) return []; // barber doesn't work that day

    // Get barber's services to know slot duration options
    const barberServices = await this.prisma.barberService.findMany({
      where: { barberId },
      include: { service: true },
    });

    // Use minimum service duration as slot interval (typically 30 min)
    const slotIntervalMinutes = barberServices.length > 0
      ? Math.min(...barberServices.map((bs: any) => bs.service.durationMinutes))
      : 30;

    // Get existing appointments for that date
    const startOfDay = targetDate.startOf('day').toDate();
    const endOfDay = targetDate.endOf('day').toDate();

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        startTime: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ['CANCELLED'] },
      },
      select: { startTime: true, endTime: true },
    });

    // Generate time slots
    const slots: SlotDto[] = [];
    const availabilityStartMinutes = parseTimeToMinutes(availability.startTime);
    const availabilityEndMinutes = parseTimeToMinutes(availability.endTime);
    const now = dayjs();

    let currentMinutes = availabilityStartMinutes;
    while (currentMinutes + slotIntervalMinutes <= availabilityEndMinutes) {
      const slotStart = targetDate
        .startOf('day')
        .add(currentMinutes, 'minute')
        .toDate();
      const slotEnd = addMinutes(slotStart, slotIntervalMinutes);

      // Skip slots in the past
      const isPast = dayjs(slotStart).isBefore(now);

      // Check if slot overlaps with any existing appointment
      const isBooked = existingAppointments.some((appt: any) => {
        const apptStart = dayjs(appt.startTime);
        const apptEnd = dayjs(appt.endTime);
        const slotStartDj = dayjs(slotStart);
        const slotEndDj = dayjs(slotEnd);
        return slotStartDj.isBefore(apptEnd) && slotEndDj.isAfter(apptStart);
      });

      slots.push({
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        available: !isPast && !isBooked,
      });

      currentMinutes += slotIntervalMinutes;
    }

    return slots;
  }

  // ── Set weekly availability for a barber ───────────────────────────────────
  async setAvailability(
    tenantId: string,
    barberId: string,
    dto: SetAvailabilityDto,
  ) {
    const barber = await this.prisma.barber.findFirst({
      where: { id: barberId, tenantId },
    });
    if (!barber) throw new NotFoundException(`Barber ${barberId} not found`);

    // Validate start < end
    const startMins = parseTimeToMinutes(dto.startTime);
    const endMins = parseTimeToMinutes(dto.endTime);
    if (startMins >= endMins) {
      throw new BadRequestException('startTime must be before endTime');
    }

    const result = await this.prisma.availability.upsert({
      where: { barberId_dayOfWeek: { barberId, dayOfWeek: dto.dayOfWeek } },
      create: { barberId, ...dto },
      update: { startTime: dto.startTime, endTime: dto.endTime },
    });

    // Invalidate cache for next 14 days
    const today = dayjs();
    for (let i = 0; i < 14; i++) {
      const date = today.add(i, 'day').format('YYYY-MM-DD');
      await this.redis.del(`slots:${barberId}:${date}`);
    }

    return result;
  }

  // ── Invalidate slot cache for a specific date (called after booking) ───────
  async invalidateSlotsCache(barberId: string, date: string): Promise<void> {
    await this.redis.del(`slots:${barberId}:${date}`);
  }

  async getSchedule(tenantId: string, barberId: string) {
    const barber = await this.prisma.barber.findFirst({
      where: { id: barberId, tenantId },
    });
    if (!barber) throw new NotFoundException(`Barber ${barberId} not found`);

    return this.prisma.availability.findMany({
      where: { barberId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }
}
