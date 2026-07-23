import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Thrown when a workspace action would exceed its plan quota.
 * Uses HTTP 402 Payment Required to distinguish quota limits from
 * authorization (403) failures.
 */
export class PlanLimitException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.PAYMENT_REQUIRED);
  }
}
