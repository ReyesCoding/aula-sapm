import { Request, Response } from 'express';
import prisma from '../prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

// Esquema de validación estricto
const loginSchema = z.object({
  email: z.string().email({ message: "Formato de email inválido" }),
  password: z.string().min(6, { message: "La contraseña debe tener al menos 6 caracteres" }),
});

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Validar input
    const { email, password } = loginSchema.parse(req.body);

    // 2. Buscar usuario
    const user = await prisma.user.findUnique({ where: { email } });
    
    // Fail-safe: Mensaje genérico para no revelar si el email existe o no
    if (!user) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return; 
    }

    // 3. Verificar contraseña
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      res.status(401).json({ message: 'Credenciales inválidas' });
      return; 
    }

    // 4. Validar configuración de entorno
    if (!process.env.JWT_SECRET) {
      console.error("CRITICAL: JWT_SECRET no está definido en las variables de entorno.");
      res.status(500).json({ message: 'Error de configuración del servidor' });
      return;
    }

    // 5. Generar Token
    const token = jwt.sign(
      { userId: user.id, role: user.role, email: user.email, educationalCenterId: user.educationalCenterId },
      process.env.JWT_SECRET, 
      { expiresIn: '1d' } 
    );

    // 6. Responder
    res.json({
      message: 'Bienvenido',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        educationalCenterId: user.educationalCenterId,
      },
    });

  } catch (error) {
    // Manejo de errores de validación (Zod)
    if (error instanceof z.ZodError) {
      const errorDetails = error.issues.map(issue => ({
            field: issue.path[0],
            message: issue.message
      }));
      
      res.status(400).json({ 
        message: 'Datos de entrada inválidos', 
        errors: errorDetails
      });
      return;
    }

    console.error('Login Error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};