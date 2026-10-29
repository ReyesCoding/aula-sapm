import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RoleName } from '@prisma/client';

// ✅ Definimos la interfaz aquí mismo para evitar errores de compilación
export interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: RoleName;
    // v2.0: null solo para ADMIN (rol de plataforma, no pertenece a un centro)
    educationalCenterId: number | null;
  };
}

// 1. VERIFICAR TOKEN (Autenticación)
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Acceso denegado: Token no proporcionado' });
  }

  const secret = process.env.JWT_SECRET || 'secret_super_seguro';

  jwt.verify(token, secret, (err: any, decoded: any) => {
    if (err) {
      // 401, no 403: token inválido/expirado significa "no autenticado", no
      // "autenticado pero sin permiso". El interceptor del frontend decide
      // si cierra sesión basándose en este código - si esto fuera 403 se
      // confundiría con un 403 legítimo de autorización (p.ej. sin centro
      // asignado) y cerraría sesión por un error que no tiene nada que ver
      // con el token.
      return res.status(401).json({ message: 'Token inválido o expirado' });
    }

    // ✅ Inyectamos el usuario en la request
    (req as AuthRequest).user = {
      userId: Number(decoded.userId),
      role: decoded.role as RoleName,
      educationalCenterId: decoded.educationalCenterId != null ? Number(decoded.educationalCenterId) : null
    };

    next();
  });
};

// 2. VERIFICAR ROL (Autorización) 👇 ESTA ES LA QUE FALTABA
export const authorizeRoles = (allowedRoles: RoleName[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).user;

    if (!user) {
       return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    // Si el rol del usuario NO está en la lista de permitidos
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        message: `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};