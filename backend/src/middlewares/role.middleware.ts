import { Request, Response, NextFunction } from 'express';
import { RoleName } from '@prisma/client';
import { AuthRequest } from './auth.middleware'; // 👈 Importamos la interfaz

export const authorizeRoles = (allowedRoles: RoleName[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    
    // ✅ Convertimos req a AuthRequest para que TS sepa que .user existe
    const authReq = req as AuthRequest;
    
    if (!authReq.user) {
      return res.status(401).json({ message: 'Usuario no autenticado' });
    }

    if (!allowedRoles.includes(authReq.user.role)) {
      return res.status(403).json({ 
        message: `Acceso prohibido. Requiere uno de los siguientes roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};