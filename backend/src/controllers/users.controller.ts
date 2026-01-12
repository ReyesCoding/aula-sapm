import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs'; // 👈 IMPORTANTE: Asegúrate de tener esto instalado

// --- 1. LISTAR TODOS (Para el Panel de Gestión Admin) ---
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, 
        name: true, 
        email: true, 
        role: true, 
        isActive: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error listando usuarios' });
  }
};

// --- 2. CREAR USUARIO (Admin - CON SEGURIDAD BCRYPT) ---
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    
    // Validación simple
    if (!name || !email || !password || !role) {
      res.status(400).json({ message: 'Faltan campos obligatorios' });
      return;
    }

    // Verificar si existe
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      res.status(400).json({ message: 'El email ya está registrado' });
      return;
    }

    // 🔒 HASHING DE CONTRASEÑA (CRÍTICO PARA LOGIN)
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword, // Guardamos la versión encriptada
        role: role as RoleName,
        isActive: true
      }
    });

    // Devolvemos el usuario sin la contraseña por seguridad
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error creando usuario' });
  }
};

// --- 3. ELIMINAR USUARIO (Admin) ---
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const currentUserId = (req as any).user.userId; // Obtenemos quién está haciendo la petición

    // 🛡️ LÓGICA DE PROTECCIÓN
    if (Number(id) === currentUserId) {
      res.status(400).json({ message: 'No puedes eliminar tu propia cuenta de administrador mientras estás logueado.' });
      return;
    }

    // Verificar si el usuario existe antes de intentar borrar
    const userExists = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!userExists) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
    }

    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    console.error(error);
    // Verificar error de llave foránea (Si el usuario tiene cursos/tareas asociadas)
    // Prisma lanza código 'P2003' para violaciones de Foreign Key
    if ((error as any).code === 'P2003') {
        res.status(400).json({ message: 'No se puede eliminar: El usuario tiene datos asociados (Cursos, Tareas, etc.). Desactívalo en su lugar.' });
        return;
    }
    res.status(500).json({ error: 'Error eliminando usuario' });
  }
};

// --- 4. BUSCADOR (Para asignar en cursos - MANTENIDO DE TU CÓDIGO) ---
export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, query } = req.query;
    const whereCondition: any = { isActive: true };

    if (role) whereCondition.role = role as RoleName;
    if (query) {
      whereCondition.OR = [
        { name: { contains: String(query), mode: 'insensitive' } },
        { email: { contains: String(query), mode: 'insensitive' } }
      ];
    }

    const users = await prisma.user.findMany({
      where: whereCondition,
      select: { id: true, name: true, email: true, role: true },
      take: 20
    });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error buscando usuarios' });
  }
};

// --- 5. ACTUALIZAR ROL (Admin - MANTENIDO) ---
export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role } = req.body; 

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { role: role as RoleName }
    });

    res.json({ message: 'Rol actualizado', user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error actualizando rol' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { name, currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    const updateData: any = { name };

    // 🔐 LÓGICA DE ENCRIPTACIÓN
    if (newPassword && currentPassword) {
      // 1. Validar que la contraseña actual sea correcta (comparando con el hash de BD)
      // Nota: Si tu contraseña en BD está corrupta (texto plano), esto fallará y tendrás que resetear manual.
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      
      if (!isMatch) {
         res.status(400).json({ message: 'La contraseña actual es incorrecta.' });
         return;
      }

      // 2. ENCRIPTAR LA NUEVA (Aquí estaba el fallo antes)
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt); // 👈 Generar Hash
      
      updateData.password = hashedPassword; // Guardamos el Hash, no el texto
    } else if (newPassword && !currentPassword) {
        res.status(400).json({ message: 'Debes ingresar tu contraseña actual.' });
        return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
};

