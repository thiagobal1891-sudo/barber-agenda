import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { CreateAppointmentDto } from './dto/appointment.dto';
import { AppointmentCreatedEvent } from '../events/appointment.events';
import { addMinutes } from '../../common/utils/date.utils';
import dayjs from 'dayjs';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string) {
    return this.prisma.appointment.findMany({
      where: { tenantId },
      include: {
        barber: { select: { displayName: true } },
        service: { select: { name: true, price: true } },
        client: { select: { name: true, phone: true } },
        payment: true,
      },
      orderBy: { startTime: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        barber: true,
        service: true,
        client: true,
        payment: true,
      },
    });
    if (!appointment) throw new NotFoundException(`Appointment ${id} not found`);
    return appointment;
  }

  async create(tenantId: string, dto: CreateAppointmentDto) {
    // 1. Verify service belongs to tenant
    const service = await this.prisma.service.findFirst({
      where: { id: dto.serviceId, tenantId, isActive: true },
    });
    if (!service) throw new NotFoundException('Service not found or inactive');

    // 2. Verify barber belongs to tenant and offers the service
    const barberService = await this.prisma.barberService.findFirst({
      where: {
        barberId: dto.barberId,
        serviceId: dto.serviceId,
        barber: { tenantId, isActive: true },
      },
    });
    if (!barberService) {
      throw new BadRequestException('Barber does not offer this service');
    }

    const startTime = new Date(dto.startTime);
    if (isNaN(startTime.getTime())) {
      throw new BadRequestException('Invalid start time');
    }
    const endTime = addMinutes(startTime, service.durationMinutes);
    const dateStr = dayjs(startTime).format('YYYY-MM-DD');

    // 3. Begin Transaction for booking
    const appointment = await this.prisma.$transaction(async (tx: any) => {
      // Upsert client
      const client = await tx.client.upsert({
        where: { tenantId_phone: { tenantId, phone: dto.clientPhone } },
        create: {
          tenantId,
          name: dto.clientName,
          phone: dto.clientPhone,
          email: dto.clientEmail,
        },
        update: {
          name: dto.clientName,
          email: dto.clientEmail, // update if provided
        },
      });

      // Prevent double booking with isolation / unique constraint
      // Prisma's unique constraint @@unique([barberId, startTime]) on Appointment
      // will throw an exception if another appointment exists at the same exact start time.
      // However, we also need to check for overlapping intervals.
      const overlapping = await tx.appointment.findFirst({
        where: {
          barberId: dto.barberId,
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          OR: [
            { startTime: { lt: endTime }, endTime: { gt: startTime } },
          ],
        },
      });

      if (overlapping) {
        throw new ConflictException('This time slot is already booked');
      }

      // Create Appointment
      const newAppointment = await tx.appointment.create({
        data: {
          tenantId,
          barberId: dto.barberId,
          serviceId: dto.serviceId,
          clientId: client.id,
          startTime,
          endTime,
          notes: dto.notes,
        },
      });

      // Create Payment entry (PENDING)
      await tx.payment.create({
        data: {
          tenantId,
          appointmentId: newAppointment.id,
          amount: service.price,
        },
      });

      return newAppointment;
    });

    // 4. Invalidate availability cache for that date
    await this.availabilityService.invalidateSlotsCache(dto.barberId, dateStr);

    // 5. Emit Event for notifications and async tasks
    this.eventEmitter.emit(
      'appointment.created',
      new AppointmentCreatedEvent(appointment.id, tenantId),
    );

    return appointment;
  }

  async cancel(tenantId: string, id: string) {
    const appointment = await this.findOne(tenantId, id);

    if (appointment.status === 'CANCELLED') {
      throw new BadRequestException('Appointment is already cancelled');
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Invalidate cache
    const dateStr = dayjs(appointment.startTime).format('YYYY-MM-DD');
    await this.availabilityService.invalidateSlotsCache(appointment.barberId, dateStr);

    // Optional: emit event 'appointment.cancelled'

    return updated;
  }

  async complete(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });
  }
}
