import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger';

type HttpError = Error & {
  statusCode?: number;
  status?: number;           // <— NUEVO: soporta .status
  code?: string; // p.ej. Prisma P20xx
  details?: unknown;
};

export function errorHandler(err: HttpError, req: Request, res: Response, _next: NextFunction) {
  // Prisma: mapeos útiles
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      logger.error('[P2002]', err.meta);
      return res.status(409).json({
        message: 'Conflicto',
        error: 'Registro duplicado (violación de unicidad)',
        meta: err.meta,
      });
    }
    if (err.code === 'P2025') {
      logger.error('[P2025]', err.meta);
      return res.status(404).json({
        message: 'No encontrado',
        error: 'No se encontró el registro solicitado',
      });
    }
    logger.error(`[${err.code}]`, err.message);
    return res.status(400).json({
      message: 'Error de validación',
      error: err.message,
    });
  }

  // Prisma: validation error genérica -> 400
  if (err instanceof Prisma.PrismaClientValidationError) {
    logger.error('[VALIDATION]', err.message);
    return res.status(400).json({ message: 'Error de validación', error: err.message });
  }

  // Errores con status/statusCode seteado por helpers (assertRole, requireIntId, etc.)
  const code = (typeof err.status === 'number' ? err.status : err.statusCode);
  if (typeof code === 'number') {
    logger.error(`[${code}] ${req.method} ${req.originalUrl}`, err.message);
    return res.status(code).json({
      message: code >= 500 ? 'Error interno' : 'Validación',
      error: err.message,
    });
  }

  // JSON parse error (body inválido)
  if (err instanceof SyntaxError && 'body' in err) {
    logger.error('[JSON]', err.message);
    return res.status(400).json({ message: 'Validación', error: 'JSON inválido en el cuerpo de la solicitud' });
  }

  // Fallback 500
  logger.error(`[500] ${req.method} ${req.originalUrl}`, err.message, err.stack);
  return res.status(500).json({ message: 'Error interno', error: 'Ocurrió un error inesperado' });
}
