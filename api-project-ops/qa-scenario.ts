/**
 * Ad-hoc verification script for the comment/attachment cleanup feature.
 * Calls the real NestJS providers in-process (no HTTP, no JWT) so we can
 * exercise the exact business logic (CommentsService.cleanupDroppedAttachments)
 * without needing a bearer token.
 *
 * Usage: npx ts-node qa-scenario.ts <action> [...args]
 *   upload <filePath> <fileName> <inline: true|false>
 *   create-comment <bodyJson>
 *   edit-comment <commentId> <bodyJson>
 *   delete-comment <commentId>
 */
import 'reflect-metadata';
import * as fs from 'fs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AttachmentsService } from './src/attachments/attachments.service';
import { CommentsService } from './src/comments/comments.service';

const WORKSPACE_ID = 'e2869ca1-b0ba-4def-8968-07b5ac4ddf17';
const PROJECT_ID = '59dfae6c-2536-430a-9059-8a25fc8d80c1';
const WORK_ITEM_ID = 'a5c2813f-5fb0-456d-8b4e-4f35a6baaee4';
const USER_ID = '8b606d6a-6c7f-4209-94ff-e8aab0def774';

function makeMulterFile(path: string, name: string): Express.Multer.File {
  const buffer = fs.readFileSync(path);
  return {
    fieldname: 'file',
    originalname: name,
    encoding: '7bit',
    mimetype: 'image/png',
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as unknown as NodeJS.ReadableStream,
  } as Express.Multer.File;
}

async function main() {
  const [action, ...rest] = process.argv.slice(2);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const attachments = app.get(AttachmentsService);
    const comments = app.get(CommentsService);

    switch (action) {
      case 'upload': {
        const [filePath, fileName, inlineStr] = rest;
        const file = makeMulterFile(filePath, fileName);
        const result = await attachments.create(
          WORKSPACE_ID,
          PROJECT_ID,
          USER_ID,
          file,
          WORK_ITEM_ID,
          inlineStr === 'true',
        );
        console.log(JSON.stringify(result));
        break;
      }
      case 'create-comment': {
        const [bodyJson] = rest;
        const body = JSON.parse(bodyJson) as string;
        const result = await comments.createForWorkItem(
          WORKSPACE_ID,
          PROJECT_ID,
          WORK_ITEM_ID,
          USER_ID,
          { body },
        );
        console.log(JSON.stringify(result));
        break;
      }
      case 'edit-comment': {
        const [commentId, bodyJson] = rest;
        const body = JSON.parse(bodyJson) as string;
        const result = await comments.updateForWorkItem(
          WORKSPACE_ID,
          PROJECT_ID,
          WORK_ITEM_ID,
          commentId,
          USER_ID,
          { body },
        );
        console.log(JSON.stringify(result));
        break;
      }
      case 'delete-comment': {
        const [commentId] = rest;
        const result = await comments.removeForWorkItem(
          WORKSPACE_ID,
          PROJECT_ID,
          WORK_ITEM_ID,
          commentId,
          USER_ID,
        );
        console.log(JSON.stringify(result));
        break;
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } finally {
    await app.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SCRIPT_ERROR', err?.message ?? err);
    process.exit(1);
  });
