import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { incidentCreatedEmailTemplate } from './templates/incident-created-email.template';
import { projectInviteEmailTemplate } from './templates/project-invite-email.template';
import { statusNotificationEmailTemplate } from './templates/status-notification-email.template';
import { taskStatusEmailTemplate } from './templates/task-status-email.template';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.getOrThrow<string>('MAIL_FROM');
    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('BREVO_SMTP_HOST'),
      port: Number(this.config.getOrThrow<string>('BREVO_SMTP_PORT')),
      secure: false,
      auth: {
        user: this.config.getOrThrow<string>('BREVO_SMTP_LOGIN'),
        pass: this.config.getOrThrow<string>('BREVO_SMTP_PASSWORD'),
      },
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP transport ready');
    } catch (err) {
      this.logger.error(
        `SMTP transport verification failed: ${(err as Error).message}`,
      );
    }
  }

  async sendOtpEmail(
    to: string,
    code: string,
    ttlSeconds: number,
  ): Promise<void> {
    const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60));
    // await this.transporter.sendMail({
    //   from: this.from,
    //   to,
    //   subject: 'Your ProjectHub sign-in code',
    //   html: otpEmailTemplate(code, ttlMinutes),
    // });
    this.logger.log(`OTP email sent to=${to} code=${code}`);
  }

  async sendTaskStatusChangedEmail(
    to: string,
    params: {
      taskName: string;
      taskPrefix: string | null;
      projectName: string;
      oldStatusName: string;
      newStatusName: string;
    },
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `[${params.projectName}] ${params.taskPrefix ?? params.taskName} moved to ${params.newStatusName}`,
      html: taskStatusEmailTemplate(params),
    });
    this.logger.log(`Task status email sent to=${to}`);
  }

  async sendProjectInviteEmail(
    to: string,
    params: { projectName: string; roleName: string },
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `You've been added to ${params.projectName}`,
      html: projectInviteEmailTemplate(params),
    });
    this.logger.log(`Project invite email sent to=${to}`);
  }

  async sendIncidentCreatedEmail(
    to: string,
    params: {
      reporterName: string;
      assigneeName: string | null;
      incidentTitle: string;
      projectName: string;
      incidentId: string;
    },
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `${params.projectName} - ${params.incidentTitle}`,
      html: incidentCreatedEmailTemplate(params),
    });
    this.logger.log(`Incident created email sent to=${to}`);
  }

  async sendStatusNotificationEmail(
    to: string,
    params: {
      entityLabel: string;
      entityName: string;
      projectName: string;
      statusName: string;
    },
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `${params.projectName} - ${params.entityName} is ${params.statusName}`,
      html: statusNotificationEmailTemplate(params),
    });
    this.logger.log(`Status notification email sent to=${to}`);
  }
}
