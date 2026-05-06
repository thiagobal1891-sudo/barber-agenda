import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { CreateBookingDto } from './dto/booking.dto';
import { NotificationsService } from '../notifications/notifications.service';
import dayjs from 'dayjs';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll() {
    return this.prisma.booking.findMany({
      include: {
        barber: true,
        service: true,
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        barber: true,
        service: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    return booking;
  }

  async create(dto: CreateBookingDto) {
    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
    });

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const startTime = dayjs(dto.startTime);
    const endTime = startTime.add(service.durationMinutes, 'minute');

    // Check availability
    const overlapping = await this.prisma.booking.findFirst({
      where: {
        barberId: dto.barberId,
        OR: [
          {
            startTime: {
              lt: endTime.toDate(),
            },
            endTime: {
              gt: startTime.toDate(),
            },
          },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Time slot is already booked for this barber');
    }

    const booking = await this.prisma.booking.create({
      data: {
        clientName: dto.clientName,
        clientPhone: dto.clientPhone,
        clientEmail: dto.clientEmail,
        startTime: startTime.toDate(),
        endTime: endTime.toDate(),
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        notes: dto.notes,
      },
      include: {
        barber: true,
        service: true,
      },
    });

    // Send notification
    if (booking.clientEmail) {
      await this.notifications.sendBookingConfirmation(booking.clientEmail, {
        clientName: booking.clientName,
        barberName: booking.barber.name,
        serviceName: booking.service.name,
        date: dayjs(booking.startTime).format('DD/MM/YYYY'),
        time: dayjs(booking.startTime).format('HH:mm'),
      });
    }

    return booking;
  }

  async getAvailability(barberId: string, date: string) {
    const startOfDay = dayjs(date).startOf('day').set('hour', 9); // 09:00
    const endOfDay = dayjs(date).startOf('day').set('hour', 20); // 20:00
    
    const bookings = await this.prisma.booking.findMany({
      where: {
        barberId,
        startTime: {
          gte: startOfDay.toDate(),
          lt: dayjs(date).endOf('day').toDate(),
        },
      },
    });

    const slots = [];
    let current = startOfDay;

    while (current.isBefore(endOfDay)) {
      const slotEnd = current.add(30, 'minute');
      
      const isBooked = bookings.some(b => {
        const bStart = dayjs(b.startTime);
        const bEnd = dayjs(b.endTime);
        return current.isBefore(bEnd) && slotEnd.isAfter(bStart);
      });

      slots.push({
        time: current.format('HH:mm'),
        available: !isBooked,
      });

      current = slotEnd;
    }

    return slots;
  }
}
