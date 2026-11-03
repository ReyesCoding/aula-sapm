import { Request, Response } from 'express';
import { RoleName } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AuthRequest } from '../middlewares/auth.middleware';
// Bug funcional 4.3 (antes corregido): este archivo instanciaba su PROPIO
// PrismaClient en lugar de usar el singleton compartido — con Neon Postgres
// cada instancia abre su propio pool de conexiones, y varias instancias
// vivas a la vez agotan el límite de conexiones del plan. Un solo
// PrismaClient por proceso, siempre.
import prisma from '../prisma/client';
import { assertCanViewStudentGrades } from '../services/grades.policy';
import { HttpError } from '../utils/tenant';

// Nota: la firma se tipa como (req: Request, ...) y se castea adentro a
// AuthRequest — declarar el parámetro ya como AuthRequest rompe la
// asignación a RequestHandler de Express (contravarianza de tipos).
export const generateStudentReport = async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, role, educationalCenterId } = (req as AuthRequest).user!;

    // 🔒 Hallazgo crítico 3.4 (antes corregido): el caso TEACHER confiaba
    // ciegamente en ?studentId sin verificar que el alumno solicitado
    // perteneciera a alguna de sus materias (IDOR — cualquier profesor podía
    // descargar el reporte de CUALQUIER estudiante del sistema). Además
    // CENTRO no tenía ningún caso (quedaba pidiendo su propio reporte, sin
    // sentido para ese rol). En vez de reimplementar estas reglas aquí,
    // reusamos la misma política ya centralizada en grades.policy.ts que usa
    // el módulo de Calificaciones — una sola fuente de verdad para "quién
    // puede ver las notas de quién".
    const targetStudentId = role === RoleName.STUDENT ? userId : Number(req.query.studentId);

    if (role !== RoleName.STUDENT && (!req.query.studentId || Number.isNaN(targetStudentId))) {
      res.status(400).json({ message: 'Debes indicar el studentId del reporte a generar' });
      return;
    }

    await assertCanViewStudentGrades({ userId, role, educationalCenterId }, targetStudentId);

    // 1. Obtener datos
    const student = await prisma.user.findUnique({ where: { id: targetStudentId } });
    if (!student) return res.status(404).json({ message: 'Estudiante no encontrado' });

    const assignments = await prisma.assignment.findMany({
      where: { studentId: targetStudentId },
      include: { subject: true },
      orderBy: { dueDate: 'asc' }
    });

    // 2. Configurar Headers para descarga
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=reporte_${student.name.replace(/\s/g, '_')}.pdf`);

    // 3. Generar PDF
    const doc = new PDFDocument();

    // Pipe: Conectar el documento directamente a la respuesta (Stream)
    doc.pipe(res);

    // --- CONTENIDO DEL PDF ---
    doc.fontSize(20).text('Aula - Reporte de Progreso', { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text(`Estudiante: ${student.name}`);
    doc.text(`Fecha de generación: ${new Date().toLocaleDateString()}`);
    doc.text(`Total de tareas: ${assignments.length}`);
    doc.moveDown();

    // Tabla simple de tareas
    doc.fontSize(12).text('Detalle de Asignaciones:', { underline: true });
    doc.moveDown(0.5);

    assignments.forEach((task, index) => {
      const statusIcon = task.status === 'SUBMITTED' ? '[OK]' : '[Pendiente]';
// Usamos ?. (optional chaining) y || 'General' por si no tiene materia asignada
      const subjectName = task.subject?.name || (task as any).course?.name || 'General';
      const line = `${index + 1}. ${subjectName}: ${task.title} - ${statusIcon}`;
      // Color según estado
      if (task.status === 'SUBMITTED') doc.fillColor('green');
      else doc.fillColor('red');

      doc.text(line);
      doc.fillColor('black'); // Reset color
    });

    // Finalizar PDF
    doc.end();

  } catch (error) {
    if (error instanceof HttpError && !res.headersSent) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error(error);
    // Si ya empezamos a enviar el PDF, no podemos enviar JSON.
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al generar reporte' });
    }
  }
};
