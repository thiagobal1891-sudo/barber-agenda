import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('sendgrid.apiKey');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    } else {
      this.logger.warn('SendGrid API key not provided. Emails will not be sent.');
    }

    this.fromEmail = this.configService.get<string>('sendgrid.fromEmail', 'noreply@barberos.app');
    this.fromName = this.configService.get<string>('sendgrid.fromName', 'BarberOS');
  }

  async sendEmail(
    tenantId: string,
    to: string,
    subject: string,
    html: string,
    appointmentId?: string,
    type: 'APPOINTMENT_CONFIRMATION' | 'APPOINTMENT_REMINDER_24H' | 'APPOINTMENT_CANCELLED' | 'PAYMENT_COMPLETED' = 'APPOINTMENT_CONFIRMATION',
  ) {
    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;

    try {
      if (this.configService.get<string>('sendgrid.apiKey')) {
        await sgMail.send({
          to,
          from: { email: this.fromEmail, name: this.fromName },
          subject,
          html,
        });
        this.logger.log(`Email sent to ${to} for tenant ${tenantId}`);
      } else {
        this.logger.debug(`[STUB] Email to ${to}: ${subject}`);
      }
    } catch (error: any) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      status = 'FAILED';
      errorMessage = error.message;
    }

    // Log the notification in DB
    await this.prisma.notification.create({
      data: {
        tenantId,
        appointmentId,
        channel: 'EMAIL',
        type,
        recipient: to,
        status,
        sentAt: status === 'SENT' ? new Date() : null,
        errorMessage,
      },
    });
  }

  async sendWhatsApp(
    tenantId: string,
    phone: string,
    message: string,
    appointmentId?: string,
    type: 'APPOINTMENT_CONFIRMATION' | 'APPOINTMENT_REMINDER_24H' | 'APPOINTMENT_CANCELLED' | 'PAYMENT_COMPLETED' = 'APPOINTMENT_CONFIRMATION',
  ) {
    let status: 'SENT' | 'FAILED' = 'SENT';
    let errorMessage: string | null = null;

    try {
      // In a real app, integrate with WhatsApp API (360dialog, Twilio, Meta)
      // For now, it's a stub
      this.logger.debug(`[STUB] WhatsApp to ${phone}: ${message}`);
    } catch (error: any) {
      status = 'FAILED';
      errorMessage = error.message;
    }

    await this.prisma.notification.create({
      data: {
        tenantId,
        appointmentId,
        channel: 'WHATSAPP',
        type,
        recipient: phone,
        status,
        sentAt: status === 'SENT' ? new Date() : null,
        errorMessage,
      },
    });
  }
}
