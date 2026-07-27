import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import type { Request } from 'express';

/**
 * Where uploaded files land. Overridable so a deployment can point at a
 * mounted volume instead of the working directory.
 */
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');

/** 10 MB — generous for docs, small enough to keep disk usage sane. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Creates the upload directory if it isn't there yet. */
export function ensureUploadDir(): void {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * multer writes `originalname` as latin1, so anything non-ASCII arrives
 * mojibaked. Re-decoding as UTF-8 restores the name the user actually picked.
 */
export function decodeOriginalName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8');
}

/**
 * Disk storage with randomised filenames.
 *
 * The name on disk is a fresh UUID rather than the uploaded one: it removes
 * any chance of path traversal via a crafted filename, and stops two people
 * uploading "report.pdf" from overwriting each other. The original name is
 * kept in the database and reattached on download.
 */
export const attachmentStorage = diskStorage({
  destination: (_req: Request, _file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file, cb) => {
    cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`);
  },
});
