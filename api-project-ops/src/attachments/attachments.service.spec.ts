import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../aws-s3/s3.service';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  const workspaceId = 'ws-1';
  const projectId = 'proj-1';
  const userId = 'user-1';
  const attachmentId = 'att-1';

  const project = {
    id: projectId,
    workspaceId,
    name: 'SaaSify - July 2026',
    deletedAt: null,
    workspace: { name: 'Amwhiz' },
  };

  const mockPrismaService = {
    project: { findFirst: jest.fn() },
    attachment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockActivityLog = { log: jest.fn() };

  const mockS3 = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
  };

  function makeAttachment(overrides: Record<string, unknown> = {}) {
    return {
      id: attachmentId,
      workspaceId,
      projectId,
      fileName: 'design.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      s3Key: `attachments/${workspaceId}/${projectId}/uuid-design.pdf`,
      uploadedBy: userId,
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
      uploader: { id: userId, email: 'user@test.com' },
      ...overrides,
    };
  }

  function makeFile(overrides: Partial<Express.Multer.File> = {}) {
    return {
      originalname: 'design.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('file bytes'),
      ...overrides,
    } as Express.Multer.File;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$transaction.mockImplementation((cb: any) =>
      cb(mockPrismaService),
    );

    const module = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: S3Service, useValue: mockS3 },
        { provide: ActivityLogService, useValue: mockActivityLog },
      ],
    }).compile();

    service = module.get(AttachmentsService);
  });

  describe('list', () => {
    it('returns attachments ordered newest first', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const attachments = [makeAttachment()];
      mockPrismaService.attachment.findMany.mockResolvedValue(attachments);

      const result = await service.list(workspaceId, projectId);

      expect(mockPrismaService.attachment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual(attachments);
    });

    it('throws NotFoundException when the project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(service.list(workspaceId, projectId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('uploads to S3, creates the row, and logs activity', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const created = makeAttachment();
      mockPrismaService.attachment.create.mockResolvedValue(created);
      const file = makeFile();

      const result = await service.create(workspaceId, projectId, userId, file);

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.stringContaining(
          `Amwhiz/SaaSify---July-2026-${projectId}/attachments/`,
        ),
        file.buffer,
        file.mimetype,
      );
      expect(mockPrismaService.attachment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workspaceId,
            projectId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            uploadedBy: userId,
          }),
        }),
      );
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId,
          projectId,
          entityType: 'project',
          entityId: projectId,
          action: 'attachment_added',
          userId,
        }),
        mockPrismaService,
      );
      expect(result).toEqual(created);
    });

    it('throws BadRequestException when no file is provided', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);

      await expect(
        service.create(workspaceId, projectId, userId, undefined),
      ).rejects.toThrow(BadRequestException);
      expect(mockS3.upload).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.create(workspaceId, projectId, userId, makeFile()),
      ).rejects.toThrow(NotFoundException);
      expect(mockS3.upload).not.toHaveBeenCalled();
    });
  });

  describe('download', () => {
    it('streams the object from S3', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const attachment = makeAttachment();
      mockPrismaService.attachment.findFirst.mockResolvedValue(attachment);
      const stream = {} as NodeJS.ReadableStream;
      mockS3.download.mockResolvedValue(stream);

      const result = await service.download(
        workspaceId,
        projectId,
        attachmentId,
      );

      expect(mockS3.download).toHaveBeenCalledWith(attachment.s3Key);
      expect(result).toEqual({ stream, attachment });
    });

    it('throws NotFoundException when the attachment does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      mockPrismaService.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.download(workspaceId, projectId, attachmentId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the S3 object and the row, and logs activity', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const attachment = makeAttachment();
      mockPrismaService.attachment.findFirst.mockResolvedValue(attachment);
      mockS3.delete.mockResolvedValue(undefined);

      const result = await service.remove(
        workspaceId,
        projectId,
        attachmentId,
        userId,
      );

      expect(mockS3.delete).toHaveBeenCalledWith(attachment.s3Key);
      expect(mockPrismaService.attachment.delete).toHaveBeenCalledWith({
        where: { id: attachmentId },
      });
      expect(mockActivityLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'attachment_deleted', userId }),
        mockPrismaService,
      );
      expect(result).toEqual({ id: attachmentId, deleted: true });
    });

    it('still deletes the row when the S3 delete fails', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(project);
      const attachment = makeAttachment();
      mockPrismaService.attachment.findFirst.mockResolvedValue(attachment);
      mockS3.delete.mockRejectedValue(new Error('network error'));

      const result = await service.remove(
        workspaceId,
        projectId,
        attachmentId,
        userId,
      );

      expect(mockPrismaService.attachment.delete).toHaveBeenCalledWith({
        where: { id: attachmentId },
      });
      expect(result).toEqual({ id: attachmentId, deleted: true });
    });
  });
});
