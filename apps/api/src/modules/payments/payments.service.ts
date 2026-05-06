import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import Stripe from 'stripe';
import { MercadoPagoConfig, Preference } from 'mercadopago';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe;
  private mpClient: MercadoPagoConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const stripeKey = this.configService.get<string>('payment.stripe.secretKey');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2025-02-24.acacia' as any });
    }

    const mpToken = this.configService.get<string>('payment.mercadopago.accessToken');
    if (mpToken) {
      this.mpClient = new MercadoPagoConfig({ accessToken: mpToken });
    }
  }

  // ── Checkout URL Generation (MercadoPago example) ────────────────────────
  async createMercadoPagoPreference(tenantId: string, appointmentId: string) {
    if (!this.mpClient) throw new BadRequestException('MercadoPago not configured');

    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { service: true, payment: true },
    });

    if (!appointment || !appointment.payment) {
      throw new NotFoundException('Appointment or payment record not found');
    }

    const appUrl = this.configService.get<string>('app.frontendUrl');
    const preference = new Preference(this.mpClient);

    const result = await preference.create({
      body: {
        items: [
          {
            id: appointment.serviceId,
            title: appointment.service.name,
            quantity: 1,
            unit_price: Number(appointment.service.price),
            currency_id: appointment.payment.currency,
          },
        ],
        external_reference: appointment.payment.id,
        back_urls: {
          success: `${appUrl}/${tenantId}/book/success?appointmentId=${appointment.id}`,
          failure: `${appUrl}/${tenantId}/book/failure`,
          pending: `${appUrl}/${tenantId}/book/pending`,
        },
        auto_return: 'approved',
        notification_url: `${this.configService.get('app.url')}/api/v1/payments/webhook/mercadopago`,
      },
    });

    await this.prisma.payment.update({
      where: { id: appointment.payment.id },
      data: { gateway: 'MERCADOPAGO', gatewayCheckoutUrl: result.init_point },
    });

    return { checkoutUrl: result.init_point };
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────
  async handleMercadoPagoWebhook(body: any, signature: string) {
    // In production, verify signature (x-signature header)
    this.logger.log(`Received MP Webhook: ${JSON.stringify(body)}`);

    if (body.type === 'payment' && body.data?.id) {
      // Fetch full payment info from MP
      // For now, assume it's approved for demonstration
      // const paymentInfo = await new Payment(this.mpClient).get({ id: body.data.id });
      // const paymentId = paymentInfo.external_reference;

      // Stub:
      this.logger.debug('Updating payment to COMPLETED');
      // In a real flow, extract external_reference
    }

    return { received: true };
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    const secret = this.configService.get<string>('payment.stripe.webhookSecret');
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, secret!);
    } catch (err: any) {
      this.logger.error(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException('Invalid signature');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const paymentId = session.client_reference_id;

      if (paymentId) {
        await this.prisma.payment.update({
          where: { id: paymentId },
          data: { status: 'COMPLETED', paidAt: new Date() },
        });
        this.logger.log(`Payment ${paymentId} completed via Stripe`);
      }
    }

    return { received: true };
  }

  // ── Manual Payment (Cash) ─────────────────────────────────────────────────
  async completeManualPayment(tenantId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: { payment: true },
    });

    if (!appointment || !appointment.payment) throw new NotFoundException();

    return this.prisma.payment.update({
      where: { id: appointment.payment.id },
      data: {
        status: 'COMPLETED',
        gateway: 'CASH',
        paidAt: new Date(),
      },
    });
  }
}
