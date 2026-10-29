# Aula SAPM v2.0 — Fundamento Multi-Centro + Centro de Mensajería

Autor: Bryan Reyes + Claude (pair de arquitectura)
Fecha: 2026-09-11

## 0. Contexto: diagnóstico previo

Antes de diseñar esto se auditó el repo real (`main`, commit `ba54855`). Hallazgos relevantes que motivan este documento:

- No existe `EducationalCenter`, ni el campo `educationalCenterId`, en ningún modelo. Ya se había intentado y revertido (ver comentario en `student.controller.ts`).
- `RoleName` solo tiene `ADMIN | TEACHER | STUDENT | PARENT`. No existe rol `CENTRO`.
- No existen `Notification` ni `Billing` como modelos Prisma.
- El modelo de tareas es `Assignment`, no `Task`. `task.controller.ts` / `task.routes.ts` son código huérfano (usan `prisma.task`, que no existe, e importan `../utils/assertRole`, que tampoco existe). No están montados en `server.ts`.
- `admin.routes.ts` tampoco está montado; importa `allowRoles` (la función real se llama `authorizeRoles`) y un `admin.controller.ts` inexistente.
- `authorizeRoles` está duplicado en `auth.middleware.ts` y `role.middleware.ts`.
- Frontend real: React 19 + TypeScript + Vite + Tailwind (no vanilla JS).

Decisión tomada con Bryan: construir primero el fundamento multi-centro (EducationalCenter + rol CENTRO + tenant scoping), y sobre esa base, el Centro de Mensajería con `educationalCenterId` desde el día 1.

---

## 1. Fundamento Multi-Tenant (prerequisito arquitectónico)

### 1.1 Decisiones de diseño

**¿Quién es "global" y quién pertenece a un centro?**
`ADMIN` se modela como rol de plataforma (dueño del SaaS, gestiona múltiples centros) → `educationalCenterId` **nullable** en `User` para ADMIN. Los roles `CENTRO`, `TEACHER`, `STUDENT`, `PARENT` pertenecen exactamente a un centro (1:N simple). No se modela membership multi-centro por usuario todavía (YAGNI): si en el futuro un maestro trabaja en dos centros, se resuelve con una tabla pivote `UserCenterMembership` sin romper lo existente, porque hoy es un FK simple.

**¿Dónde vive `educationalCenterId`?**
Se denormaliza (se copia) en toda entidad que se consulta/lista directamente y que debe estar aislada por tenant: `User`, `Subject`, y luego `Conversation`/`Message`/`Notification`. No se deja solo como un join implícito (`Assignment -> Subject -> educationalCenterId`) porque en un SaaS educativo con datos de menores, una fuga de datos entre colegios es el peor escenario posible. Preferimos "cinturón y tirantes": columna indexada + filtro explícito en cada query, aunque signifique un poco de denormalización.

**¿Cómo se aplica el filtro?**
Se usa un helper explícito por controlador (`assertSameCenter(req, resourceCenterId)` / agregar `educationalCenterId: req.user.educationalCenterId` a los `where`), no un middleware "mágico" de Prisma que reescriba queries globalmente. Motivo: con un equipo pequeño, código explícito es más fácil de auditar y de revisar en PR que una extensión global de Prisma cuyo comportamiento no es obvio leyendo el controlador. Si el número de endpoints crece mucho (50+), se puede migrar a un Prisma Client Extension centralizado sin cambiar el modelo de datos.

### 1.2 Cambios de schema

```prisma
enum RoleName {
  ADMIN
  CENTRO
  TEACHER
  STUDENT
  PARENT
}

model EducationalCenter {
  id        Int      @id @default(autoincrement())
  name      String
  code      String   @unique   // slug, ej. "colegio-san-martin"
  logoUrl   String?
  isActive  Boolean  @default(true)

  users     User[]
  subjects  Subject[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  // ...campos existentes...
  educationalCenterId Int?
  educationalCenter   EducationalCenter? @relation(fields: [educationalCenterId], references: [id])

  @@index([educationalCenterId])
}

model Subject {
  // ...campos existentes...
  educationalCenterId Int
  educationalCenter   EducationalCenter @relation(fields: [educationalCenterId], references: [id])

  @@index([educationalCenterId])
}
```

`Assignment` y `Exam` NO necesitan la columna directa: se derivan de `Subject.educationalCenterId` en la query (`where: { subject: { educationalCenterId } }`). Es un compromiso consciente: son entidades "hoja" que siempre se acceden a través de una materia, así que el join es seguro y evita duplicar la columna en cinco tablas más.

### 1.3 JWT y request context

El payload del JWT pasa a incluir `educationalCenterId` (puede ser `null` para ADMIN), para no hacer un roundtrip a la BD en cada request:

```ts
export interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: RoleName;
    educationalCenterId: number | null;
  };
}
```

### 1.4 Migración (backfill sin romper producción)

1. Migración 1: agregar `CENTRO` al enum (Postgres permite `ALTER TYPE ... ADD VALUE`, pero Prisma migrate a veces necesita que esta migración corra *fuera* de la misma transacción que otros cambios del mismo archivo — si `prisma migrate dev` falla con error de enum+transacción, se separa en su propio archivo de migración).
2. Migración 2: crear tabla `EducationalCenter`, agregar `educationalCenterId` nullable en `User` y `Subject`.
3. Script de backfill (seed/migración de datos): crear un registro `EducationalCenter` "Centro Legacy" y asignar ese id a todos los `User` y `Subject` existentes.
4. (Opcional, migración futura) volver `Subject.educationalCenterId` `NOT NULL` una vez confirmado el backfill.
5. Arreglar el bug de comparación de roles como string (`'Admin'`, `'Centro'` en `admin.routes.ts` vs el enum `ADMIN`/`CENTRO` en mayúsculas) al tocar esta zona — hoy ese archivo ni siquiera está montado, así que no afecta producción, pero si se reactiva hay que corregirlo.

---

## 2. Centro de Mensajería

### 2.1 Por qué este modelo de datos

Se descarta un modelo plano `Message { senderId, receiverId }` porque no escala a mensajes grupales, complica el conteo de "no leídos" (habría que buscar en dos columnas) y no permite anuncios uno-a-muchos. Se usa el patrón estándar de apps de mensajería (Gmail/Slack/Teams): **Conversation → ConversationParticipant → Message**.

El conteo de "no leídos" NO se modela con una tabla `MessageRead` por mensaje-por-usuario (explotaría en filas: 1000 mensajes × 30 participantes = 30,000 filas por conversación). Se modela con una sola columna `lastReadAt` en `ConversationParticipant`: "no leídos" = `count(messages where createdAt > lastReadAt)`, y "marcar leído" = `update lastReadAt = now()`, ambas O(1) o O(log n) con índice, en vez de O(mensajes).

### 2.2 Schema Prisma

```prisma
enum ConversationType {
  DIRECT        // 1 a 1
  GROUP         // varios participantes, todos pueden responder
  ANNOUNCEMENT  // Centro/Admin -> broadcast, solo el creador puede escribir
}

model Conversation {
  id                  Int      @id @default(autoincrement())
  type                ConversationType
  subject             String?  // "asunto", opcional
  educationalCenterId Int
  educationalCenter   EducationalCenter @relation(fields: [educationalCenterId], references: [id])

  createdById         Int
  createdBy           User     @relation("ConversationsCreated", fields: [createdById], references: [id])

  participants        ConversationParticipant[]
  messages            Message[]

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([educationalCenterId])
}

model ConversationParticipant {
  id             Int      @id @default(autoincrement())
  conversationId Int
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId         Int
  user           User     @relation("ConversationParticipations", fields: [userId], references: [id])

  lastReadAt     DateTime?
  isArchived     Boolean  @default(false)
  joinedAt       DateTime @default(now())

  @@unique([conversationId, userId])
  @@index([userId])
}

model Message {
  id                  Int      @id @default(autoincrement())
  conversationId      Int
  conversation        Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  senderId            Int
  sender              User     @relation("MessagesSent", fields: [senderId], references: [id])

  body                String
  educationalCenterId Int      // denormalizado, ver sección 1.1

  createdAt           DateTime @default(now())
  editedAt            DateTime?
  deletedAt           DateTime?  // soft delete, para no romper el hilo de otros participantes

  @@index([conversationId, createdAt])
  @@index([educationalCenterId])
}
```

Agregar a `User`:
```prisma
  conversationsCreated   Conversation[]            @relation("ConversationsCreated")
  conversationsParticipating ConversationParticipant[] @relation("ConversationParticipations")
  messagesSent           Message[]                 @relation("MessagesSent")
```

**Adjuntos (Bloque 6, fase futura):** se deja el modelo listo para extenderse sin migración destructiva — cuando exista el modelo `Attachment` genérico, se agrega `attachments Attachment[]` a `Message` como tabla nueva + relación nueva (no rompe nada existente).

**Drafts:** marcado como opcional en el brief. No se modela ahora. Si se pide después, la opción más barata es un `Conversation` con un participante único y sin mensajes hasta el envío — no necesita tabla propia.

### 2.3 Matriz de permisos (política centralizada)

Se centraliza en un servicio `messaging.policy.ts` (Single Responsibility + Open/Closed: agregar un rol nuevo no toca los controladores), en vez de esparcir `if (role === ...)` en cada endpoint.

| Rol      | Puede iniciar conversación con                                             | Puede crear GROUP/ANNOUNCEMENT |
|----------|------------------------------------------------------------------------------|---------------------------------|
| ADMIN    | Cualquier usuario, cualquier centro (soporte/operación de plataforma)        | Sí, cualquier alcance           |
| CENTRO   | Cualquier usuario dentro de su propio centro                                 | Sí, alcance = su centro         |
| TEACHER  | Estudiantes inscritos en sus materias, padres de esos estudiantes, otros maestros/Centro de su centro | Grupo limitado a sus materias   |
| STUDENT  | Maestros de sus materias inscritas, Centro/Admin (soporte)                   | No                               |
| PARENT   | Maestros de las materias de sus hijos, Centro/Admin (soporte)                | No                               |

Regla de seguridad infantil por defecto: **no se permite mensajería estudiante-a-estudiante** en esta fase (a confirmar contigo, ver sección 4). Si se necesita luego, se habilita por configuración de centro.

### 2.4 Endpoints

| Método | Ruta                                              | Rol                          | Descripción |
|--------|----------------------------------------------------|-------------------------------|-------------|
| GET    | `/api/messages/contacts`                            | todos                          | Lista de usuarios con los que el actor puede iniciar conversación, según la matriz de 2.3 |
| POST   | `/api/messages/conversations`                       | todos (según política)         | Crea conversación DIRECT/GROUP/ANNOUNCEMENT |
| GET    | `/api/messages/conversations`                       | todos                          | Inbox: conversaciones del usuario, con último mensaje y `unreadCount` |
| GET    | `/api/messages/conversations/:id`                   | participante                   | Detalle + mensajes paginados (cursor) |
| POST   | `/api/messages/conversations/:id/messages`          | participante (con permiso de escritura) | Enviar mensaje; en `ANNOUNCEMENT` solo el creador |
| PATCH  | `/api/messages/conversations/:id/read`              | participante                   | `lastReadAt = now()` |
| PATCH  | `/api/messages/conversations/:id/archive`           | participante                   | Archivar (oculta de inbox, no borra) |
| GET    | `/api/messages/unread-count`                        | todos                          | Contador global para badge de navbar |

Todas las queries filtran por `educationalCenterId = req.user.educationalCenterId` salvo ADMIN (global). El ownership check de "¿este usuario es participante de esta conversación?" sigue el mismo patrón de ownership checks que ya existe en el proyecto (mencionado en la sección de Seguridad del brief), para mantener consistencia de estilo.

### 2.5 Notificaciones automáticas

El modelo `Notification` tampoco existe hoy pese a estar listado como completado. Como la mensajería depende de él ("notificaciones automáticas" es requisito explícito del Bloque 1), se crea aquí, mínimo viable:

```prisma
enum NotificationType {
  NEW_MESSAGE
  ANNOUNCEMENT
  TASK_ASSIGNED
  GRADE_PUBLISHED
  SYSTEM
}

model Notification {
  id                  Int      @id @default(autoincrement())
  userId              Int
  user                User     @relation(fields: [userId], references: [id])
  type                NotificationType
  title               String
  body                String?
  link                String?   // deep link, ej. /messages/conversations/12
  isRead              Boolean  @default(false)
  educationalCenterId Int

  createdAt           DateTime @default(now())

  @@index([userId, isRead])
}
```

Al crear un `Message`, se crea una `Notification(type: NEW_MESSAGE)` para cada participante distinto del emisor. En v2.0 esto es polling (el frontend consulta `unread-count` cada cierto intervalo); WebSockets/Socket.io queda como mejora de fase futura, no bloqueante.

### 2.6 Escalabilidad

- Paginación por cursor (`createdAt`/`id`) en mensajes, no offset — los hilos crecen indefinidamente y offset degrada linealmente.
- Índices compuestos ya incluidos en el schema (`conversationId+createdAt`, `educationalCenterId`).
- Rate limiting anti-spam: recomendado para fase de producción, no bloqueante para el MVP de este bloque.

---

## 3. Orden de implementación recomendado (PRs)

1. **PR1** — `EducationalCenter` + rol `CENTRO` + `educationalCenterId` en `User`/`Subject` + JWT payload + migración con backfill a "Centro Legacy".
2. **PR2** — Helper de autorización de tenant (`assertSameCenter`) aplicado retroactivamente a los endpoints existentes (Subject, Assignment, Exam, Users), para cumplir "todo acceso respeta educationalCenterId" también en lo ya construido.
3. **PR3** — Modelo `Notification` mínimo.
4. **PR4** — Mensajería: `Conversation`/`ConversationParticipant`/`Message` + endpoints + `messaging.policy.ts`.
5. **PR5 (housekeeping, en paralelo, no bloqueante)** — eliminar o reparar código huérfano: `task.controller.ts`, `task.routes.ts`, `admin.routes.ts` (referencia un `admin.controller.ts` inexistente), y unificar `authorizeRoles` duplicado en un solo middleware.

## 4. Decisiones pendientes de confirmar con Bryan

- ¿Estudiante-a-estudiante debe estar permitido en mensajería? Propuesta: no, por defecto, en fase 1.
- ¿`ADMIN` es rol de plataforma (multi-centro, como propietario del SaaS) o cada centro debe tener su propio "super admin" separado de `CENTRO`? Se asumió: `ADMIN` = plataforma, `CENTRO` = admin del colegio.
- ¿Un usuario pertenece a un único centro para siempre, o se necesita multi-membership desde ya? Propuesta: único centro por ahora (YAGNI), migrable después sin romper nada.

---

## 5. Estado de implementación (PR1–PR4)

Implementado en el repo el 2026-09-11:

- **Schema** (`prisma/schema.prisma`): `EducationalCenter`, rol `CENTRO`, `educationalCenterId` en `User`/`Subject` (nullable), `Conversation`/`ConversationParticipant`/`Message`, `Notification`. `Conversation.educationalCenterId` y `Message.educationalCenterId` son nullable (ver comentarios en el schema): el control de acceso real de una conversación es "eres participante", no el centro.
- **Auth**: `auth.middleware.ts` y `auth.controller.ts` propagan `educationalCenterId` en el JWT y en `AuthRequest.user`.
- **Tenant helper**: `src/utils/tenant.ts` (`assertSameCenter`, `centerWhere`, `requireUserCenter`, `HttpError`). Aplicado a `subject.controller.ts` (crear materia hereda el centro del profesor; listar materias se filtra por centro) y `users.controller.ts` (crear usuario exige `educationalCenterId` salvo ADMIN).
- **Centros**: `center.controller.ts` + `center.routes.ts` montado en `/api/centers` (CRUD básico + `assign-user`).
- **Mensajería**: `messaging.policy.ts` (matriz de permisos, sin estudiante-a-estudiante), `messaging.controller.ts` + `messaging.routes.ts` montado en `/api/messages` (los 8 endpoints de la sección 2.4).
- **Notificaciones**: `notification.service.ts` + `notification.controller.ts` + `notification.routes.ts` montado en `/api/notifications`. Se dispara automáticamente al crear un mensaje.
- **Seed**: `prisma/seed.ts` reescrito para crear un centro y usuarios/materias válidos contra el nuevo schema (de paso se corrigió un bug preexistente: creaba `Subject` sin `code`/`teacherId`, que ya eran obligatorios).
- **Backfill**: `prisma/backfill-legacy-center.ts`, script idempotente para correr una vez después de migrar.

**Pendiente, fuera de esta pasada (siguiente PR recomendado):**
- Aplicar `assertSameCenter`/`centerWhere` a `assignment.controller.ts`, `exam.controller.ts`, `dashboard.controller.ts`, `report.controller.ts`, `course.controller.ts`, `student.controller.ts` — no se tocaron en esta pasada porque tenían cambios sin commitear de otra sesión de trabajo y no se pudieron probar (ver limitación de entorno abajo).
- PR5 (housekeeping): `task.controller.ts`/`task.routes.ts`/`admin.routes.ts` siguen huérfanos y sin compilar; no se tocaron.

**Limitación de entorno importante:** el sandbox usado para esta sesión no pudo ejecutar `prisma generate` / `prisma migrate dev` (motor de Prisma para Linux bloqueado por la política de red del sandbox, que solo tiene cacheados los binarios de Windows). El schema y el código quedaron escritos y revisados con `tsc --noEmit` (sin errores nuevos más allá de los esperados por el cliente Prisma desactualizado), pero **hace falta correr esto en tu máquina** antes de que compile y funcione:

```bash
cd backend
npx prisma migrate dev --name add_multicenter_and_messaging
npx ts-node prisma/backfill-legacy-center.ts
```

---

## 6. Bloque 2 — Foros por materia (implementado 2026-09-18)

Mismo patrón arquitectónico que el Centro de Mensajería, con permisos centralizados en `services/forum.policy.ts` en vez de repetidos en el controller.

**Modelo:** `ForumThread` (tema, uno por hilo, con `isPinned`/`isLocked`) → `ForumPost` (respuestas, soft-delete con `deletedAt` para moderación sin romper el hilo de otros). Ambos denormalizan `educationalCenterId` igual que `Message`/`Notification`, nullable por el mismo motivo.

**Regla de negocio (Bloque 2 del brief):** "Maestro crea temas, Estudiantes responden, Moderación."
- Crear un tema: solo el profesor dueño de la materia, o Centro/Admin (`canModerateSubject`).
- Responder: cualquiera con acceso al foro de esa materia (profesor dueño, estudiante inscrito con `ACTIVE`, Centro/Admin), salvo que el tema esté `isLocked`.
- Moderar (fijar, cerrar, borrar cualquier post): profesor dueño, Centro, Admin. Un estudiante solo puede borrar su propio post.
- Deliberadamente sin acceso de `PARENT` (no está en el alcance de este bloque).

**Endpoints** (montados en `/api/forums`, todos requieren `authenticateToken`):

| Método | Ruta | Quién |
|---|---|---|
| POST | `/subjects/:subjectId/threads` | Profesor dueño / Centro / Admin |
| GET | `/subjects/:subjectId/threads` | Cualquiera con acceso al foro |
| GET | `/threads/:id` | Cualquiera con acceso al foro (paginado por cursor) |
| POST | `/threads/:id/posts` | Cualquiera con acceso, si no está `isLocked` |
| PATCH | `/threads/:id/lock` | Quien modera |
| PATCH | `/threads/:id/pin` | Quien modera |
| DELETE | `/posts/:id` | Autor propio, o quien modera |

Una respuesta nueva crea automáticamente una `Notification` (`FORUM_REPLY`) para el autor del tema, reutilizando `notification.service.ts` — cero código nuevo de notificaciones para este bloque.

**Pendiente para aplicar:** falta correr `npx prisma migrate dev --name add_forums` (agrega `ForumThread`, `ForumPost`, y el valor `FORUM_REPLY` al enum `NotificationType`) y `npx prisma generate`. No se pudo ejecutar desde este entorno por la misma limitación de binario de Prisma para Linux ya documentada arriba.

**Confirmado 2026-10-26:** migración `add_forums` y `prisma generate` corridos con éxito en tu máquina. `/api/forums` ya estaba montado correctamente en `server.ts` (lo verifiqué al retomar para Bloque 3, no hizo falta corregir nada ahí).

---

## 7. Bloque 3 — Calificaciones (implementado 2026-10-26)

Mismo patrón que Mensajería y Foros: permisos centralizados en un `*.policy.ts`, lógica de negocio (el cálculo del promedio) separada en un `*.service.ts` sin mezclarse con el controller, y `asyncHandler` + `HttpError` para no repetir try/catch.

### 7.1 Modelo de datos

- **`GradePeriod`** (periodo académico: "1er Parcial", "2do Trimestre"...): `name`, `startDate`, `endDate`, `isActive`, `educationalCenterId` nullable (un periodo de ADMIN es global —`null`—, visible para todos los centros; uno de CENTRO es propio).
- **`Evaluation`** (nota manual del profesor, ej. participación, proyecto, examen oral no modelado como `Exam`): `subjectId`, `studentId`, `teacherId`, `periodId` opcional, `title`, `score` (0-100), `weight` (default 1), `comment` opcional. Denormaliza `educationalCenterId` igual que `Message`/`ForumThread`, nullable por el mismo motivo (filtro directo sin join).

Deliberadamente **no** se creó un modelo nuevo para las notas de tareas y exámenes: esos ya existen (`Assignment.grade`, `ExamSubmission.score`) y `Evaluation` solo cubre lo que no tenía dónde vivir. El promedio por materia combina las tres fuentes en tiempo de cálculo (ver 7.2) en vez de duplicar datos.

### 7.2 Cálculo del promedio (`services/grades.service.ts`)

`computeSubjectAverage(studentId, subjectId)` combina, con su propio peso cada una:

1. **Tareas** (`Assignment`) con `status = GRADED` y `grade` no nulo, **solo las asignadas directamente a ese alumno** (`studentId` de la tarea = ese alumno). Peso 1.
   - Nota de diseño: una tarea "para toda la materia" (`Assignment.studentId = null`) comparte una sola fila con un único campo `grade`, sin una nota por-alumno en el modelo actual — es una limitación preexistente del schema de Tareas (fuera del alcance de este bloque), así que esas filas no entran al promedio individual. Si se quiere soportar en el futuro, hace falta que Tareas pase a modelar la entrega/calificación por alumno (una fila de "submission" en vez de reusar `Assignment`).
2. **Exámenes** (`ExamSubmission`) con `score` no nulo, normalizado a escala 0-100: `(score / Σ puntos de las preguntas del examen) * 100`. Peso 1.
3. **Evaluaciones manuales** (`Evaluation`), con su propio `weight`.

Promedio final = `Σ(score × weight) / Σ(weight)`, redondeado a 1 decimal; `average: null` si no hay ninguna nota todavía (en vez de `0`, para no confundir "sin calificar" con "reprobado").

`computeStudentHistory(studentId)` recorre todas las materias donde el alumno tiene inscripción `ACTIVE`, calcula el promedio de cada una y devuelve además un `overallAverage`: la media simple de los promedios de materia que sí tienen nota (cada materia pesa igual, no se pondera por cantidad de evaluaciones).

### 7.3 Permisos (`services/grades.policy.ts`)

- **`canGradeSubject(actor, subject)`** — quién puede crear/editar/borrar `Evaluation` en una materia: ADMIN siempre, CENTRO si es su centro, TEACHER si es el dueño de la materia.
- **`assertCanViewStudentGrades(actor, studentId)`** — quién puede ver las notas de un alumno dado: ADMIN siempre; STUDENT solo las propias; PARENT solo si `studentId` es un hijo vinculado (`ParentChild`); CENTRO solo si el alumno es de su centro; TEACHER solo si comparte al menos una materia con inscripción `ACTIVE` con ese alumno (igual criterio que `messaging.policy.ts` usa para habilitar contacto profesor↔alumno).

### 7.4 Endpoints (montados en `/api/grades`, todos requieren `authenticateToken`)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/periods` | Cualquiera autenticado (ve los de su centro + los globales; ADMIN ve todos) |
| POST | `/periods` | Admin o Centro |
| POST | `/subjects/:subjectId/evaluations` | Quien puede calificar la materia |
| GET | `/subjects/:subjectId/evaluations?studentId=` | STUDENT (las suyas); otros con `?studentId=` + `assertCanViewStudentGrades`; quien puede calificar, sin `?studentId=`, ve el listado completo |
| PATCH | `/evaluations/:id` | Quien puede calificar la materia de esa evaluación |
| DELETE | `/evaluations/:id` | Quien puede calificar la materia de esa evaluación |
| GET | `/subjects/:subjectId/average?studentId=` | STUDENT (la suya); otros con `?studentId=` + `assertCanViewStudentGrades` |
| GET | `/students/:studentId/history` | Quien pase `assertCanViewStudentGrades` para ese alumno |

Crear una `Evaluation` dispara una `Notification` (`GRADE_PUBLISHED`) para el alumno, reutilizando `notification.service.ts` — otra vez cero código nuevo de notificaciones.

### 7.5 Pendiente para aplicar

Falta correr, en tu máquina:

```bash
cd backend
npx prisma migrate dev --name add_grades
npx prisma generate
```

Esto crea `GradePeriod` y `Evaluation`, y las relaciones nuevas en `User`/`Subject`. No se pudo ejecutar desde este entorno por la misma limitación de binario de Prisma para Linux ya documentada en la sección 5.

**Verificación manual sugerida una vez migrado** (con el seed actual: `teacher@aula.com` / `student@aula.com`, contraseña `123456`):
1. Login como `teacher@aula.com` → `POST /api/grades/subjects/:subjectId/evaluations` con `{ studentId, title, score }` sobre una materia propia con el alumno inscrito `ACTIVE`.
2. Login como `student@aula.com` → `GET /api/grades/subjects/:subjectId/average` debe incluir esa evaluación en el `breakdown` y calcular el promedio.
3. Confirmar que un `TEACHER` que no es dueño de la materia recibe 403 al intentar calificarla, y que un `STUDENT` que intenta ver el promedio de otro alumno también recibe 403.

**Confirmado 2026-10-26:** migración `add_grades` y `prisma generate` corridos con éxito; `npx tsc --noEmit` sin errores.

---

## 8. Bloque 4 — Asistencia (implementado 2026-10-26)

Mismo patrón que los bloques anteriores. La diferencia notable aquí es una decisión deliberada de **reutilizar** la política de Calificaciones en vez de duplicarla.

### 8.1 Modelo de datos

**`Attendance`**: un registro de asistencia por alumno/materia/día (`@@unique([subjectId, studentId, date])` — tomar asistencia dos veces el mismo día actualiza el mismo registro, no crea uno nuevo). Campos: `subjectId`, `studentId`, `date` (normalizada a medianoche UTC al grabar, para que la unicidad por día funcione sin importar la hora de captura), `status` (`AttendanceStatus`: `PRESENT`/`ABSENT`/`LATE`/`EXCUSED`), `recordedById` (quién la tomó), `comment` opcional. Denormaliza `educationalCenterId` igual que `Evaluation`/`Message`.

`User` necesita dos relaciones separadas hacia `Attendance` (es alumno en unas filas, y quien registró en otras): `attendanceAsStudent` (`"AttendanceOfStudent"`) y `attendanceRecorded` (`"AttendanceRecordedBy"`).

### 8.2 Permisos — reutilización deliberada de `grades.policy.ts`

La regla de "quién administra la asistencia de una materia" y "quién puede ver la asistencia de un alumno" es, por diseño de negocio, **idéntica** a la de Calificaciones: mismo profesor dueño (o Centro/Admin) administra; misma visibilidad Admin / alumno-propio / padre-vinculado / Centro-mismo-centro / profesor-con-materia-activa-en-común. En vez de copiar esa lógica, `services/attendance.policy.ts` reexporta `canGradeSubject` y `assertCanViewStudentGrades` de `grades.policy.ts` bajo los nombres `canManageAttendance` y `assertCanViewStudentAttendance`:

```ts
export const canManageAttendance = canGradeSubject;
export const assertCanViewStudentAttendance = assertCanViewStudentGrades;
```

Esto es Open/Closed en la práctica: si algún día la regla de asistencia deja de coincidir con la de calificaciones (por ejemplo, si se agrega un rol "Auxiliar" que solo puede tomar asistencia pero no calificar), se separan esas dos líneas en su propia implementación sin tocar nada más. Mientras coincidan, hay una sola fuente de verdad para no arriesgar que se desincronicen con el tiempo.

### 8.3 Cálculo de estadísticas (`services/attendance.service.ts`)

`computeAttendanceStats(studentId, subjectId)`: cuenta `PRESENT`/`ABSENT`/`LATE`/`EXCUSED` y calcula `attendanceRate = (PRESENT + LATE) / (total - EXCUSED) * 100`, redondeado a 1 decimal. Decisión de negocio: una ausencia justificada (`EXCUSED`) no cuenta en contra de la tasa (se excluye del denominador), y `LATE` sí cuenta como "asistió" (llegó tarde, pero llegó). `attendanceRate` es `null` cuando no hay ningún registro contable todavía, para no confundir "sin datos" con "0% de asistencia".

`computeStudentAttendanceHistory(studentId)` recorre todas las materias con inscripción `ACTIVE` y agrega un `overallAttendanceRate` (media simple de las tasas de materia que sí tienen registros), igual patrón que `computeStudentHistory` de Calificaciones.

### 8.4 Endpoints (montados en `/api/attendance`, todos requieren `authenticateToken`)

| Método | Ruta | Quién |
|---|---|---|
| POST | `/subjects/:subjectId` | Quien administra la materia (body: `{ date, records: [{ studentId, status, comment? }] }`, upsert por alumno/día) |
| GET | `/subjects/:subjectId?date=` | Quien administra la materia (roster del día) |
| GET | `/subjects/:subjectId/students/:studentId?from=&to=` | Quien pase `assertCanViewStudentAttendance` (historial + stats de esa materia) |
| GET | `/students/:studentId/history` | Quien pase `assertCanViewStudentAttendance` (resumen de todas sus materias) |

`recordAttendance` valida que cada alumno tenga una inscripción `ACTIVE` en la materia antes de guardar su registro — mismo chequeo que usa `createEvaluation` en Calificaciones, para no dejar tomar asistencia a alguien que ya no está inscrito.

### 8.5 Pendiente para aplicar

Falta correr, en tu máquina:

```bash
cd backend
npx prisma migrate dev --name add_attendance
npx prisma generate
```

Esto crea `Attendance` y el enum `AttendanceStatus`, y las dos relaciones nuevas en `User`/`Subject`. No se pudo ejecutar desde este entorno por la misma limitación de binario de Prisma para Linux ya documentada en la sección 5.

**Verificación manual sugerida una vez migrado:**
1. Login como `teacher@aula.com` → `POST /api/attendance/subjects/:subjectId` con `{ date: "2026-10-26", records: [{ studentId, status: "PRESENT" }] }`.
2. Repetir la misma llamada con `status: "LATE"` para el mismo alumno/fecha → debe actualizar el registro existente, no crear uno nuevo (confirmar con `GET /api/attendance/subjects/:subjectId?date=2026-10-26`).
3. Login como `student@aula.com` → `GET /api/attendance/students/:studentId/history` (su propio id) debe reflejar el `LATE` en `attendanceRate`.
4. Confirmar que un `TEACHER` que no es dueño de la materia recibe 403 al intentar tomar asistencia, y que un `STUDENT` que intenta ver el historial de otro alumno también recibe 403.

**Confirmado 2026-10-27:** la primera corrida de `migrate dev` falló con P1001 (el compute de Neon estaba dormido, plan gratuito); al reintentar el mismo comando conectó normal, migración `add_attendance` aplicada y `prisma generate` + `tsc --noEmit` sin errores.

---

## 9. Bloque 5 — Calendario académico (implementado 2026-10-27)

Mismo patrón que los bloques anteriores: policy centralizada, service de agregación, controller delgado.

### 9.1 Modelo de datos

**`CalendarEvent`**, con un enum `scope` que determina a qué pertenece el evento y por lo tanto quién lo administra y quién lo ve:

- **`CENTER`** — evento del centro (ej. "Vacaciones de invierno", "Reunión de padres"). `educationalCenterId` no nulo = propio de ese centro; `null` = evento global de plataforma (solo lo crea ADMIN), misma semántica que `GradePeriod.educationalCenterId`.
- **`SUBJECT`** — evento de una materia (examen, fecha de entrega, clase especial). Requiere `subjectId`.
- **`PERSONAL`** — evento privado: solo lo ve y edita su `ownerId`. Cualquier rol puede crear los suyos.

Campos comunes: `title`, `description?`, `location?`, `startsAt`/`endsAt`, `allDay`, `createdById` (quién lo creó, siempre), y el `educationalCenterId` denormalizado de siempre. `User` necesita dos relaciones separadas (`calendarEventsOwned` para `PERSONAL`, `calendarEventsCreated` para auditoría de quién creó cualquier evento).

No se modeló un `recurrence` (eventos repetidos semanalmente, etc.) en esta pasada — cada ocurrencia es una fila. Es la limitación consciente más grande de este bloque; si se necesita, se agrega después sin romper lo existente (un campo `recurrenceRule` opcional y un job que expande ocurrencias, o expansión en el cliente).

### 9.2 Permisos (`services/calendar.policy.ts`)

- **`canManageSubjectEvents`** — reexporta `canGradeSubject` de `grades.policy.ts`, igual que ya hace `attendance.policy.ts`: mismo profesor dueño, o Centro/Admin.
- **`canManageCenterEvents(actor)`** — solo Centro o Admin pueden crear eventos `CENTER`.
- **`ownsCenterEvent(actor, eventCenterId)`** — para editar/borrar un evento `CENTER` que ya existe: Admin siempre, Centro solo si el evento es de su propio centro (evita que un Centro borre el evento global de otro, o el de otro colegio).
- Eventos `PERSONAL`: la única regla es `ownerId === actor.userId`, sin pasar por policy aparte.

### 9.3 Agregación de "mi calendario" (`services/calendar.service.ts`)

`listVisibleEvents(actor, { from, to })` arma un único `OR` con tres partes, reutilizando el mismo criterio de "qué materias puede ver cada rol" que ya usa `getAllowedContactIds` en `messaging.policy.ts` (ADMIN = todas; CENTRO = las de su centro; TEACHER = las que imparte; STUDENT = las de sus inscripciones `ACTIVE`; PARENT = las de sus hijos vinculados con inscripción `ACTIVE`):

1. `PERSONAL` propios (`ownerId = actor.userId`).
2. `CENTER` de su centro + los globales (`educationalCenterId` null) — Admin ve los de todos los centros.
3. `SUBJECT` de las materias visibles según el rol (Admin ve todas).

El rango `from`/`to` filtra por solapamiento (`endsAt >= from` y `startsAt <= to`), no por fecha exacta, para no cortar eventos que empiezan antes del rango pedido pero siguen activos dentro de él.

### 9.4 Endpoints (montados en `/api/calendar`, todos requieren `authenticateToken`)

| Método | Ruta | Quién |
|---|---|---|
| GET | `/events?from=&to=` | Cualquiera autenticado (ve su calendario agregado) |
| POST | `/events` | Depende de `scope` en el body: `PERSONAL` cualquiera (para sí mismo); `CENTER` Centro/Admin; `SUBJECT` quien administra esa materia |
| PATCH | `/events/:id` | Dueño si es `PERSONAL`; `ownsCenterEvent` si es `CENTER`; `canManageSubjectEvents` si es `SUBJECT` |
| DELETE | `/events/:id` | Misma regla que PATCH |

### 9.5 Pendiente para aplicar

Falta correr, en tu máquina:

```bash
cd backend
npx prisma migrate dev --name add_calendar
npx prisma generate
```

Esto crea `CalendarEvent` y el enum `CalendarEventScope`, y las relaciones nuevas en `User`/`Subject`. Verificado con `tsc --noEmit` desde este entorno: los únicos errores actuales son exactamente los esperados por el cliente Prisma desactualizado (`Property 'calendarEvent' does not exist...`, `has no exported member 'CalendarEventScope'`) — el mismo patrón que en los bloques 1-4, se resuelven solos al migrar y generar.

**Verificación manual sugerida una vez migrado:**
1. Login como `student@aula.com` → `POST /api/calendar/events` con `{ title: "Estudiar para el examen", startsAt: "2026-11-02T10:00:00Z", endsAt: "2026-11-02T12:00:00Z", scope: "PERSONAL" }` → debe crear sin problema.
2. El mismo `student@aula.com` → `GET /api/calendar/events?from=2026-11-01&to=2026-11-30` debe incluir ese evento personal.
3. Login como `teacher@aula.com` → `POST /api/calendar/events` con `scope: "SUBJECT"` y `subjectId` de una materia propia → debe crear; el mismo intento sobre una materia que no imparte debe dar 403.
4. Login como `centro@aula.com` → `POST /api/calendar/events` con `scope: "CENTER"` → debe crear con su propio `educationalCenterId`; `student@aula.com` debe poder verlo en su `GET /api/calendar/events` sin haberlo creado él.

**Confirmado 2026-10-27:** migración `add_calendar` y `prisma generate` corridos con éxito; `npx tsc --noEmit` sin errores.

---

## 10. Bloque 6 — Archivos y documentos (implementado 2026-10-27)

### 10.1 Decisión de alcance: no se tocó el mecanismo de Tareas

Las Tareas (`Assignment`) ya tenían su propio manejo de archivo desde antes de v2.0: `attachmentUrl` (lo que sube el profesor) y `submissionUrl` (lo que entrega el alumno), un único archivo por fila, subido con `multer` (`middlewares/upload.middleware.ts`, disco local en `uploads/`, servido como estático en `/uploads/:filename` desde `server.ts`) y guardado como `file.filename` (el nombre único que genera multer, no el nombre original). **Esto no se tocó** — funciona, y el brief es explícito en no romper funcionalidad existente. Bloque 6 cubre lo que de verdad faltaba de "archivos tied to subjects/tasks/messages": las Tareas (`tasks`) ya estaban cubiertas, faltaban *materias* (`subjects`) y *mensajes* (`messages`).

### 10.2 Modelo de datos

**`Document`**: un modelo nuevo y genérico, reutilizando la misma infraestructura de `multer` que ya usan las Tareas (misma carpeta `uploads/`, mismo `diskStorage`, mismo serving estático), pero con metadata real en vez de guardar solo un string suelto:

- `filename` — el nombre único en disco (lo que genera multer).
- `originalName` — el nombre original del archivo, para mostrarlo/descargarlo con su nombre real.
- `mimeType`, `size`.
- `uploadedById`.
- `subjectId?` / `messageId?` — exactamente uno de los dos debe estar presente. Se decidió **no** modelar una tabla polimórfica genérica (sin "tipo de dueño" + "id de dueño" sueltos) porque con solo dos dueños posibles, dos FKs nullable con su propia relación tipada son más simples de consultar y de validar en Prisma, al costo de tener que validar "exactamente uno" a mano en el controller (ya se hace así).
- `educationalCenterId` denormalizado, mismo patrón que el resto del módulo v2.0.

### 10.3 Materiales de materia

Reutiliza, otra vez, políticas ya existentes en vez de duplicarlas (`services/document.policy.ts`):
- **Quién sube/borra** (`canManageSubjectMaterials`) = `canGradeSubject` de `grades.policy.ts` — profesor dueño, o Centro/Admin. Mismo patrón que `attendance.policy.ts` y `calendar.policy.ts`.
- **Quién ve/descarga** (`assertCanAccessSubjectMaterials`) = `assertCanAccessForum` de `forum.policy.ts` — profesor dueño, estudiante inscrito `ACTIVE`, Centro/Admin. Sin `PARENT`, mismo criterio que el foro (Bloque 2).

Endpoints (montados en `/api/documents`, `authenticateToken`):

| Método | Ruta | Quién |
|---|---|---|
| POST | `/subjects/:subjectId` (multipart, campo `file`) | Quien administra la materia |
| GET | `/subjects/:subjectId` | Quien tiene acceso al foro de esa materia |
| DELETE | `/:id` | Material de materia: quien la administra. Adjunto de mensaje: solo quien envió el mensaje |

### 10.4 Adjuntos en mensajería

En vez de un endpoint de documentos aparte, se extendió directamente `messaging.controller.ts` (`sendMessage` + `createMessageInternal`), porque el control de acceso de un adjunto de mensaje es exactamente "¿eres participante de esa conversación?" — la misma regla que ya protege el mensaje en sí (`assertConversationParticipant`, ahora exportada para que `document.controller.ts` pueda reutilizarla si se necesita una descarga autenticada más adelante). `POST /api/messages/conversations/:id/messages` ahora acepta un archivo opcional (multipart, campo `file`, vía `messaging.routes.ts`); si llega, se crea un `Document` con `messageId` apuntando al mensaje recién creado. El mensaje puede llevar texto, archivo, o ambos — ya no se exige `body` no vacío si hay archivo.

`getConversation` ahora incluye `attachments` en cada mensaje, así el frontend los recibe sin una llamada extra.

**Decisión de alcance:** solo se agregó el adjunto a *responder* un mensaje (`sendMessage`), no al *primer mensaje* de una conversación nueva (`createConversation`). Agregarlo ahí es sencillo pero no se hizo en esta pasada para no tocar ese flujo (ya maneja la lógica de reutilizar conversaciones DIRECT existentes) sin una razón de negocio que lo pida todavía.

### 10.5 Limitación conocida (heredada, no introducida por este bloque)

El serving de `/uploads/:filename` es estático y público (`express.static`, sin pasar por `authenticateToken`): cualquiera con la URL exacta de un archivo puede descargarlo, sin que el servidor verifique que esa persona tiene acceso a la materia/conversación/tarea a la que pertenece. Esto **ya existía** para los adjuntos de Tareas antes de v2.0 — Bloque 6 hereda el mismo mecanismo para materiales y adjuntos de mensaje por consistencia, no lo endurece ni lo empeora. Si en algún momento se quiere cerrar esa brecha (por ejemplo, datos sensibles en mensajería 1 a 1), la solución es un endpoint de descarga autenticado (`GET /api/documents/:id/download`, o similar para Tareas) que haga streaming del archivo tras validar el permiso correspondiente, en vez de servir la carpeta `uploads/` completa como estática. Queda anotado como mejora futura, no implementado en esta pasada.

### 10.6 Pendiente para aplicar

Falta correr, en tu máquina:

```bash
cd backend
npx prisma migrate dev --name add_documents
npx prisma generate
```

Esto crea `Document` y las relaciones nuevas en `User`/`Subject`/`Message`. Verificado con `tsc --noEmit` desde este entorno: los únicos errores actuales son exactamente los esperados por el cliente Prisma desactualizado (`Property 'document' does not exist...`, `'attachments' does not exist in type 'MessageInclude'`) — mismo patrón que en los bloques anteriores.

**Verificación manual sugerida una vez migrado:**
1. Login como `teacher@aula.com` → `POST /api/documents/subjects/:subjectId` (multipart, campo `file`) sobre una materia propia → debe crear y devolver `originalName`/`mimeType`/`size`.
2. Login como `student@aula.com` inscrito `ACTIVE` en esa materia → `GET /api/documents/subjects/:subjectId` debe listar ese material.
3. Login como `student@aula.com` → `POST /api/messages/conversations/:id/messages` (multipart, campo `file`, sin `body`) sobre una conversación donde participa → debe crear el mensaje con el adjunto; `GET /api/messages/conversations/:id` debe mostrar el `attachments` en ese mensaje.
4. Confirmar que un `TEACHER` que no es dueño de la materia recibe 403 al intentar subir material, y que alguien que no participa en la conversación recibe 403 al intentar enviarle un mensaje con archivo.

**Confirmado 2026-10-27:** migración `add_documents` y `prisma generate` corridos con éxito; `npx tsc --noEmit` sin errores.

---

## 11. Bloque 7 — Deployment (implementado 2026-10-27)

Decisiones confirmadas con Bryan antes de generar nada:
- **Hosting:** VPS propio con Docker Compose (no un PaaS administrado).
- **Base de datos:** Neon también en producción — se necesita un proyecto/rama de Neon **separado** del de desarrollo (nunca el mismo). No hay contenedor de Postgres en `docker-compose.yml`.
- **CI/CD:** solo CI (build + lint + typecheck en cada push/PR a `main`). Sin CD automático — el deploy al VPS se dispara a mano.

### 11.1 Bugs preexistentes que bloqueaban el deployment (no introducidos en este bloque, pero arreglados aquí porque sin ellos Docker no podía funcionar)

Al revisar qué hacía falta para que el build de producción corriera, aparecieron tres problemas que **ya existían** en el código y que solo se notan al intentar desplegar fuera de `localhost`:

1. **`backend/package.json`**: `"start": "node dist/server.ts"` — dos errores a la vez: la extensión (`tsc` compila a `.js`, no deja `.ts`) y la ruta (con `rootDir: "."` en `tsconfig.json`, la salida real es `dist/src/server.js`, no `dist/server.js`). Nunca se notó porque en desarrollo siempre se usa `npm run dev` (`ts-node-dev`), que no pasa por este script. Corregido a `"node dist/src/server.js"` y verificado con un build real (`npx tsc` → `dist/src/server.js` existe).
2. **`frontend/src/services/api.ts`**: el `baseURL` de axios era literalmente `'http://localhost:3001/api'`. Funciona en tu máquina porque el backend corre ahí, pero en cualquier otro entorno (el navegador de un usuario real, apuntando al dominio del VPS) esa URL no existe. Cambiado a `baseURL: '/api'` (ruta relativa): en dev, el proxy de Vite (`vite.config.ts`, nuevo) redirige `/api` y `/uploads` a `http://localhost:3001`; en producción, nginx hace exactamente lo mismo dentro del contenedor del frontend. Mismo código en los dos entornos.
3. **`TaskDetailModal.tsx` y `TaskManagementModal.tsx`**: tres enlaces a archivos de Tareas con `http://localhost:3001/uploads/...` hardcodeado (mismo problema que el punto anterior, pero para descargar adjuntos en vez de llamar a la API). Cambiados a rutas relativas `/uploads/...`.

Ninguno de los tres rompía nada mientras todo corriera en `localhost` en la misma máquina — por eso nunca se habían notado — pero los tres son bloqueantes reales para cualquier despliegue fuera de ahí, así que se corrigieron como parte de este bloque en vez de solo documentarlos.

### 11.2 Arquitectura de contenedores

Dos servicios, sin contenedor de base de datos (Neon es externo):

```
┌─────────────┐   puerto 80    ┌──────────────────┐   red interna   ┌─────────┐
│  navegador  │ ─────────────► │  frontend (nginx) │ ──────────────► │ backend │ ──► Neon (externo)
└─────────────┘                │  sirve el SPA      │  /api, /uploads │ (3000)  │
                                │  + proxy /api,     │                 └─────────┘
                                │    /uploads        │
                                └──────────────────┘
```

El backend **no publica puerto al host** (`expose`, no `ports`, en `docker-compose.yml`) — el único punto de entrada público es nginx, que sirve el build estático de React y reenvía `/api/*` y `/uploads/*` al contenedor del backend por la red interna de Docker Compose (`http://backend:3000/...`). Esto es lo que permite que el frontend llame a rutas relativas (`/api/...`) tanto en desarrollo como en producción: el navegador siempre habla con un solo origen, nginx decide a dónde reenviar cada cosa.

**`backend/Dockerfile`** (multi-stage): en la etapa de build se instalan TODAS las dependencias (incluye las de desarrollo, porque `prisma generate` y `tsc` las necesitan), se genera el cliente de Prisma y se compila; al final de esa misma etapa se corre `npm prune --omit=dev` para sacar las devDependencies del `node_modules` ya usado. La etapa de runtime copia ese `node_modules` ya podado tal cual — **no** se vuelve a correr `npm ci --omit=dev` en la etapa final, porque eso reinstalaría `@prisma/client` desde cero y pisaría el cliente ya generado para este schema con la plantilla genérica sin generar (es un error fácil de cometer con Prisma + Docker multi-stage, y se encontró y corrigió durante esta misma pasada).

**`frontend/Dockerfile`** (multi-stage): build de Vite en una imagen de Node, servido por `nginx:1.27-alpine` en la etapa final — la imagen de producción no lleva Node ni el código fuente, solo los archivos estáticos y nginx.

**`uploads`**: volumen nombrado de Docker montado en `/app/uploads` del backend, para que los archivos subidos (Tareas, materiales de materia, adjuntos de mensajes — Bloques 1-6) sobrevivan a un `docker compose down`/rebuild.

### 11.3 CI (`.github/workflows/ci.yml`)

Dos jobs independientes en paralelo, sobre `ubuntu-latest`, en cada push/PR a `main`:
- **backend**: `npm ci` → `prisma generate` (no necesita `DATABASE_URL`, solo lee `schema.prisma`) → `tsc --noEmit` → `npm run build`.
- **frontend**: `npm ci` → `npm run lint` → `npm run build` (que ya corre `tsc -b` antes de `vite build`, así que el typecheck va incluido).

**No hay paso de lint para el backend**: el script `"lint": "eslint . --ext .ts"` existe en `backend/package.json`, pero el proyecto nunca tuvo `eslint` instalado ni configurado en `backend/` (solo en `frontend/`, que sí tiene `eslint.config.js`). Es una limitación preexistente, no introducida en este bloque — agregarlo es una mejora futura aparte, documentada acá para que no se pierda, pero no bloquea el pipeline de hoy.

No hay CD: ningún paso construye ni publica imágenes Docker ni se conecta al VPS. El deploy es manual (ver 11.4).

### 11.4 Cómo desplegar al VPS

```bash
# En el VPS, con el repo clonado:
cp .env.example .env
# Edita .env: DATABASE_URL (Neon de PRODUCCIÓN, no el de desarrollo) y JWT_SECRET (uno nuevo, no el de dev).

docker compose build
docker compose run --rm backend npx prisma migrate deploy   # aplica las migraciones ya creadas, no genera nada nuevo
docker compose up -d
```

`prisma migrate deploy` (no `migrate dev`) es a propósito: en producción nunca se debe generar una migración nueva "sobre la marcha" ni hacer `migrate reset` — solo aplicar las migraciones que ya se crearon y probaron en desarrollo. Las migraciones viven en el repo (`backend/prisma/migrations/`), así que viajan con el código.

### 11.5 No se pudo verificar en este entorno

El sandbox de esta sesión no tiene Docker instalado (solo el puente de archivos a tu máquina, sin motor de contenedores) — no pude correr `docker compose build` ni levantar los contenedores para probarlos de punta a punta. Lo que sí verifiqué directamente en tu máquina: `tsc --noEmit` limpio en backend y frontend, `eslint` limpio en frontend, y un build real de backend (`npx tsc`) confirmando que `dist/src/server.js` existe donde el `Dockerfile`/`package.json` lo esperan. El build de Vite (`vite build`) no se pudo probar en este entorno por un problema conocido y no relacionado (un binario nativo de `rollup` para la plataforma equivocada, por compartir `node_modules` entre Windows y este puente Linux) — no es un bug del código, se resuelve solo con una instalación limpia (exactamente lo que hacen tanto el `Dockerfile` como GitHub Actions).

**Verificación manual sugerida en tu máquina (antes de confiar en esto para producción):**
1. `docker compose build` — debe terminar sin errores en ambos servicios.
2. `docker compose run --rm backend npx prisma migrate deploy` contra una base de Neon de prueba (no la de desarrollo, para no arriesgar tus datos) — confirmar que aplica las migraciones limpio.
3. `docker compose up -d` y abrir `http://localhost` (o la IP del VPS) — debe cargar el frontend, poder loguearte, y que las descargas de archivos (`/uploads/...`) funcionen.
4. Confirmar que *no* se puede llegar al backend directamente desde fuera (sin pasar por nginx) — por ejemplo, que `http://localhost:3000` no responde desde el host, porque el backend no publica puerto.
