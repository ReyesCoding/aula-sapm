import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { HttpError } from '../utils/tenant';
import { loadSubjectOrThrow } from '../services/forum.policy';
import { canManageSubjectMaterials, assertCanAccessSubjectMaterials } from '../services/document.policy';

// POST /api/documents/subjects/:subjectId   (multipart, campo "file")
// Sube un material de la materia (profesor dueño, o Centro/Admin).
export const uploadSubjectMaterial = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);
  const file = (req as Express.Request & { file?: Express.Multer.File }).file;

  if (!file) throw new HttpError(400, 'Debes adjuntar un archivo (campo "file")');

  const subject = await loadSubjectOrThrow(subjectId);
  if (!canManageSubjectMaterials(user, subject)) {
    throw new HttpError(403, 'No tienes permiso para subir material a esta materia');
  }

  const document = await prisma.document.create({
    data: {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: user.userId,
      subjectId: subject.id,
      educationalCenterId: subject.educationalCenterId,
    },
  });

  res.status(201).json(document);
});

// GET /api/documents/subjects/:subjectId
// Lista los materiales de una materia (quien tenga acceso al foro de esa materia: profesor dueño, estudiante ACTIVE, Centro/Admin).
export const listSubjectMaterials = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const subjectId = Number(req.params.subjectId);

  const subject = await loadSubjectOrThrow(subjectId);
  await assertCanAccessSubjectMaterials(user, subject);

  const documents = await prisma.document.findMany({
    where: { subjectId },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json(documents);
});

// DELETE /api/documents/:id
// Material de materia: quien puede administrar esa materia. Adjunto de mensaje: solo quien envió el mensaje.
export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const id = Number(req.params.id);

  const document = await prisma.document.findUnique({
    where: { id },
    include: { subject: true, message: true },
  });
  if (!document) throw new HttpError(404, 'Documento no encontrado');

  if (document.subjectId != null) {
    if (!document.subject || !canManageSubjectMaterials(user, document.subject)) {
      throw new HttpError(403, 'No tienes permiso para borrar este material');
    }
  } else if (document.messageId != null) {
    if (!document.message || document.message.senderId !== user.userId) {
      throw new HttpError(403, 'Solo quien envió el mensaje puede borrar su adjunto');
    }
  } else {
    throw new HttpError(500, 'Documento sin materia ni mensaje asociado');
  }

  await prisma.document.delete({ where: { id } });
  res.json({ message: 'Documento eliminado' });
});
