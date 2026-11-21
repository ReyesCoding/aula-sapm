import { Request, Response } from 'express';
import prisma from '../prisma/client';
import { RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs'; // 👈 IMPORTANTE: Asegúrate de tener esto instalado
import { AuthRequest } from '../middlewares/auth.middleware';
import { centerWhere } from '../utils/tenant';

// --- 1. LISTAR (Panel de Gestión) ---
// v3.0 (nov. 2026): antes este endpoint devolvía TODOS los usuarios de
// TODOS los centros a cualquiera que pudiera llamarlo (solo Admin podía,
// por la ruta, pero sin ningún filtro adentro). Ahora también lo usa
// Centro para gestionar a SU PROPIO profesorado (nunca estudiantes/padres
// de otros centros, y nunca cuentas CENTRO/ADMIN) — ver razonamiento en
// CODE_REVIEW.md sección 10.6: Centro administra personal, no alumnado.
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = (req as AuthRequest).user!;
    const where =
      actor.role === RoleName.CENTRO
        ? { educationalCenterId: actor.educationalCenterId, role: RoleName.TEACHER }
        : {};

    const users = await prisma.user.findMany({
      where,
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
    res.status(500).json({ message: 'Error listando usuarios' });
  }
};

// --- 2. CREAR USUARIO (Admin: cualquier rol/centro. Centro: SOLO
// profesores de su propio centro — ver nota de getAllUsers) ---
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = (req as AuthRequest).user!;
    const { name, email, password } = req.body;
    let { role, educationalCenterId } = req.body as { role?: RoleName; educationalCenterId?: number };

    // v3.0: si quien crea es Centro, no confiamos en lo que mande el body
    // para role/educationalCenterId — se fuerzan server-side, igual que ya
    // se hacía en subject.controller.ts::createSubject para el mismo rol.
    if (actor.role === RoleName.CENTRO) {
      role = RoleName.TEACHER;
      educationalCenterId = actor.educationalCenterId ?? undefined;
    }

    // Validación simple
    if (!name || !email || !password || !role) {
      res.status(400).json({ message: 'Faltan campos obligatorios' });
      return;
    }

    // v2.0: todo rol que no sea ADMIN debe pertenecer a un centro educativo
    if (role !== RoleName.ADMIN && !educationalCenterId) {
      res.status(400).json({ message: 'educationalCenterId es obligatorio para roles distintos de ADMIN' });
      return;
    }
    if (role !== RoleName.ADMIN) {
      const center = await prisma.educationalCenter.findUnique({ where: { id: Number(educationalCenterId) } });
      if (!center) {
        res.status(404).json({ message: 'El centro educativo indicado no existe' });
        return;
      }
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
        isActive: true,
        educationalCenterId: role === RoleName.ADMIN ? null : Number(educationalCenterId)
      }
    });

    // Devolvemos el usuario sin la contraseña por seguridad
    const { password: _, ...userWithoutPassword } = newUser;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creando usuario' });
  }
};

// --- 3. ELIMINAR USUARIO (Admin: cualquiera. Centro: solo profesores de
// su propio centro) ---
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const actor = (req as AuthRequest).user!;
    const currentUserId = actor.userId;

    // 🛡️ LÓGICA DE PROTECCIÓN
    if (Number(id) === currentUserId) {
      res.status(400).json({ message: 'No puedes eliminar tu propia cuenta mientras estás logueado.' });
      return;
    }

    // Verificar si el usuario existe antes de intentar borrar
    const userExists = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!userExists) {
        res.status(404).json({ message: 'Usuario no encontrado' });
        return;
    }

    // v3.0: Centro solo puede borrar profesores de su propio centro — no
    // estudiantes, padres, otras cuentas Centro, ni Admin, ni profesores de
    // otro centro.
    if (actor.role === RoleName.CENTRO) {
      if (userExists.role !== RoleName.TEACHER || userExists.educationalCenterId !== actor.educationalCenterId) {
        res.status(403).json({ message: 'Como Centro solo puedes eliminar profesores de tu propio centro.' });
        return;
      }
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
    res.status(500).json({ message: 'Error eliminando usuario' });
  }
};

// --- 4. BUSCADOR (Para asignar en cursos - MANTENIDO DE TU CÓDIGO) ---
// 🔒 Hallazgo nuevo (encontrado en esta pasada, fuera del informe original):
// este endpoint no tenía NINGÚN filtro de centro — cualquier usuario
// autenticado (incluyendo STUDENT/PARENT, que nunca llaman a esto desde la
// UI, pero sí pueden llamarlo directo a la API) podía enumerar nombre y
// email de usuarios de CUALQUIER centro educativo. Se usa solo en 2 lugares
// del frontend: el selector de profesor al crear una materia
// (CreateSubjectModal, para TEACHER/CENTRO/ADMIN) y la vinculación de hijos
// (LinkChildModal, solo ADMIN). Restringimos la ruta a esos roles
// (users.routes.ts) y aplicamos el mismo `centerWhere` que ya usa
// admin.controller.ts::adminSearch para el mismo tipo de búsqueda.
export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { role, query } = req.query;
    const whereCondition: any = { isActive: true, ...centerWhere(authReq) };

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
    res.status(500).json({ message: 'Error buscando usuarios' });
  }
};

// --- 5b. VINCULAR HIJO A UN PADRE/MADRE (Admin) ---
export const linkParentChild = async (req: Request, res: Response): Promise<void> => {
  try {
    const parentId = Number(req.params.id);
    const { childId } = req.body as { childId?: number };

    if (!childId) {
      res.status(400).json({ message: 'childId es obligatorio' });
      return;
    }

    const [parent, child] = await Promise.all([
      prisma.user.findUnique({ where: { id: parentId } }),
      prisma.user.findUnique({ where: { id: Number(childId) } }),
    ]);

    if (!parent || parent.role !== RoleName.PARENT) {
      res.status(400).json({ message: 'El usuario indicado no es un Padre/Madre' });
      return;
    }
    if (!child || child.role !== RoleName.STUDENT) {
      res.status(400).json({ message: 'El childId indicado no corresponde a un Estudiante' });
      return;
    }

    await prisma.parentChild.create({ data: { parentId, childId: child.id } });
    res.status(201).json({ message: 'Hijo vinculado correctamente' });
  } catch (error) {
    if ((error as any).code === 'P2002') {
      res.status(400).json({ message: 'Ese hijo ya está vinculado a este padre/madre' });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error vinculando hijo' });
  }
};

// --- 5c. DESVINCULAR HIJO (Admin) ---
export const unlinkParentChild = async (req: Request, res: Response): Promise<void> => {
  try {
    const parentId = Number(req.params.id);
    const childId = Number(req.params.childId);

    await prisma.parentChild.delete({ where: { parentId_childId: { parentId, childId } } });
    res.json({ message: 'Hijo desvinculado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error desvinculando hijo' });
  }
};

// --- 5d. LISTAR HIJOS VINCULADOS (Admin) ---
export const getParentChildren = async (req: Request, res: Response): Promise<void> => {
  try {
    const parentId = Number(req.params.id);
    const links = await prisma.parentChild.findMany({
      where: { parentId },
      include: { child: { select: { id: true, name: true, email: true } } },
    });
    res.json(links.map((l) => l.child));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error listando hijos' });
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
    res.status(500).json({ message: 'Error actualizando rol' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.userId;
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
    res.status(500).json({ message: 'Error al actualizar el perfil' });
  }
};

