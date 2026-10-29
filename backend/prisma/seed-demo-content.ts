/**
 * Contenido de demostración (v2.0).
 *
 * A diferencia de seed.ts (que borra TODO y recrea usuarios/materias desde
 * cero), este script es puramente ADITIVO: no borra nada, solo agrega
 * alumnos, inscripciones y contenido real a las 4 materias que ya existen
 * (Matemáticas/MAT-101, Historia/HIS-101, Ciencias/CIE-101, Literatura/LIT-101)
 * para que la app no se vea vacía al navegar.
 *
 * Pensado para correr UNA VEZ contra una base ya seedeada con seed.ts.
 * Si se corre dos veces, los usuarios/inscripciones no se duplican (se usa
 * upsert / skipDuplicates), pero las tareas, exámenes, calificaciones,
 * asistencia, foros y eventos SÍ se duplicarían - no está pensado para
 * correrse repetidamente.
 *
 * Uso: npx ts-node prisma/seed-demo-content.ts
 */
import { PrismaClient, RoleName, AssignmentStatus, EnrollmentStatus, CalendarEventScope } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY_MS);

// Último N días hábiles (lunes-viernes) terminando ayer, útil para asistencia.
function lastWeekdays(count: number, from: Date): Date[] {
  const days: Date[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  cursor = addDays(cursor, -1); // empezar ayer, no hoy
  while (days.length < count) {
    const dow = cursor.getUTCDay(); // 0 domingo, 6 sábado
    if (dow !== 0 && dow !== 6) days.push(new Date(cursor));
    cursor = addDays(cursor, -1);
  }
  return days.reverse();
}

async function main() {
  console.log('🌱 Sembrando contenido de demostración (v2.0)...');
  const now = new Date();

  const center = await prisma.educationalCenter.findUnique({ where: { code: 'legacy' } });
  if (!center) throw new Error('No existe el centro "legacy". Corre primero npx prisma db seed.');

  const teacher = await prisma.user.findUnique({ where: { email: 'teacher@aula.com' } });
  if (!teacher) throw new Error('No existe teacher@aula.com. Corre primero npx prisma db seed.');

  const subjectsByCode = {
    MAT: await prisma.subject.findUnique({ where: { code: 'MAT-101' } }),
    HIS: await prisma.subject.findUnique({ where: { code: 'HIS-101' } }),
    CIE: await prisma.subject.findUnique({ where: { code: 'CIE-101' } }),
    LIT: await prisma.subject.findUnique({ where: { code: 'LIT-101' } }),
  };
  for (const [code, subject] of Object.entries(subjectsByCode)) {
    if (!subject) throw new Error(`No existe la materia ${code}-101. Corre primero npx prisma db seed.`);
  }
  const subjects = Object.values(subjectsByCode) as NonNullable<(typeof subjectsByCode)['MAT']>[];

  // ---------------------------------------------------------------
  // 1. Alumnos: el existente (Pepito) + 4 nuevos, para que haya un
  //    salón real y no un alumno solitario.
  // ---------------------------------------------------------------
  const passwordHash = await bcrypt.hash('123456', 10);
  const existingStudent = await prisma.user.findUnique({ where: { email: 'student@aula.com' } });
  if (!existingStudent) throw new Error('No existe student@aula.com. Corre primero npx prisma db seed.');

  const newStudentDefs = [
    { name: 'María Rodríguez', email: 'maria@aula.com' },
    { name: 'Carlos Méndez', email: 'carlos@aula.com' },
    { name: 'Sofía Ramírez', email: 'sofia@aula.com' },
    { name: 'Diego Torres', email: 'diego@aula.com' },
  ];
  const newStudents = [];
  for (const def of newStudentDefs) {
    const s = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        name: def.name,
        email: def.email,
        password: passwordHash,
        role: RoleName.STUDENT,
        educationalCenterId: center.id,
      },
    });
    newStudents.push(s);
  }
  const students = [existingStudent, ...newStudents]; // 5 en total, Pepito primero
  console.log(`👤 ${newStudents.length} alumno(s) nuevo(s) creados (+ ${existingStudent.name} ya existente). Total: ${students.length}.`);

  // ---------------------------------------------------------------
  // 2. Inscripciones: todos los alumnos en las 4 materias.
  // ---------------------------------------------------------------
  let enrollCount = 0;
  for (const subject of subjects) {
    for (const student of students) {
      const result = await prisma.enrollment.upsert({
        where: { studentId_subjectId: { studentId: student.id, subjectId: subject.id } },
        update: { status: EnrollmentStatus.ACTIVE },
        create: { studentId: student.id, subjectId: subject.id, status: EnrollmentStatus.ACTIVE },
      });
      if (result) enrollCount++;
    }
  }
  console.log(`📝 ${enrollCount} inscripción(es) activa(s) asegurada(s) (${students.length} alumnos × ${subjects.length} materias).`);

  // ---------------------------------------------------------------
  // 3. Tareas: cada alumno tiene SU PROPIA fila por tarea (el modelo
  //    actual comparte una sola fila para tareas "de toda la clase",
  //    así que crear tareas individuales es lo único que da un estado
  //    PENDING/SUBMITTED/GRADED correcto por alumno).
  // ---------------------------------------------------------------
  const assignmentTitlesBySubject: Record<string, string[]> = {
    'MAT-101': ['Ecuaciones de primer grado', 'Geometría: área y perímetro', 'Tabla de multiplicar: práctica'],
    'HIS-101': ['Línea de tiempo: Independencia', 'Ensayo: Causas de la Revolución Industrial', 'Mapa conceptual: Civilizaciones Antiguas'],
    'CIE-101': ['Informe de laboratorio: fotosíntesis', 'Cuestionario: sistema solar', 'Proyecto: reciclaje y medio ambiente'],
    'LIT-101': ['Análisis de personaje: Don Quijote', 'Reseña de un libro', 'Poema original'],
  };

  // Rotación de estados: por alumno, cada una de sus 3 tareas por materia
  // cae en un estado distinto, así cada quien tiene el ciclo completo
  // (pendiente / entregada por calificar / calificada) y el profesor
  // siempre tiene algo real que gestionar.
  const statusRotation: AssignmentStatus[] = [AssignmentStatus.PENDING, AssignmentStatus.SUBMITTED, AssignmentStatus.GRADED];

  let assignmentCount = 0;
  for (const subject of subjects) {
    const titles = assignmentTitlesBySubject[subject.code];
    for (let titleIdx = 0; titleIdx < titles.length; titleIdx++) {
      const title = titles[titleIdx];
      for (let studentIdx = 0; studentIdx < students.length; studentIdx++) {
        const student = students[studentIdx];
        const status = statusRotation[(titleIdx + studentIdx) % statusRotation.length];

        const base: {
          title: string; description: string; dueDate: Date; status: AssignmentStatus;
          subjectId: number; creatorId: number; studentId: number;
          grade?: number; feedback?: string; submissionComment?: string; submissionUrl?: string;
        } = {
          title,
          description: `Tarea de ${subject.name}: ${title}.`,
          dueDate: status === AssignmentStatus.PENDING ? addDays(now, 5 + titleIdx) : addDays(now, -3 - titleIdx),
          status,
          subjectId: subject.id,
          creatorId: teacher.id,
          studentId: student.id,
        };

        if (status === AssignmentStatus.SUBMITTED) {
          base.submissionComment = 'Aquí está mi entrega, profe. Cualquier observación avíseme.';
          base.submissionUrl = 'demo-entrega.pdf';
        }
        if (status === AssignmentStatus.GRADED) {
          base.submissionComment = 'Entrega completada según lo solicitado.';
          base.submissionUrl = 'demo-entrega.pdf';
          base.grade = 75 + ((titleIdx * 7 + studentIdx * 5) % 26); // 75-100
          base.feedback = 'Buen trabajo, cumple con lo pedido.';
        }

        await prisma.assignment.create({ data: base });
        assignmentCount++;
      }
    }
  }
  console.log(`📄 ${assignmentCount} tarea(s) creada(s) (${subjects.length} materias × 3 títulos × ${students.length} alumnos).`);

  // ---------------------------------------------------------------
  // 4. Exámenes: 1 por materia, 3 preguntas, con entregas de 3 de los
  //    5 alumnos (los otros 2 quedan sin responder para poder probar
  //    el flujo de "Comenzar" en vivo).
  // ---------------------------------------------------------------
  const examsBySubject: Record<string, { title: string; questions: { text: string; points: number; options: string[]; correctIndex: number }[] }> = {
    'MAT-101': {
      title: 'Examen Parcial: Álgebra Básica',
      questions: [
        { text: '¿Cuál es el resultado de 2x + 3 = 7?', points: 34, options: ['x = 2', 'x = 3', 'x = 4'], correctIndex: 0 },
        { text: 'El área de un rectángulo de base 4 y altura 5 es:', points: 33, options: ['9', '20', '18'], correctIndex: 1 },
        { text: '¿Cuál es el perímetro de un cuadrado de lado 6?', points: 33, options: ['36', '12', '24'], correctIndex: 2 },
      ],
    },
    'HIS-101': {
      title: 'Examen: Civilizaciones y Procesos Históricos',
      questions: [
        { text: '¿En qué continente se desarrolló principalmente el Imperio Romano?', points: 34, options: ['Europa', 'Asia', 'África'], correctIndex: 0 },
        { text: 'La Revolución Industrial comenzó en:', points: 33, options: ['Francia', 'Inglaterra', 'Alemania'], correctIndex: 1 },
        { text: '¿Qué civilización construyó las pirámides de Giza?', points: 33, options: ['Maya', 'Egipcia', 'Inca'], correctIndex: 1 },
      ],
    },
    'CIE-101': {
      title: 'Examen: Sistema Solar y Medio Ambiente',
      questions: [
        { text: '¿Cuál es el planeta más cercano al Sol?', points: 34, options: ['Venus', 'Mercurio', 'Tierra'], correctIndex: 1 },
        { text: 'La fotosíntesis ocurre principalmente en:', points: 33, options: ['las raíces', 'las hojas', 'el tallo'], correctIndex: 1 },
        { text: 'El proceso de reciclaje ayuda a:', points: 33, options: ['aumentar la basura', 'reducir el impacto ambiental', 'contaminar más'], correctIndex: 1 },
      ],
    },
    'LIT-101': {
      title: 'Examen: Grandes Obras de la Literatura',
      questions: [
        { text: "¿Quién escribió 'Don Quijote de la Mancha'?", points: 34, options: ['Miguel de Cervantes', 'Gabriel García Márquez', 'Pablo Neruda'], correctIndex: 0 },
        { text: 'Un soneto tiene:', points: 33, options: ['10 versos', '14 versos', '8 versos'], correctIndex: 1 },
        { text: 'El género narrativo que cuenta hechos breves con un solo conflicto se llama:', points: 33, options: ['novela', 'cuento', 'ensayo'], correctIndex: 1 },
      ],
    },
  };

  // Para cada alumno que "responde", cuántas preguntas acierta (de 3) - variado para notas realistas.
  const correctCountByStudentIdx = [3, 2, 1]; // Pepito saca todo bien, el 2do casi todo, el 3ro flojo

  let examCount = 0;
  let submissionCount = 0;
  for (const subject of subjects) {
    const examDef = examsBySubject[subject.code];
    const exam = await prisma.exam.create({
      data: {
        title: examDef.title,
        description: `Examen de ${subject.name} - ${examDef.questions.length} preguntas.`,
        subjectId: subject.id,
        teacherId: teacher.id,
        showResults: true,
        dueDate: addDays(now, 10),
      },
    });
    examCount++;

    const questionRecords = [];
    for (const q of examDef.questions) {
      const question = await prisma.question.create({
        data: { text: q.text, points: q.points, examId: exam.id },
      });
      const options = [];
      for (let i = 0; i < q.options.length; i++) {
        const option = await prisma.option.create({
          data: { text: q.options[i], isCorrect: i === q.correctIndex, questionId: question.id },
        });
        options.push(option);
      }
      questionRecords.push({ question, options, points: q.points });
    }
    const totalPoints = questionRecords.reduce((sum, q) => sum + q.points, 0);

    // Entregas: los primeros 3 alumnos responden, los últimos 2 quedan pendientes.
    for (let studentIdx = 0; studentIdx < 3; studentIdx++) {
      const student = students[studentIdx];
      const correctCount = correctCountByStudentIdx[studentIdx];

      let earnedPoints = 0;
      const submission = await prisma.examSubmission.create({
        data: { studentId: student.id, examId: exam.id, score: 0 }, // se corrige abajo
      });
      for (let qi = 0; qi < questionRecords.length; qi++) {
        const { question, options, points } = questionRecords[qi];
        const answerCorrectly = qi < correctCount;
        const chosen = answerCorrectly
          ? options.find((o) => o.isCorrect)!
          : options.find((o) => !o.isCorrect)!;
        if (answerCorrectly) earnedPoints += points;
        await prisma.answer.create({
          data: { submissionId: submission.id, questionId: question.id, selectedOptionId: chosen.id },
        });
      }
      // Puntos crudos (misma unidad que Question.points, suman ~100 por examen).
      await prisma.examSubmission.update({ where: { id: submission.id }, data: { score: earnedPoints } });
      submissionCount++;
    }
  }
  console.log(`🧠 ${examCount} examen(es) creado(s) (3 preguntas c/u) con ${submissionCount} entrega(s) ya calificadas.`);

  // ---------------------------------------------------------------
  // 5. Calificaciones manuales (módulo Calificaciones v2.0): 2 por
  //    alumno por materia, para que el promedio y el tab de
  //    Calificaciones tengan contenido real desde ya.
  // ---------------------------------------------------------------
  const manualGradeTitleBySubject: Record<string, string> = {
    'MAT-101': 'Examen corto: operaciones básicas',
    'HIS-101': 'Trabajo de investigación',
    'CIE-101': 'Práctica de laboratorio',
    'LIT-101': 'Exposición oral',
  };

  const evaluationRows = [];
  for (const subject of subjects) {
    for (let studentIdx = 0; studentIdx < students.length; studentIdx++) {
      const student = students[studentIdx];
      evaluationRows.push({
        subjectId: subject.id,
        studentId: student.id,
        teacherId: teacher.id,
        title: 'Participación en clase',
        score: 80 + ((studentIdx * 3) % 20), // 80-99
        weight: 1,
        educationalCenterId: center.id,
      });
      evaluationRows.push({
        subjectId: subject.id,
        studentId: student.id,
        teacherId: teacher.id,
        title: manualGradeTitleBySubject[subject.code],
        score: 65 + ((studentIdx * 11) % 35), // 65-99
        weight: 2,
        educationalCenterId: center.id,
      });
    }
  }
  await prisma.evaluation.createMany({ data: evaluationRows });
  console.log(`🏆 ${evaluationRows.length} calificación(es) manual(es) creada(s) (2 por alumno por materia).`);

  // ---------------------------------------------------------------
  // 6. Asistencia: últimos 8 días hábiles por alumno por materia.
  //    Mayoría PRESENT, con algo de LATE/EXCUSED/ABSENT para que la
  //    tasa de asistencia no sea un aburrido 100%.
  // ---------------------------------------------------------------
  const attendanceDays = lastWeekdays(8, now);
  const statusCycle = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'PRESENT', 'EXCUSED', 'PRESENT', 'ABSENT'] as const;

  const attendanceRows = [];
  for (const subject of subjects) {
    for (let studentIdx = 0; studentIdx < students.length; studentIdx++) {
      const student = students[studentIdx];
      for (let dayIdx = 0; dayIdx < attendanceDays.length; dayIdx++) {
        const status = statusCycle[(dayIdx + studentIdx) % statusCycle.length];
        attendanceRows.push({
          subjectId: subject.id,
          studentId: student.id,
          date: attendanceDays[dayIdx],
          status,
          recordedById: teacher.id,
          educationalCenterId: center.id,
        });
      }
    }
  }
  await prisma.attendance.createMany({ data: attendanceRows, skipDuplicates: true });
  console.log(`🗓️ ${attendanceRows.length} registro(s) de asistencia creado(s) (${attendanceDays.length} días hábiles × ${students.length} alumnos × ${subjects.length} materias).`);

  // ---------------------------------------------------------------
  // 7. Foros: 1 hilo + respuestas por materia (backend ya existe,
  //    útil desde ya aunque el frontend de Foros se construya después).
  // ---------------------------------------------------------------
  const forumThreadBySubject: Record<string, { title: string; body: string }> = {
    'MAT-101': { title: 'Dudas sobre la tarea de ecuaciones', body: '¿Alguien puede explicar cómo despejar x cuando hay términos en ambos lados?' },
    'HIS-101': { title: '¿Qué les pareció el tema de la Revolución Industrial?', body: 'Comparte aquí tu opinión sobre las causas y consecuencias que vimos en clase.' },
    'CIE-101': { title: 'Resultados del experimento de fotosíntesis', body: 'Compartan aquí sus observaciones del experimento de esta semana.' },
    'LIT-101': { title: 'Debate: ¿Don Quijote es un héroe o un loco?', body: 'Abramos el debate - argumenten con ejemplos del texto.' },
  };
  let forumThreadCount = 0;
  let forumPostCount = 0;
  for (const subject of subjects) {
    const def = forumThreadBySubject[subject.code];
    const thread = await prisma.forumThread.create({
      data: { title: def.title, body: def.body, subjectId: subject.id, authorId: teacher.id, educationalCenterId: center.id },
    });
    forumThreadCount++;
    await prisma.forumPost.createMany({
      data: [
        { threadId: thread.id, authorId: students[0].id, body: 'Yo también tengo esa duda, gracias por preguntar.', educationalCenterId: center.id },
        { threadId: thread.id, authorId: students[1].id, body: 'Yo creo que quedó bastante claro en la clase, pero recapitulemos.', educationalCenterId: center.id },
      ],
    });
    forumPostCount += 2;
  }
  console.log(`💬 ${forumThreadCount} hilo(s) de foro con ${forumPostCount} respuesta(s) creados.`);

  // ---------------------------------------------------------------
  // 8. Calendario: eventos SUBJECT por materia + 1 CENTER + 1 PERSONAL
  //    (backend ya existe, útil para cuando se construya su frontend).
  // ---------------------------------------------------------------
  let calendarCount = 0;
  for (const subject of subjects) {
    await prisma.calendarEvent.create({
      data: {
        title: `Entrega final - ${subject.name}`,
        description: 'Fecha límite para la entrega del proyecto final de la materia.',
        startsAt: addDays(now, 14),
        endsAt: addDays(now, 14),
        allDay: true,
        scope: CalendarEventScope.SUBJECT,
        subjectId: subject.id,
        createdById: teacher.id,
        educationalCenterId: center.id,
      },
    });
    calendarCount++;
  }
  await prisma.calendarEvent.create({
    data: {
      title: 'Reunión de Centro - Inicio de Periodo',
      description: 'Reunión informativa para todo el personal y representantes.',
      startsAt: addDays(now, 3),
      endsAt: addDays(now, 3),
      allDay: false,
      scope: CalendarEventScope.CENTER,
      createdById: teacher.id,
      educationalCenterId: center.id,
    },
  });
  calendarCount++;
  await prisma.calendarEvent.create({
    data: {
      title: 'Estudiar para examen de Matemáticas',
      description: 'Recordatorio personal.',
      startsAt: addDays(now, 8),
      endsAt: addDays(now, 8),
      allDay: true,
      scope: CalendarEventScope.PERSONAL,
      ownerId: students[0].id,
      createdById: students[0].id,
      educationalCenterId: center.id,
    },
  });
  calendarCount++;
  console.log(`📅 ${calendarCount} evento(s) de calendario creado(s).`);

  console.log('✅ Contenido de demostración sembrado con éxito.');
  console.log('   Alumnos nuevos (todos con password 123456): maria@aula.com, carlos@aula.com, sofia@aula.com, diego@aula.com');
}

main()
  .catch((e) => {
    console.error('❌ Error sembrando contenido de demostración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
