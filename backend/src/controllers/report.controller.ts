import { Response } from 'express';
import { PrismaClient, RoleName } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AuthRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const generateStudentReport = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { userId, role } = req.user!;
    let targetStudentId = userId;

    // Lógica de seguridad: ¿De quién es el reporte?
    if (role === RoleName.PARENT) {
      // El padre pide el reporte de un hijo específico (lo manda por query param ?studentId=7)
      const requestedChildId = Number(req.query.studentId);
      
      // Verificar que sea SU hijo
      const relation = await prisma.parentChild.findUnique({
        where: { parentId_childId: { parentId: userId, childId: requestedChildId } }
      });

      if (!relation) return res.status(403).json({ message: 'No tienes permiso para ver este reporte' });
      targetStudentId = requestedChildId;
    } 
    // Si es Student, targetStudentId ya es su propio ID.
    // Si es Teacher/Admin, podrían pedir cualquiera (simplifiquemos: Teacher pide por query)
    else if (role === RoleName.TEACHER) {
        targetStudentId = Number(req.query.studentId);
    }

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
    console.error(error);
    // Si ya empezamos a enviar el PDF, no podemos enviar JSON.
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error al generar reporte' });
    }
  }
};