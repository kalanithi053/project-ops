import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';

/**
 * Thin wrapper around the S3 client used for project attachments.
 *
 * AWS_* env vars are read with a plain `get` rather than `getOrThrow` (unlike
 * MailService's SMTP config) — the bucket is provisioned manually after this
 * code ships (see docs/aws-s3-setup.md), so failing every route that needs
 * S3 with a clear error is preferable to crashing the whole app at boot over
 * one not-yet-configured feature.
 */
@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(config: ConfigService) {
    const region = config.get<string>('AWS_REGION');
    const bucket = config.get<string>('AWS_S3_BUCKET');
    const accessKeyId = config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (region && bucket && accessKeyId && secretAccessKey) {
      this.bucket = bucket;
      this.client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.client = null;
      this.logger.warn(
        'AWS_REGION/AWS_S3_BUCKET/AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY are not fully set — ' +
          'attachment uploads/downloads will fail until configured. See docs/aws-s3-setup.md.',
      );
    }
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    await this.run(() =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      ),
    );
  }

  /** Returns the object's bytes as a Node stream, for piping straight into the HTTP response. */
  async download(key: string): Promise<Readable> {
    const { client, bucket } = this.requireClient();
    const result = await this.run(() =>
      client.send(new GetObjectCommand({ Bucket: bucket, Key: key })),
    );
    return result.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = this.requireClient();
    await this.run(() =>
      client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })),
    );
  }

  private requireClient(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket) {
      throw new ServiceUnavailableException(
        'File storage is not configured on this server yet.',
      );
    }
    return { client: this.client, bucket: this.bucket };
  }

  /**
   * Runs an S3 SDK call, translating any failure (bad credentials, wrong
   * bucket/region, network error, ...) into a clean, actionable error
   * instead of letting the AWS SDK's own exception — full of internal
   * request/retry metadata — bubble up as an opaque 500.
   */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(
        `S3 request failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new ServiceUnavailableException(
        'File storage is unreachable — check the AWS_* configuration. See docs/aws-s3-setup.md.',
      );
    }
  }
}
