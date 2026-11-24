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
    const { role: roleFilter } = req.query as { role?: string };

    // v3.1: Centro ahora también gestiona Estudiantes y Padres/Madres de su
    // propio centro (antes solo veía Profesores — ver nota histórica en
    // CODE_REVIEW.md 10.6, superada por el feedback de producto que pide
    // que Centro matricule alumnos y les asigne su padre/madre). Sigue sin
    // poder ver cuentas CENTRO/ADMIN ni de otros centros. El query param
    // `role` deja al frontend pedir una sola categoría a la vez (para la
    // UI separada de Profesores/Estudiantes/Padres).
    const centroAllowedRoles: RoleName[] = [RoleName.TEACHER, RoleName.STUDENT, RoleName.PARENT];
    let where: any = {};
    if (actor.role === RoleName.CENTRO) {
      const requestedRole =
        roleFilter && centroAllowedRoles.includes(roleFilter as RoleName)
          ? (roleFilter as RoleName)
          : undefined;
      where = {
        educationalCenterId: actor.educationalCenterId,
        role: requestedRole ?? { in: centroAllowedRoles },
      };
    } else if (roleFilter) {
      // Admin: puede filtrar por cualquier rol si lo pide.
      where = { role: roleFilter as RoleName };
    }

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

// --- 2b. ACTUALIZAR USUARIO (Admin: cualquiera. Centro: SOLO profesores de
// su propio centro, igual alcance que createUser/deleteUser). No existía
// ningún endpoint de edición — Centro podía crear y borrar profesores pero
// nunca corregir un nombre/email mal tipeado ni resetear su contraseña sin
// borrar y recrear la cuenta (lo que le haría perder materias asignadas).
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = (req as AuthRequest).user!;
    const { id } = req.params;
    const { name, email, password } = req.body as { name?: string; email?: string; password?: string };

    const target = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!target) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    if (actor.role === RoleName.CENTRO) {
      if (target.role !== RoleName.TEACHER || target.educationalCenterId !== actor.educationalCenterId) {
        res.status(403).json({ message: 'Como Centro solo puedes editar profesores de tu propio centro.' });
        return;
      }
    }

    if (!name && !email && !password) {
      res.status(400).json({ message: 'Debes indicar al menos un campo para actualizar (nombre, email o contraseña).' });
      return;
    }

    if (email && email !== target.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        res.status(400).json({ message: 'Ese email ya está en uso por otra cuenta.' });
        return;
      }
    }

    const updateData: { name?: string; email?: string; password?: string } = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    const updated = await prisma.user.update({ where: { id: target.id }, data: updateData });
    const { password: _pw, ...safeUser } = updated;
    res.json(safeUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error actualizando usuario' });
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

    // Regla de negocio (pedida explícitamente en feedback de producto):
    // un estudiante no puede tener más de 2 padres/madres vinculados.
    const existingParents = await prisma.parentChild.count({ where: { childId: child.id } });
    if (existingParents >= 2) {
      res.status(400).json({ message: 'Este estudiante ya tiene 2 padres/madres vinculados (máximo permitido).' });
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

// --- 5d. LISTAR HIJOS VINCULADOS (Admin: cualquier padre/madre. Centro:
// solo padres/madres de su propio centro — ver nota en createUser/
// getAllUsers sobre el mismo alcance) ---
export const getParentChildren = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = (req as AuthRequest).user!;
    const parentId = Number(req.params.id);

    if (actor.role === RoleName.CENTRO) {
      const parent = await prisma.user.findUnique({ where: { id: parentId } });
      if (!parent || parent.role !== RoleName.PARENT || parent.educationalCenterId !== actor.educationalCenterId) {
        res.status(403).json({ message: 'Como Centro solo puedes ver padres/madres de tu propio centro.' });
        return;
      }
    }

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


// --- 6. CENTRO: MATRICULAR ESTUDIANTE + ASIGNAR PADRE/MADRE (v3.1) ---
// Pedido explícito de producto: "el centro es quien crea los estudiantes
// que se matriculan al mismo, y en el mismo registro donde van sus
// credenciales se le asigna el padre al estudiante junto con sus
// credenciales también". Soporta 3 modos para el padre/madre:
//   - 'new'      : crea una cuenta de Padre/Madre nueva junto con el estudiante.
//   - 'existing' : vincula un Padre/Madre YA EXISTENTE del mismo centro
//                  (caso típico: dos hermanos, mismo padre/madre).
//   - 'none'     : crea solo al estudiante, sin padre/madre por ahora
//                  (se puede vincular más tarde con addParentToStudent).
// Transacción atómica: si falla cualquier paso, no se crea nada a medias.
export const createStudentWithParent = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = (req as AuthRequest).user!;
    if (actor.role !== RoleName.CENTRO && actor.role !== RoleName.ADMIN) {
      res.status(403).json({ message: 'No autorizado' });
      return;
    }

    const {
      studentName, studentEmail, studentPassword,
      parentMode,
      parentName, parentEmail, parentPassword,
      existingParentId,
      educationalCenterId: bodyCenterId,
    } = req.body as {
      studentName?: string; studentEmail?: string; studentPassword?: string;
      parentMode?: 'new' | 'existing' | 'none';
      parentName?: string; parentEmail?: string; parentPassword?: string;
      existingParentId?: number;
      educationalCenterId?: number;
    };

    const educationalCenterId =
      actor.role === RoleName.CENTRO ? actor.educationalCenterId : Number(bodyCenterId) || undefined;

    if (!educationalCenterId) {
      res.status(400).json({ message: 'No se pudo determinar el centro educativo para matricular al estudiante.' });
      return;
    }

    if (!studentName?.trim() || !studentEmail?.trim() || !studentPassword) {
      res.status(400).json({ message: 'Nombre, email y contraseña del estudiante son obligatorios.' });
      return;
    }
    if (studentPassword.length < 6) {
      res.status(400).json({ message: 'La contraseña del estudiante debe tener al menos 6 caracteres.' });
      return;
    }

    const studentEmailTaken = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (studentEmailTaken) {
      res.status(400).json({ message: 'Ya existe una cuenta con ese email para el estudiante.' });
      return;
    }

    let existingParent: { id: number; role: RoleName; educationalCenterId: number | null } | null = null;
    if (parentMode === 'existing') {
      if (!existingParentId) {
        res.status(400).json({ message: 'Debes seleccionar el padre/madre existente.' });
        return;
      }
      existingParent = await prisma.user.findUnique({ where: { id: Number(existingParentId) } });
      if (!existingParent || existingParent.role !== RoleName.PARENT || existingParent.educationalCenterId !== educationalCenterId) {
        res.status(400).json({ message: 'El padre/madre indicado no es válido para este centro.' });
        return;
      }
    } else if (parentMode === 'new') {
      if (!parentName?.trim() || !parentEmail?.trim() || !parentPassword) {
        res.status(400).json({ message: 'Nombre, email y contraseña del padre/madre son obligatorios.' });
        return;
      }
      if (parentPassword.length < 6) {
        res.status(400).json({ message: 'La contraseña del padre/madre debe tener al menos 6 caracteres.' });
        return;
      }
      const parentEmailTaken = await prisma.user.findUnique({ where: { email: parentEmail } });
      if (parentEmailTaken) {
        res.status(400).json({ message: 'Ya existe una cuenta con ese email para el padre/madre.' });
        return;
      }
    }

    const studentHash = await bcrypt.hash(studentPassword, 10);

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.user.create({
        data: {
          name: studentName.trim(),
          email: studentEmail.trim(),
          password: studentHash,
          role: RoleName.STUDENT,
          isActive: true,
          educationalCenterId,
        },
      });

      let parent = null;
      let linkedParentId: number | undefined;

      if (parentMode === 'new') {
        const parentHash = await bcrypt.hash(parentPassword!, 10);
        parent = await tx.user.create({
          data: {
            name: parentName!.trim(),
            email: parentEmail!.trim(),
            password: parentHash,
            role: RoleName.PARENT,
            isActive: true,
            educationalCenterId,
          },
        });
        linkedParentId = parent.id;
      } else if (parentMode === 'existing' && existingParent) {
        linkedParentId = existingParent.id;
      }

      if (linkedParentId) {
        // Estudiante recién creado: siempre tiene 0 padres hasta este punto,
        // así que la regla de máximo 2 no puede violarse aquí, pero se dejó
        // explícita por si en el futuro este flujo se reutiliza para un
        // estudiante ya existente.
        const parentCount = await tx.parentChild.count({ where: { childId: student.id } });
        if (parentCount >= 2) {
          throw new Error('MAX_PARENTS');
        }
        await tx.parentChild.create({ data: { parentId: linkedParentId, childId: student.id } });
      }

      return { student, parent };
    });

    const { password: _sp, ...studentSafe } = result.student;
    const parentSafe = result.parent
      ? (() => {
          const { password: _pp, ...rest } = result.parent!;
          return rest;
        })()
      : null;

    res.status(201).json({ student: studentSafe, parent: parentSafe });
  } catch (error) {
    if (error instanceof Error && error.message === 'MAX_PARENTS') {
      res.status(400).json({ message: 'Este estudiante ya tiene 2 padres/madres vinculados (máximo permitido).' });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error creando el estudiante y su padre/madre.' });
  }
};

// --- 6b. CENTRO/ADMIN: LISTAR LOS PADRES/MADRES VINCULADOS A UN ESTUDIANTE ---
export const getStudentParents = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = (req as AuthRequest).user!;
    const studentId = Number(req.params.studentId);
    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== RoleName.STUDENT) {
      res.status(404).json({ message: 'Estudiante no encontrado' });
      return;
    }
    if (actor.role === RoleName.CENTRO && student.educationalCenterId !== actor.educationalCenterId) {
      res.status(403).json({ message: 'Como Centro solo puedes ver estudiantes de tu propio centro.' });
      return;
    }
    const links = await prisma.parentChild.findMany({
      where: { childId: studentId },
      include: { parent: { select: { id: true, name: true, email: true } } },
    });
    res.json(links.map((l) => l.parent));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error listando padres/madres del estudiante' });
  }
};

// --- 7. CENTRO/ADMIN: AGREGAR UN 2DO PADRE/MADRE A UN ESTUDIANTE YA
// EXISTENTE --- (crea la cuenta o vincula una existente, igual que el modo
// 'parentMode' de createStudentWithParent, pero para un estudiante que ya
// estaba matriculado). Respeta el mismo tope de 2 padres/madres.
export const addParentToStudent = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = (req as AuthRequest).user!;
    const studentId = Number(req.params.studentId);
    const {
      parentMode,
      parentName, parentEmail, parentPassword,
      existingParentId,
    } = req.body as {
      parentMode?: 'new' | 'existing';
      parentName?: string; parentEmail?: string; parentPassword?: string;
      existingParentId?: number;
    };

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== RoleName.STUDENT) {
      res.status(404).json({ message: 'Estudiante no encontrado' });
      return;
    }
    if (actor.role === RoleName.CENTRO && student.educationalCenterId !== actor.educationalCenterId) {
      res.status(403).json({ message: 'Como Centro solo puedes gestionar estudiantes de tu propio centro.' });
      return;
    }

    const parentCount = await prisma.parentChild.count({ where: { childId: student.id } });
    if (parentCount >= 2) {
      res.status(400).json({ message: 'Este estudiante ya tiene 2 padres/madres vinculados (máximo permitido).' });
      return;
    }

    let parentId: number | undefined;
    let createdParent = null;

    if (parentMode === 'existing') {
      if (!existingParentId) {
        res.status(400).json({ message: 'Debes seleccionar el padre/madre existente.' });
        return;
      }
      const parent = await prisma.user.findUnique({ where: { id: Number(existingParentId) } });
      if (!parent || parent.role !== RoleName.PARENT || parent.educationalCenterId !== student.educationalCenterId) {
        res.status(400).json({ message: 'El padre/madre indicado no es válido para este centro.' });
        return;
      }
      parentId = parent.id;
    } else {
      if (!parentName?.trim() || !parentEmail?.trim() || !parentPassword) {
        res.status(400).json({ message: 'Nombre, email y contraseña del padre/madre son obligatorios.' });
        return;
      }
      const parentEmailTaken = await prisma.user.findUnique({ where: { email: parentEmail } });
      if (parentEmailTaken) {
        res.status(400).json({ message: 'Ya existe una cuenta con ese email para el padre/madre.' });
        return;
      }
      const parentHash = await bcrypt.hash(parentPassword, 10);
      createdParent = await prisma.user.create({
        data: {
          name: parentName.trim(),
          email: parentEmail.trim(),
          password: parentHash,
          role: RoleName.PARENT,
          isActive: true,
          educationalCenterId: student.educationalCenterId,
        },
      });
      parentId = createdParent.id;
    }

    await prisma.parentChild.create({ data: { parentId: parentId!, childId: student.id } });
    const parentSafe = createdParent ? (() => { const { password: _pw, ...rest } = createdParent!; return rest; })() : null;
    res.status(201).json({ message: 'Padre/madre vinculado correctamente', parent: parentSafe });
  } catch (error) {
    if ((error as any).code === 'P2002') {
      res.status(400).json({ message: 'Ese padre/madre ya está vinculado a este estudiante.' });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'Error vinculando padre/madre al estudiante.' });
  }
};
