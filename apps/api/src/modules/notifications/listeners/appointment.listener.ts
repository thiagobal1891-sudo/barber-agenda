import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import { AppointmentCreatedEvent } from '../../events/appointment.events';
import dayjs from 'dayjs';
import 'dayjs/locale/es'; // assuming spanish for now, can be dynamic per tenant

@Injectable()
export class AppointmentListener {
  private readonly logger = new Logger(AppointmentListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {
    dayjs.locale('es');
  }

  @OnEvent('appointment.created', { async: true })
  async handleAppointmentCreatedEvent(event: AppointmentCreatedEvent) {
    this.logger.log(`Handling appointment.created for ${event.appointmentId}`);

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: event.appointmentId },
      include: {
        barber: true,
        service: true,
        client: true,
        tenant: true,
      },
    });

    if (!appointment) return;

    const dateStr = dayjs(appointment.startTime).format('dddd D [de] MMMM [a las] HH:mm');
    const msg = `Hola ${appointment.client.name}, tu turno para ${appointment.service.name} con ${appointment.barber.displayName} el ${dateStr} ha sido reservado.`;

    // Send WhatsApp (stub)
    if (appointment.client.phone) {
      await this.notificationsService.sendWhatsApp(
        event.tenantId,
        appointment.client.phone,
        msg,
        appointment.id,
        'APPOINTMENT_CONFIRMATION',
      );
    }

    // Send Email
    if (appointment.client.email) {
      const html = `
        <h2>Reserva Confirmada</h2>
        <p>Hola ${appointment.client.name},</p>
        <p>Tu turno en <strong>${appointment.tenant.name}</strong> ha sido confirmado.</p>
        <ul>
          <li><strong>Servicio:</strong> ${appointment.service.name}</li>
          <li><strong>Barbero:</strong> ${appointment.barber.displayName}</li>
          <li><strong>Fecha y Hora:</strong> ${dateStr}</li>
        </ul>
        <p>¡Te esperamos!</p>
      `;

      await this.notificationsService.sendEmail(
        event.tenantId,
        appointment.client.email,
        `Reserva confirmada en ${appointment.tenant.name}`,
        html,
        appointment.id,
        'APPOINTMENT_CONFIRMATION',
      );
    }
  }
}
