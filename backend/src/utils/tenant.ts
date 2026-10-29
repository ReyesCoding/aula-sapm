import { RoleName } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware';

/**
 * Error HTTP con statusCode, compatible con el errorHandler global
 * (backend/src/middlewares/error.middleware.ts ya sabe leer err.statusCode).
 */
export class HttpError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'HttpError';
  }
}

/**
 * Devuelve el educationalCenterId del usuario autenticado.
 * - ADMIN (rol de plataforma) -> null, sin restricción de centro.
 * - Cualquier otro rol sin centro asignado -> 403 (estado inconsistente,
 *   nunca debería pasar tras el backfill; se valida explícito para no
 *   dejar pasar un bug silencioso de datos).
 */
export function requireUserCenter(req: AuthRequest): number | null {
  const user = req.user;
  if (!user) {
    throw new HttpError(401, 'Usuario no autenticado');
  }
  if (user.role === RoleName.ADMIN) {
    return null;
  }
  if (user.educationalCenterId == null) {
    throw new HttpError(403, 'Tu usuario no tiene un centro educativo asignado');
  }
  return user.educationalCenterId;
}

/**
 * Verifica que un recurso (identificado por su educationalCenterId) pertenezca
 * al mismo centro que el usuario autenticado. ADMIN pasa siempre.
 * Úsalo en cada endpoint que lea/escriba un recurso tenant-scoped
 * (Subject, Assignment, Exam, etc.).
 */
export function assertSameCenter(req: AuthRequest, resourceCenterId: number | null | undefined): void {
  const userCenterId = requireUserCenter(req);
  if (userCenterId === null) return; // ADMIN
  if (resourceCenterId == null || resourceCenterId !== userCenterId) {
    throw new HttpError(403, 'No tienes acceso a este recurso: pertenece a otro centro educativo');
  }
}

/**
 * Filtro Prisma listo para usar en un `where`. Para ADMIN devuelve {} (sin filtro).
 * Ejemplo: prisma.subject.findMany({ where: { ...centerWhere(req) } })
 */
export function centerWhere(req: AuthRequest): { educationalCenterId?: number } {
  const userCenterId = requireUserCenter(req);
  return userCenterId === null ? {} : { educationalCenterId: userCenterId };
}
