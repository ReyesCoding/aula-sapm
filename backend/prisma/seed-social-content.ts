/**
 * Contenido de demostración — mensajería y calendario (v2.1, nov. 2026).
 *
 * seed-demo-content.ts (v2.0) nunca llegó a sembrar NADA de mensajería
 * (0 conversaciones, 0 mensajes) y solo dejó 6 eventos de calendario en
 * total repartidos entre 4 materias + 1 evento de centro + 1 personal.
 * Resultado: cualquiera que entre a "Mensajes" o "Calendario" con las
 * cuentas demo encuentra las pantallas completamente vacías, pese a que
 * ambos módulos ya están implementados de punta a punta. Este script
 * SOLO agrega contenido a esos dos módulos (y una segunda hija para
 * Roberto, para poder probar el selector de hijo con datos reales — ver
 * CODE_REVIEW.md tarea "Parent: selector de hijo").
 *
 * Puramente ADITIVO, igual que seed-demo-content.ts: pensado para correr
 * UNA SOLA VEZ contra una base ya sembrada con seed.ts + seed-demo-content.ts
 * (requiere que existan teacher@aula.com, student@aula.com, parent@aula.com,
 * maria@aula.com, carlos@aula.com, diego@aula.com y las 4 materias). Si se
 * corre dos veces, las conversaciones/eventos/tareas de Ana SÍ se duplican.
 *
 * Uso: npx ts-node prisma/seed-social-content.ts
 */
import { PrismaClient, RoleName, ConversationType, EnrollmentStatus, CalendarEventScope, AssignmentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY_MS);
const minutesAgo = (base: Date, minutes: number) => new Date(base.getTime() - minutes * 60 * 1000);

async function main() {
  console.log('🌱 Sembrando mensajería y calendario de demostración (v2.1)...');
  const now = new Date();

  const center = await prisma.educationalCenter.findUnique({ where: { code: 'horizonte' } });
  if (!center) throw new Error('No existe el centro "horizonte". Corre primero npx prisma db seed.');

  const admin = await prisma.user.findUnique({ where: { email: 'admin@aula.com' } });
  const centro = await prisma.user.findUnique({ where: { email: 'centro@aula.com' } });
  const teacher = await prisma.user.findUnique({ where: { email: 'teacher@aula.com' } });
  const pedro = await prisma.user.findUnique({ where: { email: 'student@aula.com' } });
  const roberto = await prisma.user.findUnique({ where: { email: 'parent@aula.com' } });
  const maria = await prisma.user.findUnique({ where: { email: 'maria@aula.com' } });
  const carlos = await prisma.user.findUnique({ where: { email: 'carlos@aula.com' } });
  const diego = await prisma.user.findUnique({ where: { email: 'diego@aula.com' } });
  const sofia = await prisma.user.findUnique({ where: { email: 'sofia@aula.com' } });
  if (!admin || !centro || !teacher || !pedro || !roberto || !maria || !carlos || !diego || !sofia) {
    throw new Error('Faltan cuentas demo base. Corre primero npx prisma db seed y npx ts-node prisma/seed-demo-content.ts.');
  }

  const subjectsByCode = {
    MAT: await prisma.subject.findUnique({ where: { code: 'MAT-101' } }),
    HIS: await prisma.subject.findUnique({ where: { code: 'HIS-101' } }),
    CIE: await prisma.subject.findUnique({ where: { code: 'CIE-101' } }),
    LIT: await prisma.subject.findUnique({ where: { code: 'LIT-101' } }),
  };
  for (const [code, subject] of Object.entries(subjectsByCode)) {
    if (!subject) throw new Error(`No existe la materia ${code}-101.`);
  }
  const { MAT, HIS, CIE, LIT } = subjectsByCode as Record<string, NonNullable<(typeof subjectsByCode)['MAT']>>;
  void LIT;

  // ---------------------------------------------------------------
  // 0. Segunda familia: Marta Rodríguez (madre de María) + segunda hija
  //    de Roberto, Ana Jiménez (hermana de Pedro). Sin esto no hay forma
  //    de demostrar ni "Padre <-> Padre" ni el selector de hijo con datos
  //    reales (Roberto solo tenía a Pedro vinculado).
  // ---------------------------------------------------------------
  const passwordHash = await bcrypt.hash('123456', 10);
  const marta = await prisma.user.upsert({
    where: { email: 'parent2@aula.com' },
    update: {},
    create: {
      name: 'Marta Rodríguez',
      email: 'parent2@aula.com',
      password: passwordHash,
      role: RoleName.PARENT,
      educationalCenterId: center.id,
      children: { create: { childId: maria.id } },
    },
  });
  console.log(`👪 Madre de familia "${marta.name}" (parent2@aula.com) vinculada a ${maria.name}.`);

  const ana = await prisma.user.upsert({
    where: { email: 'ana@aula.com' },
    update: {},
    create: {
      name: 'Ana Jiménez',
      email: 'ana@aula.com',
      password: passwordHash,
      role: RoleName.STUDENT,
      educationalCenterId: center.id,
    },
  });
  await prisma.parentChild.upsert({
    where: { parentId_childId: { parentId: roberto.id, childId: ana.id } },
    update: {},
    create: { parentId: roberto.id, childId: ana.id },
  });
  // Ana solo cursa 2 de las 4 materias (a propósito: así el selector de
  // hijo en el dashboard de Roberto muestra "Mis Materias" realmente
  // distintas entre Pedro (4 materias) y Ana (2), no la misma lista dos
  // veces con otro nombre arriba.
  for (const subject of [HIS, CIE]) {
    await prisma.enrollment.upsert({
      where: { studentId_subjectId: { studentId: ana.id, subjectId: subject.id } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: { studentId: ana.id, subjectId: subject.id, status: EnrollmentStatus.ACTIVE },
    });
  }
  console.log(`👧 Segunda hija "${ana.name}" (ana@aula.com) creada, inscrita en Historia y Ciencias, vinculada a ${roberto.name}.`);

  // Un par de tareas + calificaciones para Ana, para que su promedio y su
  // barra de progreso por materia (ver subject.controller.ts#getAllSubjects)
  // muestren un número real al seleccionarla, no un estado vacío.
  const anaAssignments: { title: string; subjectId: number; status: AssignmentStatus; grade?: number }[] = [
    { title: 'Línea de tiempo: Independencia', subjectId: HIS.id, status: AssignmentStatus.GRADED, grade: 88 },
    { title: 'Mapa conceptual: Civilizaciones Antiguas', subjectId: HIS.id, status: AssignmentStatus.PENDING },
    { title: 'Informe de laboratorio: fotosíntesis', subjectId: CIE.id, status: AssignmentStatus.SUBMITTED },
  ];
  for (const a of anaAssignments) {
    await prisma.assignment.create({
      data: {
        title: a.title,
        description: `Tarea de ${a.subjectId === HIS.id ? 'Historia' : 'Ciencias'}: ${a.title}.`,
        dueDate: a.status === AssignmentStatus.PENDING ? addDays(now, 6) : addDays(now, -4),
        status: a.status,
        subjectId: a.subjectId,
        creatorId: teacher.id,
        studentId: ana.id,
        ...(a.status === AssignmentStatus.SUBMITTED ? { submissionComment: 'Aquí está mi entrega, profe.', submissionUrl: 'demo-entrega.pdf' } : {}),
        ...(a.status === AssignmentStatus.GRADED ? { submissionComment: 'Entrega completada.', submissionUrl: 'demo-entrega.pdf', grade: a.grade, feedback: 'Muy buen trabajo, Ana.' } : {}),
      },
    });
  }
  await prisma.evaluation.createMany({
    data: [
      { subjectId: HIS.id, studentId: ana.id, teacherId: teacher.id, title: 'Participación en clase', score: 90, weight: 1, educationalCenterId: center.id },
      { subjectId: CIE.id, studentId: ana.id, teacherId: teacher.id, title: 'Práctica de laboratorio', score: 84, weight: 2, educationalCenterId: center.id },
    ],
  });
  console.log('📄 Tareas y calificaciones de Ana sembradas (Historia y Ciencias).');

  // ---------------------------------------------------------------
  // 1. Mensajería: una conversación DIRECT por cada par de roles que la
  //    política de messaging.policy.ts permite y que hoy no tiene ni un
  //    solo mensaje de ejemplo. Los horarios son relativos a "ahora" para
  //    que el hilo se vea como una conversación real, no mensajes todos
  //    con el mismo timestamp.
  // ---------------------------------------------------------------
  type SeedMessage = { senderId: number; body: string; minutesAgo: number };

  async function seedConversation(
    label: string,
    participantIds: number[],
    createdById: number,
    messages: SeedMessage[],
    opts: { unreadFor?: number[]; type?: ConversationType; subject?: string } = {},
  ) {
    const users = await prisma.user.findMany({ where: { id: { in: participantIds } }, select: { id: true, educationalCenterId: true } });
    const centers = new Set(users.map((u) => u.educationalCenterId).filter((c): c is number => c != null));
    const conversationCenterId = centers.size === 1 ? Array.from(centers)[0] : null;

    const conversation = await prisma.conversation.create({
      data: {
        type: opts.type ?? ConversationType.DIRECT,
        subject: opts.subject,
        createdById,
        educationalCenterId: conversationCenterId,
        participants: { create: participantIds.map((userId) => ({ userId })) },
      },
    });

    for (const m of messages) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: m.senderId,
          body: m.body,
          educationalCenterId: conversationCenterId,
          createdAt: minutesAgo(now, m.minutesAgo),
        },
      });
    }

    // lastReadAt: todos los participantes quedan al día con el último
    // mensaje salvo los que se marcan explícitamente "sin leer" (para que
    // los badges de no-leídos del navbar y de los dashboards tengan algo
    // real que mostrar en la demo, no un 0 en todos lados).
    const lastMessageAt = minutesAgo(now, messages[messages.length - 1]?.minutesAgo ?? 0);
    const unread = new Set(opts.unreadFor ?? []);
    for (const userId of participantIds) {
      await prisma.conversationParticipant.updateMany({
        where: { conversationId: conversation.id, userId },
        data: { lastReadAt: unread.has(userId) ? null : lastMessageAt },
      });
    }

    console.log(`💬 Conversación sembrada: ${label} (${messages.length} mensaje(s)).`);
    return conversation;
  }

  // Admin <-> Centro: escalamiento (alimenta el stat "Reportes Sin Leer" de AdminDashboard).
  await seedConversation('Admin <-> Centro', [admin.id, centro.id], centro.id, [
    { senderId: centro.id, body: 'Buenas, les escribo porque tuvimos una caída del sistema de calificaciones ayer en la tarde, ¿es algo conocido?', minutesAgo: 60 * 26 },
    { senderId: admin.id, body: 'Hola, gracias por avisar. Fue un mantenimiento programado de la base de datos, ya debería estar normalizado. Cualquier cosa me escribes.', minutesAgo: 60 * 25 },
    { senderId: centro.id, body: 'Perfecto, ya lo verifiqué y está funcionando bien. ¡Gracias!', minutesAgo: 60 * 24 },
  ], { unreadFor: [admin.id] });

  // Centro <-> Profesor
  await seedConversation('Centro <-> Profesor', [centro.id, teacher.id], centro.id, [
    { senderId: centro.id, body: 'Buenas Lic. Pérez, ¿cómo va el grupo este periodo?', minutesAgo: 60 * 20 },
    { senderId: teacher.id, body: 'Buenas, bastante bien. Los de Matemáticas están un poco atrasados con la tarea de ecuaciones, les voy a dar un par de días más.', minutesAgo: 60 * 19 },
    { senderId: centro.id, body: 'Perfecto, avísame si necesitas que hable con algún padre.', minutesAgo: 60 * 18 },
  ], { unreadFor: [teacher.id] });

  // Centro <-> Padre
  await seedConversation('Centro <-> Padre (Roberto)', [centro.id, roberto.id], roberto.id, [
    { senderId: roberto.id, body: 'Buenas tardes, quería preguntar por el proceso de inscripción de mi segunda hija, Ana, para este periodo.', minutesAgo: 60 * 48 },
    { senderId: centro.id, body: 'Hola Roberto, con gusto. Ana ya quedó inscrita en Historia y Ciencias este periodo, cualquier duda me dices.', minutesAgo: 60 * 47 },
    { senderId: roberto.id, body: 'Excelente, muchas gracias por la rapidez.', minutesAgo: 60 * 46 },
  ]);

  // Centro <-> Estudiante (canal limitado / "buzón de sugerencias" en la UI de Student)
  await seedConversation('Centro <-> Estudiante (buzón de sugerencias)', [centro.id, pedro.id], pedro.id, [
    { senderId: pedro.id, body: '💡 Sugerencia: Sería genial poder subir las tareas desde el celular directamente.', minutesAgo: 60 * 10 },
    { senderId: centro.id, body: '¡Gracias por la sugerencia, Pedro! La vamos a tener en cuenta para futuras mejoras.', minutesAgo: 60 * 9 },
  ], { unreadFor: [pedro.id] });

  // Profesor <-> Estudiante (x2, materias distintas)
  await seedConversation('Profesor <-> Pedro', [teacher.id, pedro.id], pedro.id, [
    { senderId: pedro.id, body: 'Profe, tengo una duda con la tarea de Geometría, ¿el área va en cm² o en metros?', minutesAgo: 180 },
    { senderId: teacher.id, body: 'Hola Pedro, en cm² está bien ya que las medidas que di están en centímetros.', minutesAgo: 170 },
    { senderId: pedro.id, body: '¡Perfecto, gracias!', minutesAgo: 165 },
  ]);
  await seedConversation('Profesor <-> María', [teacher.id, maria.id], maria.id, [
    { senderId: maria.id, body: 'Profe, ¿el examen de historia sigue abierto? No alcancé a responderlo la semana pasada.', minutesAgo: 400 },
    { senderId: teacher.id, body: 'Hola María, sí sigue abierto, tienes tiempo todavía. Cualquier duda me avisas.', minutesAgo: 395 },
  ]);

  // Profesor <-> Padre
  await seedConversation('Profesor <-> Padre (Roberto, sobre Pedro)', [teacher.id, roberto.id], teacher.id, [
    { senderId: teacher.id, body: 'Buenas Roberto, le escribo para comentarle que Pedro tuvo un gran desempeño en el examen de Matemáticas.', minutesAgo: 90 },
    { senderId: roberto.id, body: '¡Qué buena noticia, muchas gracias por avisarme Profe!', minutesAgo: 85 },
    { senderId: teacher.id, body: 'Con gusto. Cualquier novedad le aviso.', minutesAgo: 80 },
  ], { unreadFor: [roberto.id] });

  // Estudiante <-> Estudiante (compañeros de clase, x2 parejas)
  await seedConversation('Pedro <-> María (compañeros)', [pedro.id, maria.id], pedro.id, [
    { senderId: pedro.id, body: 'Oye María, ¿ya hiciste la tarea de Ciencias? No entendí bien lo de la fotosíntesis.', minutesAgo: 240 },
    { senderId: maria.id, body: 'Sí, básicamente es cómo las plantas convierten la luz solar en energía. Te paso mis apuntes si quieres.', minutesAgo: 235 },
    { senderId: pedro.id, body: 'Dale, ¡te lo agradezco mucho!', minutesAgo: 230 },
  ]);
  await seedConversation('Carlos <-> Diego (compañeros)', [carlos.id, diego.id], carlos.id, [
    { senderId: carlos.id, body: '¿Vamos a estudiar juntos para el examen de Literatura?', minutesAgo: 300 },
    { senderId: diego.id, body: 'Sí, dale, ¿quedamos a las 4pm en la biblioteca?', minutesAgo: 295 },
    { senderId: carlos.id, body: 'Perfecto, ahí nos vemos.', minutesAgo: 290 },
  ]);

  // Padre <-> Padre (hijas comparten materia de Ciencias: Ana y María)
  await seedConversation('Roberto <-> Marta (padres)', [roberto.id, marta.id], roberto.id, [
    { senderId: roberto.id, body: 'Hola Marta, vi que nuestras hijas comparten la materia de Ciencias, ¿sabes si ya les asignaron el proyecto de reciclaje?', minutesAgo: 600 },
    { senderId: marta.id, body: 'Hola Roberto, sí, según María ya se los explicaron en clase, tienen hasta la otra semana.', minutesAgo: 590 },
    { senderId: roberto.id, body: 'Perfecto, ¡gracias por la información!', minutesAgo: 580 },
  ]);

  // Anuncio del profesor a todo el grupo de Matemáticas (demuestra el tipo
  // ANNOUNCEMENT: solo el creador puede escribir mensajes nuevos).
  await seedConversation(
    'Anuncio del Profesor - Matemáticas',
    [teacher.id, pedro.id, maria.id, carlos.id, diego.id, sofia.id],
    teacher.id,
    [{ senderId: teacher.id, body: '📢 Aviso: el examen de Matemáticas se reprograma para el próximo lunes por el feriado. ¡Sigan repasando!', minutesAgo: 60 * 3 }],
    { type: ConversationType.ANNOUNCEMENT, subject: 'Aviso de Matemáticas', unreadFor: [pedro.id, maria.id, carlos.id, diego.id, sofia.id] },
  );

  // ---------------------------------------------------------------
  // 2. Calendario: más eventos CENTER/SUBJECT/PERSONAL repartidos en el
  //    tiempo (algunos ya pasados, para que el calendario no se vea como
  //    si la escuela acabara de abrir la semana pasada).
  // ---------------------------------------------------------------
  let calendarCount = 0;

  const centerEvents: { title: string; description: string; startInDays: number; allDay?: boolean }[] = [
    { title: 'Reunión de Centro - Fin de Periodo', description: 'Reunión informativa para todo el personal y representantes sobre el cierre del periodo.', startInDays: 21 },
    { title: 'Entrega de Boletines', description: 'Entrega de boletines de calificaciones a los representantes.', startInDays: 28, allDay: true },
    { title: 'Día del Estudiante', description: 'Actividades recreativas para todo el centro, suspensión de clases regulares.', startInDays: -10, allDay: true },
  ];
  for (const e of centerEvents) {
    await prisma.calendarEvent.create({
      data: {
        title: e.title,
        description: e.description,
        startsAt: addDays(now, e.startInDays),
        endsAt: addDays(now, e.startInDays),
        allDay: e.allDay ?? false,
        scope: CalendarEventScope.CENTER,
        createdById: centro.id,
        educationalCenterId: center.id,
      },
    });
    calendarCount++;
  }

  // Un segundo evento SUBJECT (examen parcial) para Matemáticas e Historia,
  // además del "Entrega final" que ya sembraba seed-demo-content.ts.
  await prisma.calendarEvent.create({
    data: {
      title: 'Examen Parcial - Matemáticas',
      description: 'Segundo examen parcial del periodo.',
      startsAt: addDays(now, 7),
      endsAt: new Date(addDays(now, 7).getTime() + 1 * HOUR_MS),
      allDay: false,
      scope: CalendarEventScope.SUBJECT,
      subjectId: MAT.id,
      createdById: teacher.id,
      educationalCenterId: center.id,
    },
  });
  calendarCount++;
  await prisma.calendarEvent.create({
    data: {
      title: 'Presentación de mapas conceptuales',
      description: 'Cada alumno expone su mapa conceptual de Civilizaciones Antiguas.',
      startsAt: addDays(now, 11),
      endsAt: new Date(addDays(now, 11).getTime() + 1 * HOUR_MS),
      allDay: false,
      scope: CalendarEventScope.SUBJECT,
      subjectId: HIS.id,
      createdById: teacher.id,
      educationalCenterId: center.id,
    },
  });
  calendarCount++;

  // Eventos PERSONAL para varios roles (antes solo existía 1, de Pedro).
  const personalEvents: { title: string; description: string; ownerId: number; startInDays: number }[] = [
    { title: 'Preparar examen de Literatura', description: 'Recordatorio personal: revisar las preguntas antes de aplicar el examen.', ownerId: teacher.id, startInDays: 6 },
    { title: 'Reunión de padres y representantes', description: 'Recordatorio personal.', ownerId: roberto.id, startInDays: 21 },
    { title: 'Estudiar para el examen de Ciencias', description: 'Recordatorio personal.', ownerId: ana.id, startInDays: 9 },
    { title: 'Entregar tarea de Literatura', description: 'Recordatorio personal.', ownerId: carlos.id, startInDays: 4 },
  ];
  for (const e of personalEvents) {
    await prisma.calendarEvent.create({
      data: {
        title: e.title,
        description: e.description,
        startsAt: addDays(now, e.startInDays),
        endsAt: addDays(now, e.startInDays),
        allDay: true,
        scope: CalendarEventScope.PERSONAL,
        ownerId: e.ownerId,
        createdById: e.ownerId,
        educationalCenterId: center.id,
      },
    });
    calendarCount++;
  }
  console.log(`📅 ${calendarCount} evento(s) de calendario adicionales creados (${centerEvents.length} de centro, 2 de materia, ${personalEvents.length} personales).`);

  console.log('✅ Mensajería y calendario de demostración sembrados con éxito.');
  console.log('   Nueva cuenta: parent2@aula.com (Marta Rodríguez, madre de María) y ana@aula.com (Ana Jiménez, hermana de Pedro) — password 123456.');
}

main()
  .catch((e) => {
    console.error('❌ Error sembrando mensajería y calendario de demostración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
