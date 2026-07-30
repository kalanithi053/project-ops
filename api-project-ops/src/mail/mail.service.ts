import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { commentMentionEmailTemplate } from './templates/comment-mention-email.template';
import { otpEmailTemplate } from './templates/otp-email.template';
import { projectInviteEmailTemplate } from './templates/project-invite-email.template';
import { workItemNotificationEmailTemplate } from './templates/work-item-notification-email.template';
import { workspaceInviteEmailTemplate } from './templates/workspace-invite-email.template';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.getOrThrow<string>('MAIL_FROM');
    this.frontendUrl = this.config
      .get<string>('FRONTEND_REDIRECT_URL', 'http://localhost:4000')
      .replace(/\/$/, '');
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

  appUrl(path: string): string {
    return `${this.frontendUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async sendOtpEmail(
    to: string,
    code: string,
    ttlSeconds: number,
  ): Promise<void> {
    const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60));
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Your ProjectOps sign-in code',
      html: otpEmailTemplate(code, ttlMinutes),
    });
    this.logger.log(`OTP email sent to=${to} code=${code}`);
  }

  async sendProjectInviteEmail(
    to: string,
    params: { projectName: string; roleName: string },
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `You've been added to ${params.projectName}`,
      html: projectInviteEmailTemplate({
        ...params,
        loginUrl: `${this.frontendUrl}/login`,
      }),
    });
    this.logger.log(`Project invite email sent to=${to}`);
  }

  async sendWorkspaceInviteEmail(
    to: string,
    params: { workspaceName: string; roleName: string },
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `You've been added to ${params.workspaceName}`,
      html: workspaceInviteEmailTemplate({
        ...params,
        loginUrl: `${this.frontendUrl}/login`,
      }),
    });
    this.logger.log(`Workspace invite email sent to=${to}`);
  }

  async sendWorkItemNotificationEmail(
    to: string,
    params: {
      action: 'created' | 'updated' | 'reminder' | 'assigned';
      entityType: string;
      workItemName: string;
      projectName: string;
      actionUrl: string;
      /** Who reassigned it — only used for the 'assigned' action. */
      actorName?: string;
    },
  ): Promise<void> {
    const subject =
      params.action === 'reminder'
        ? `[${params.projectName}] Reminder: ${params.workItemName}`
        : params.action === 'assigned'
          ? `[${params.projectName}] You've been assigned ${params.workItemName}`
          : `[${params.projectName}] ${params.workItemName} ${params.action}`;
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html: workItemNotificationEmailTemplate(params),
    });
    this.logger.log(`Work item ${params.action} email sent to=${to}`);
  }

  async sendCommentMentionEmail(
    to: string,
    params: {
      authorName: string;
      workspaceName: string;
      body: string;
      actionUrl: string;
    },
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `${params.authorName} mentioned you in a comment`,
      html: commentMentionEmailTemplate(params),
    });
    this.logger.log(`Comment mention email sent to=${to}`);
  }
}
