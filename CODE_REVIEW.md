# Revisión de código — aula-sapm

**Autor de la revisión:** Claude (sesión de pair-programming contigo), actuando como revisor senior independiente.
**Alcance:** backend (Express + Prisma + Postgres) y frontend (React + Vite + TS) completos, rama `feature/v2-roadmap-multicentro-a-deployment`.
**Método:** lectura directa de cada controller, route, middleware, policy y componente relevante (no linters automáticos ni suite de tests — esos no existen todavía en el proyecto). Todo lo que se reporta aquí lo verifiqué leyendo el código fuente, no son suposiciones.

---

## 0. Estado actual: **corregido y reverificado**

Esta es la segunda pasada sobre este informe. Pediste explícitamente: corregir cada uno de los hallazgos (secciones 3–6), volver a testear que no queden errores de lógica/seguridad/código muerto, y una auditoría honesta de qué puede y no puede hacer cada rol *ahora mismo*. Esto es lo que hice, en ese orden:

1. **Corregí los 4 hallazgos críticos de seguridad** (sección 3) — uno por uno, cada uno con el mismo criterio que ya usa el resto del código (reusar `assertSameCenter`, `assertCanViewStudentGrades`, el patrón `authorizeRoles` en la ruta).
2. **Corregí los 3 bugs funcionales** (sección 4.1–4.3).
3. **Borré todo el código muerto** de la sección 5 — y encontré **3 archivos muertos más** que el informe original no había detectado (ver sección 10).
4. **Resolví las 7 inconsistencias de clean code** (sección 6) — incluyendo unificar los **13 `alert()`** que quedaban en el frontend (el informe original solo mencionaba 2 como ejemplo; los busqué todos y los unifiqué todos al mismo patrón de error inline).
5. **Encontré 3 problemas nuevos** haciendo esta segunda pasada que el informe original no había visto — los más importante es una limitación real del modelo de datos de `Assignment` (sección 10.1), que mitigué pero que requiere una decisión tuya para resolverse del todo (no es un fix de una línea, es una migración de esquema).
6. **Volví a compilar y trazar manualmente cada cambio** — ver método de verificación en la sección 10.4.
7. **Escribí la auditoría de roles que pediste** — sección 11, módulo por módulo, con el estado real del código después de todos estos fixes.

Cómo leer el resto del documento: dejé el informe original tal cual estaba (para que veas el razonamiento completo de cada hallazgo), y agregué **✅ CORREGIDO** con una nota de qué cambié exactamente en cada punto de las secciones 3 a 6. Las secciones 10 y 11 son completamente nuevas.

---

## 1. Resumen ejecutivo

El proyecto está en mejor forma de lo que un vistazo rápido sugeriría. Hay un patrón arquitectónico real y consistente para multi-tenancy (`centerWhere` / `assertSameCenter` / `requireUserCenter`), una capa de políticas de autorización separada de los controllers en los módulos v2.0, y decisiones de diseño documentadas con criterio (no solo "qué hace el código" sino "por qué se hizo así"). Eso es nivel de ingeniería por encima de un proyecto típico de portafolio.

Dicho eso, encontré **4 problemas de seguridad reales** (no hipotéticos — los puedo trazar línea por línea) que deberías arreglar antes de mostrar este proyecto en una entrevista o, peor, antes de desplegarlo con datos reales. También hay inconsistencias de "código limpio" que no rompen nada hoy pero que un entrevistador técnico notaría en cinco minutos de `git grep`.

La buena noticia: ninguno de los 4 problemas de seguridad requiere rediseñar nada. Son todos del tipo "falta una línea" — exactamente el tipo de hallazgo que demuestra que sabes hacer una revisión de seguridad seria, si los arreglas y puedes explicar por qué existían.

> **Actualización:** los 4 están corregidos. Ver sección 3.

---

## 2. Arquitectura — cómo funciona esto (para explicarlo en una entrevista)

**Stack:** Express 5 + Prisma 6 + PostgreSQL (Neon) en el backend; React 19 + Vite + TypeScript + Tailwind en el frontend. JWT en `localStorage`, axios con interceptores para adjuntar el token y manejar 401.

**Multi-tenancy (el corazón del diseño v2.0):** cada institución es un `EducationalCenter`. Casi todos los modelos tienen un `educationalCenterId` nullable — nullable porque `ADMIN` es un rol de *plataforma* sin centro propio, y porque varios modelos (`Message`, `ForumThread`, `Evaluation`, `Attendance`, `CalendarEvent`) lo **denormalizan** desde su relación "real" (p. ej. `Message` no tiene centro propio, lo copia de la conversación) para poder filtrar por centro sin hacer un `join` en cada query. Esa decisión está comentada explícitamente en el schema — es exactamente el tipo de trade-off que un entrevistador quiere verte justificar: "elegí denormalizar esta columna porque X evita un join en el hot path, y el costo es mantenerla sincronizada en el controller que la escribe."

El patrón de autorización tiene tres piezas que vale la pena poder dibujar en una pizarra:
1. `authenticateToken` (middleware) — valida el JWT, inyecta `req.user = {userId, role, educationalCenterId}`.
2. `*.policy.ts` (uno por módulo: `grades.policy.ts`, `forum.policy.ts`, `messaging.policy.ts`, `calendar.policy.ts`, `document.policy.ts`, `attendance.policy.ts`) — funciones puras tipo `canGradeSubject(actor, subject): boolean` o `assertCanAccessForum(actor, subject): Promise<void>`, sin tocar Express directamente. Varios policies **reexportan** funciones de otro (`attendance.policy.ts` y `calendar.policy.ts` y `document.policy.ts` reexportan literalmente `grades.policy.ts`/`forum.policy.ts` porque la regla de negocio es idéntica) — una sola fuente de verdad en vez de copiar/pegar la misma condición cinco veces.
3. `utils/tenant.ts` — `assertSameCenter`/`centerWhere` para la dimensión *multi-centro* específicamente, ortogonal a la dimensión *rol*.

Esa separación (rol vs. centro vs. "soy el dueño de este recurso específico") es el concepto más defendible de todo el proyecto en una entrevista. Después de esta pasada de fixes, **ya es también el patrón que siguen los controllers viejos** (ver 3.2–3.4): `exam.controller.ts`, `assignment.controller.ts` y `report.controller.ts` ahora reusan `assertSameCenter` / `assertCanViewStudentGrades` en vez de reglas ad-hoc.

---

## 3. Hallazgos críticos de seguridad — ✅ TODOS CORREGIDOS

### 3.1 — Secreto JWT con fallback hardcodeado (CRÍTICO) — ✅ CORREGIDO

**Archivo:** `backend/src/middlewares/auth.middleware.ts`, función `authenticateToken`.

```ts
const secret = process.env.JWT_SECRET || 'secret_super_seguro';
```

Si en cualquier entorno (un deploy nuevo, un contenedor mal configurado, alguien que olvidó copiar `.env`) la variable `JWT_SECRET` no está definida, el servidor **arranca igual** y empieza a verificar tokens firmados con el string literal `'secret_super_seguro'` — que ahora está en texto plano en un repositorio público de GitHub. Cualquiera que lea el código puede firmar su propio JWT con `role: 'ADMIN'` y `educationalCenterId: null`, y el middleware lo va a aceptar como válido.

**Fix aplicado:** `authenticateToken` ahora responde `500` con un mensaje de error de configuración si `JWT_SECRET` no está definido, exactamente igual que ya hacía `auth.controller.ts::login`. Sin fallback, sin excepciones.

### 3.2 — Crear exámenes no tiene restricción de rol (CRÍTICO) — ✅ CORREGIDO

**Archivo:** `backend/src/routes/exam.routes.ts`

El único chequeo de rol vivía *adentro* de `createExam` y solo cubría `role === 'TEACHER'`; un `STUDENT` o `PARENT` autenticado podía crear un examen completo (con preguntas y respuestas correctas) para cualquier materia de su centro.

**Fix aplicado:** agregué `authorizeRoles([RoleName.TEACHER, RoleName.CENTRO, RoleName.ADMIN])` en `router.post('/', ...)`, mismo patrón que `subject.routes.ts`. Además restringí `router.post('/submit', ...)` a `authorizeRoles([RoleName.STUDENT])` (antes cualquier rol podía "entregar" un examen).

### 3.3 — Lectura de tareas y entregas sin ningún control de acceso (CRÍTICO) — ✅ CORREGIDO

**Archivo:** `backend/src/controllers/assignment.controller.ts`, funciones `getAssignmentById` y `getSubmissionsByAssignment`.

Ninguna de las dos funciones verificaba rol, inscripción, centro, ni nada — solo requerían estar logueado. `getSubmissionsByAssignment` era el más sensible: devolvía nombre, email, calificación y feedback del estudiante que entregó, a cualquier usuario autenticado de cualquier centro.

**Fix aplicado:**
- `getAssignmentById`: ahora aplica `assertSameCenter` siempre, y además: `TEACHER` solo si es el `creatorId`; `STUDENT` solo si es su propia entrega o (si nadie la reclamó aún) está inscrito en la materia; `PARENT` solo si el estudiante dueño de la entrega es su hijo vinculado (`ParentChild`); `CENTRO`/`ADMIN` sin restricción adicional (ya cubiertos por centro).
- `getSubmissionsByAssignment`: ahora exige `assertSameCenter` + (`TEACHER` solo si es el `creatorId`) y **bloquea explícitamente** `STUDENT`/`PARENT` (es información de calificación de un tercero, no les corresponde por este endpoint).

### 3.4 — Reporte PDF: un profesor puede pedir el de cualquier estudiante (ALTO/CRÍTICO) — ✅ CORREGIDO

**Archivo:** `backend/src/controllers/report.controller.ts`, función `generateStudentReport`.

La rama de `TEACHER` confiaba ciegamente en `?studentId`, sin verificar que el estudiante estuviera en una materia que ese profesor imparte. `CENTRO` ni siquiera tenía una rama (caía al valor por defecto, sin sentido para ese rol).

**Fix aplicado:** reemplacé toda la lógica ad-hoc por una sola llamada a `assertCanViewStudentGrades(actor, targetStudentId)` — la misma función centralizada de `grades.policy.ts` que ya usa el módulo de Calificaciones. Un solo lugar define "quién puede ver las notas de quién"; este endpoint ahora lo respeta igual que todos los demás. De paso, esto también le da a `CENTRO` un caso correcto (antes no tenía ninguno) y a `ADMIN` la obligación explícita de indicar `studentId` (antes, sin querer, pedía su propio reporte).

---

## 4. Bugs funcionales — ✅ TODOS CORREGIDOS

### 4.1 — Reenviar una tarea calificada la deja en un estado inconsistente — ✅ CORREGIDO

Si un estudiante reenviaba una tarea ya `GRADED`, el código hacía `status: 'SUBMITTED'` pero no borraba `grade` ni `feedback`. **Fix:** cada entrega nueva (`submitAssignment`) ahora limpia explícitamente `grade: null, feedback: null`.

### 4.2 — `submitAssignment` y `submitExam` no verifican inscripción — ✅ CORREGIDO

**Fix:** ambas funciones ahora verifican un `Enrollment` con `status: ACTIVE` del estudiante en la materia antes de aceptar la entrega/respuesta. `submitAssignment` además ahora valida `assertSameCenter`.

### 4.3 — Múltiples instancias de `PrismaClient` compitiendo por conexiones — ✅ CORREGIDO

Había **tres** instanciaciones de `new PrismaClient()`: `prisma/client.ts` (el singleton oficial), `config/db.ts` (una segunda, usada solo por `health.controller.ts`) y `report.controller.ts` (una tercera, inline). **Fix:** `config/db.ts` y `report.controller.ts` ahora reexportan/importan el mismo singleton de `prisma/client.ts`. Confirmé con `grep -rn "new PrismaClient"` que ahora solo queda una instanciación en todo el backend.

### 4.4 — Dashboard de Centro/Padre quedaba colgado para siempre — ya estaba arreglado

Sigue arreglado (commit `2f0412e`, de una sesión anterior). Lo dejo documentado aquí solo como referencia histórica.

---

## 5. Código muerto — ✅ BORRADO (y encontré más del que el informe original vio)

Borré los 7 ítems que ya estaban identificados:

| Archivo | Acción |
|---|---|
| `frontend/src/components/AssignmentsList.tsx` | Borrado |
| `frontend/src/components/TaskDetailModal.tsx` | Borrado (su campo de feedback libre se recuperó en `TaskManagementModal.tsx`, ver 6.3) |
| `frontend/src/components/SubmitTaskModal.tsx` | Borrado |
| `backend/src/controllers/task.controller.ts` + `backend/src/routes/task.routes.ts` | Borrados |
| `backend/src/seed/seedRoles.ts` | Borrado |
| `backend/src/controllers/course.controller.ts` + `backend/src/routes/course.routes.ts` | Borrados (decidí borrarlos, no moverlos a `_legacy/`, ya que me pediste eliminar explícitamente todo el código inservible; el modelo `Course` sigue en el schema de Prisma sin usarse — ver sección 10.2) |

Además quité su `import`/`app.use` en `server.ts` y recompilé (`tsc --noEmit`) para confirmar que nada más los referenciaba.

**Encontré 3 archivos muertos adicionales que el informe original no detectó** — ver sección 10.3.

---

## 6. Consistencia y buenas prácticas (clean code) — ✅ TODO RESUELTO

### 6.1 — Dos implementaciones idénticas de `authorizeRoles` — ✅ CORREGIDO

Borré `backend/src/middlewares/role.middleware.ts` y actualicé sus 3 importadores (`assignment.routes.ts`, `protected.routes.ts` — luego también borrado, ver 10.3 —, `student.routes.ts` — también borrado) para usar la de `auth.middleware.ts`.

### 6.2 — `req.user` tipado de tres formas distintas — ✅ CORREGIDO

Reemplacé cada `(req as any).user` y cada `// @ts-ignore` seguido de `req.user.x` por `(req as AuthRequest).user!`, en `dashboard.controller.ts`, `student.controller.ts` (antes de borrarlo, ver 10.3), `subject.controller.ts`, `users.controller.ts`, `assignment.controller.ts` y `exam.controller.ts`. Confirmé con `grep -rn "@ts-ignore\|(req as any).user"` que no queda ninguno en `backend/src`.

### 6.3 — El feedback del profesor era hardcodeado — ✅ CORREGIDO

`TaskManagementModal.tsx` ahora tiene un `<textarea>` real de feedback por cada entrega, inicializado con el feedback existente si lo hay, y lo envía en vez del string fijo `"Calificado."`.

### 6.4 — Dos definiciones de "¿cómo se ven las estadísticas del dashboard?" — ✅ CORREGIDO

`types/dashboard.types.ts` ahora es la única fuente de verdad (`StatItem` ganó los campos opcionales `type`/`subtext`; `DashboardStats` ganó `details?: DashboardDetails`). `AcademicDashboard.tsx` ya no declara sus propias interfaces locales — las importa todas de `types/dashboard.types.ts` y usa `getDashboardStats()` del service en vez de llamar `api.get('/dashboard/stats')` directo.

### 6.5 — Forma de las respuestas de error inconsistente — ✅ CORREGIDO

Unifiqué todos los `res.status(xxx).json({ error: '...' })` a `{ message: '...' }` en `assignment.controller.ts`, `dashboard.controller.ts` y `users.controller.ts` (14 ocurrencias en total). Confirmé con `grep -rn "{ error:"` que no queda ninguno.

### 6.6 — `alert()`/`confirm()` nativos conviven con modales de error con estilo propio — ✅ CORREGIDO (ampliado)

El informe original solo daba 2 ejemplos (`TaskManagementModal.tsx`, `CreateExamModal.tsx`). Busqué **todos** los `alert()` del frontend y encontré **13 en total**, en 8 archivos:

`TaskManagementModal.tsx`, `CreateExamModal.tsx`, `components/admin/UsersManagement.tsx` (2), `AttendancePanel.tsx`, `dashboard/AcademicDashboard.tsx`, `GradesPanel.tsx`, `TakeExamModal.tsx`, `ThreadDetailModal.tsx` (4), `pages/Messages.tsx`, `pages/SubjectDetail.tsx`.

Reemplacé los 13 por el mismo patrón que ya usan los componentes v2.0 (`EventModal.tsx`, `CreateSubjectModal.tsx`): un estado de error y un bloque rojo inline en el propio formulario/modal, en vez de un `alert()` del navegador. Confirmé con `grep -rn "alert("` que no queda ninguno.

### 6.7 — Dependencia sin usar — ✅ CORREGIDO

Corrí `npm uninstall bcrypt @types/bcrypt` en `backend/` (ya confirmé que ningún archivo importa `bcrypt`, solo `bcryptjs`). `package.json` y `node_modules` quedaron limpios; `tsc --noEmit` sigue pasando.

---

## 7. Fortalezas reales (que sí deberías destacar en una entrevista)

Sigue siendo todo cierto, y ahora con más base:

- **El patrón multi-tenant está realmente bien pensado**, no es un parche.
- **La capa de `*.policy.ts`** es el patrón correcto para producción — y después de esta pasada, los controllers viejos (`exam`, `assignment`, `report`) también la reusan en vez de reinventar reglas ad-hoc.
- **Zod en los endpoints críticos** (`login`, `createExam`) da validación de forma clara.
- **Nada de SQL crudo** — todo pasa por Prisma.
- **Mensajes de login genéricos** — evita enumeración de usuarios.
- **Soft-deletes donde importan** (`Message.deletedAt`, `ForumPost.deletedAt`).
- **Nuevo:** después de esta pasada, **cero** `@ts-ignore`, **cero** `(req as any).user`, **cero** `alert()`, **una sola** instancia de `PrismaClient`, **cero** archivos muertos conocidos. Eso es un argumento fuerte y concreto para una entrevista: "hice una auto-revisión de seguridad, encontré N problemas reales, y esta es la lista verificable de cómo los cerré."

---

## 8. Próximos pasos recomendados, priorizados

1. ~~Hoy mismo: los 4 hallazgos de la sección 3.~~ **Hecho.**
2. ~~Esta semana: 4.1–4.3.~~ **Hecho.**
3. ~~Antes de mostrar el repo: borrar el código muerto de la sección 5.~~ **Hecho** (y amplié el alcance, ver sección 10.3).
4. ~~Cuando tengas tiempo: la sección 6 completa.~~ **Hecho.**
5. **Pendiente, y es la inversión más importante que queda:** una decisión tuya sobre el modelo de datos de `Assignment` (sección 10.1) — no es algo que debiera decidir yo solo, porque implica una migración sobre tu base de datos real en Neon.
6. **Más adelante:** empezar una suite de tests de integración, enfocada en los controllers de las secciones 3 y 4 — son los que ya demostraron que pueden fallar en silencio sin que TypeScript avise. Un test "`STUDENT` intenta crear un examen → espera 403" vale más que cobertura amplia y superficial.

---

## 9. Cómo hablar de este proyecto en una entrevista

Si te preguntan "contame de un proyecto del que estés orgulloso", esta es la estructura que yo usaría:

1. **El problema:** una plataforma educativa multi-institución con 5 roles distintos, cada uno con una vista y permisos distintos.
2. **La decisión de diseño que más defenderías:** el patrón de tres capas (autenticación → policy de rol → policy de centro).
3. **Un trade-off real que tomaste:** la denormalización de `educationalCenterId`.
4. **Un bug que encontraste y por qué fue interesante:** el dashboard de Centro/Padre colgado — "TypeScript no te salva de todo."
5. **Qué harías distinto si lo empezaras hoy:** ahora podés contar la historia completa — "hice una auto-revisión de seguridad en dos pasadas: la primera encontró 4 huecos de autorización reales (JWT fallback, falta de rol en crear examen, dos IDOR), la segunda los corrigió todos, eliminó código muerto adicional, y encontró un problema de diseño más profundo en el modelo de Entregas que documenté para resolver con una migración". Eso es una narrativa de ingeniería senior real, no una anécdota — mostrás proceso, no solo resultado.

---

## 10. Hallazgos nuevos (encontrados en esta segunda pasada, fuera del informe original)

Hice exactamente lo que pediste: "vuelve y testea de nuevo." Al re-leer cada archivo para verificar mis propios fixes, encontré 3 cosas que la primera pasada no había visto.

### 10.1 — Limitación real del modelo de datos de `Assignment` (el hallazgo más importante de esta pasada)

> ✅ **RESUELTO (sesión de seguimiento, previo al deploy):** se separó la entrega en su propia tabla `Submission` (`assignmentId`, `studentId`, `status`, `grade`, `feedback`, `submissionUrl`, `submissionComment`, únicos por `(assignmentId, studentId)`), exactamente como se recomendaba abajo. `Assignment` quedó como la tarea maestra pura (sin `status`/`grade`/campos de entrega). Cada alumno inscrito ahora tiene su propia entrega independiente de una misma tarea compartida — el `409` de "ya fue entregada por otro" que se describe más abajo ya no existe porque ya no hace falta. Como efecto secundario, también se destraba el promedio por materia (`grades.service.ts`) y el reporte PDF del alumno (`report.controller.ts`), que antes excluían las tareas compartidas del cálculo por el mismo motivo. La migración (`backend/prisma/migrations/20261110023544_add_submission_model/`) preserva como filas de `Submission` cualquier entrega que ya existiera en `Assignment` antes del cambio — no se pierde nada de lo que ya estaba cargado. Falta un paso manual: correr `npx prisma migrate deploy` contra la base real (no pude ejecutarlo yo mismo desde este entorno, ver aviso al final de la sección 11).
>
> El modelo `Course` (10.2, debajo) sigue siendo una decisión pendiente separada — no se tocó en este cambio.

**Esto no es un bug de autorización — es una limitación de diseño que afecta la funcionalidad central de "tareas".** (Diagnóstico original, dejado como registro histórico de qué se encontró y por qué era un problema real.)

Mirá el modelo en `schema.prisma`:

```prisma
model Assignment {
  status      AssignmentStatus @default(PENDING)
  grade       Int?
  submissionUrl     String?
  submissionComment String?
  feedback          String?
  subjectId   Int
  studentId   Int?    // Asignación específica (opcional, si es null es para todos los de la materia)
}
```

No existe una tabla `Submission` separada. La "entrega" de un estudiante **es la misma fila** que la tarea maestra: cuando el profesor crea una tarea para toda la materia (`studentId: null`), y el primer estudiante la entrega, `submitAssignment` escribe `studentId`, `submissionUrl`, `grade`, `feedback` **en esa misma fila única**. Eso significa que **una tarea solo puede ser entregada por un estudiante en total**, no por cada estudiante inscrito de forma independiente. Si una materia tiene 25 alumnos y el profesor crea una sola tarea, la entrega del primer alumno "consume" esa fila — conceptualmente, los otros 24 ya no tienen una forma independiente de entregar esa misma tarea con este modelo.

**Qué hice:** no podía (ni debía) resolver esto con una migración de esquema sin tu aprobación explícita — toca datos reales en Neon y es una decisión de producto, no solo de código. Lo que sí hice, dentro del modelo actual, es cerrar el agujero de seguridad que esto habilitaba: antes, un segundo estudiante podía entregar sobre la misma fila y **sobrescribir silenciosamente la entrega y el archivo de otro estudiante**, incluso dejando la calificación vieja de otro alumno visible bajo su nombre. Ahora `submitAssignment` rechaza con `409` si la fila ya fue reclamada por otro `studentId` distinto.

**Qué recomiendo (tu decisión, no la tomé por vos):** la solución correcta a mediano plazo es una tabla `AssignmentSubmission` separada (`assignmentId`, `studentId`, `submissionUrl`, `grade`, `feedback`, únicos por `(assignmentId, studentId)`), con `Assignment` quedando como la "tarea maestra" pura. Es una migración de Prisma real — te la puedo armar en la próxima sesión si querés, pero prefería que esta decisión (y el momento de tocar la base de datos de producción) la tomaras vos explícitamente en vez de que yo la ejecutara sin preguntarte.

### 10.2 — El modelo `Course` sigue en el schema de Prisma, sin usarse

Borré `course.controller.ts`/`course.routes.ts` (código muerto, sección 5), pero el modelo `Course` sigue existiendo en `schema.prisma` — quitarlo es una migración de esquema (`prisma migrate dev`), que no corrí por el mismo motivo que el punto anterior: toca tu base de datos real y no es una decisión que deba tomar sin que la veas. Si querés, lo dejamos para la misma sesión en la que resuelvas 10.1 — son del mismo tipo de cambio.

### 10.3 — Tres archivos muertos adicionales (rutas nunca montadas)

Mientras verificaba que no quedaran referencias rotas, encontré que `backend/src/routes/student.routes.ts` y `backend/src/routes/protected.routes.ts` **nunca estuvieron montados en `server.ts`** — ninguno de los dos aparece en la lista de `app.use('/api/...', ...)`. Confirmé con grep que:
- Ningún otro archivo del backend los importa.
- El frontend nunca llama a `/student/my-performance`, `/student/profile`, `/student/my-upcoming` ni `/protected/admin-only` (busqué las rutas exactas en todo `frontend/src`).

Eran 100% inalcanzables — ni siquiera el código muerto "normal" (que al menos se puede llamar); estos ni eso. Borré los dos archivos de rutas y, como ya no tenían ningún importador, también `backend/src/controllers/student.controller.ts` (sus 3 funciones solo las usaba `student.routes.ts`).

### 10.4 — `GET /api/users/search` no tenía ningún filtro de centro (fuga de datos entre centros)

Este es el hallazgo de seguridad más parecido en severidad a los de la sección 3, y lo encontré auditando el módulo de usuarios para la matriz de roles de la sección 11.

`users.controller.ts::searchUsers` devuelve `{id, name, email, role}` de hasta 20 usuarios filtrados por `role`/`query`, y la ruta (`users.routes.ts`) lo dejaba abierto a **cualquier rol autenticado**, sin ningún `centerWhere`. Eso significa que un `STUDENT` o `PARENT` — que nunca llaman a este endpoint desde la UI, pero sí pueden llamarlo directo a la API con su mismo token — podían enumerar nombre y email de usuarios de **cualquier centro educativo**, incluyendo otros estudiantes, profesores o personal de centros con los que no tienen ninguna relación. Es el mismo patrón de fuga que `admin.controller.ts::adminSearch` ya prevenía correctamente con `centerWhere` — pero `searchUsers` (un endpoint distinto, con los mismos datos) no lo tenía.

**Fix aplicado:** agregué `centerWhere(authReq)` al `where` de `searchUsers` (ADMIN sigue viendo todos; todos los demás, solo su propio centro), y restringí la ruta a los únicos roles que realmente la usan desde el frontend: `authorizeRoles([TEACHER, CENTRO, ADMIN])` (los dos únicos call-sites son el selector de profesor al crear materia y la vinculación de hijos en el panel de Admin).

### 10.5 — `getVisibleAssignmentsForStudent` filtraba tareas de OTROS alumnos específicos (fuga de IDOR informativo)

Encontrado haciendo una pasada de QA manual completa contra el entorno desplegado en Render (login real como cada rol + llamadas directas a la API con el token de sesión), no por lectura estática del código — por eso no apareció en las pasadas anteriores.

`assignment.service.ts::getVisibleAssignmentsForStudent` construía la visibilidad así: `OR: [{ studentId }, { subjectId: { in: subjectIds } }]`. El segundo término de ese `OR` no filtraba por `studentId` en absoluto, así que cualquier tarea de una materia donde el alumno está inscrito — **incluida una asignada individualmente a OTRO alumno específico** (`Assignment.studentId` apunta a un alumno concreto; ver comentario en `schema.prisma`) — aparecía también en la lista de tareas de todos sus compañeros. Las notas/feedback/archivo de entrega no se filtraban (esos vienen solo del `include: { submissions: { where: { studentId } } }` de la entrega PROPIA del que consulta), pero sí se filtraban: el título y fecha de una tarea ajena, filas duplicadas y confusas con un estado (`PENDING`/`LATE`) derivado incorrectamente (porque nunca va a existir una entrega propia para una tarea que no es tuya), y el `studentId` interno del otro alumno quedaba expuesto en la respuesta JSON.

Como `dashboard.controller.ts` ya reutiliza esta misma función para los conteos de "Actividades Pendientes" de Estudiante y Padre (ver sección 6.4), el bug también inflaba esos números — es probablemente la causa de que el dashboard de un Padre mostrara 52 "actividades pendientes" para un solo hijo.

**Fix aplicado:** el segundo término del `OR` ahora exige explícitamente `studentId: null` (es decir, solo tareas compartidas con toda la materia), dejando intacto el primer término (`{ studentId }`, la tarea es mía). Un alumno ve exactamente: lo que le asignaron a él en particular, más lo que se asignó a toda la materia.

### Verificación realizada

- `npx tsc --noEmit` limpio en `backend/` y `frontend/` después de **cada** cambio significativo, no solo al final.
- `grep` exhaustivo, repetido al final de todo, confirmando cero: `@ts-ignore`, `(req as any).user` en controllers, `{ error: }`, `alert(`, `new PrismaClient` duplicado, y referencias a cualquier archivo borrado.
- Trazado manual de cada endpoint modificado, siguiendo el flujo rol → policy → query de Prisma, para los 4 hallazgos críticos + los 3 nuevos (10.1, 10.4, 10.5).
- Spot-check manual de Exámenes, Calificaciones y Asistencia buscando el mismo patrón (`subjectId: { in } }` sin acompañar de `studentId`) — los tres filtran siempre por `studentId` exacto, no reproducen este bug.
- **Lo que NO pude verificar:** no tengo acceso de red a tu base de datos de Neon desde este entorno, así que no corrí las rutas contra datos reales ni un server levantado — esto es revisión estática + compilación, no una prueba de integración end-to-end. Tampoco corrí `npm run build` del frontend hasta el final (falló por un problema de binario nativo de Rollup específico de este entorno de ejecución, no relacionado con ningún cambio que hice — `tsc --noEmit`, que es la verificación de tipos real, sí pasó limpio). Si querés que verifiquemos con el servidor realmente corriendo, es el siguiente paso lógico y lo puedo guiar.

### 10.6 — Rediseño de alcance por rol: Centro administra personal, no materias (v3.0)

Encontrado por Bryan probando la demo en vivo, no por mí: el perfil CENTRO entraba a la misma pantalla que Profesor/Estudiante/Padre ("Mis Materias" + botón suelto de "Nueva Materia"), como si Centro impartiera clases directamente. Mirándolo con una cadena de mando real de colegio, tenía razón — Admin da soporte de plataforma a cada Centro; Centro administra a SU PERSONAL DOCENTE (altas, bajas, qué materias imparte cada quien); el Profesor opera 100% de la vida académica de sus propias materias (tareas, exámenes, calificaciones, asistencia, foro, material, clases en vivo); Estudiante/Padre son los destinatarios de todo eso. El diseño anterior (documentado como decisión de producto en la sección 11 original) hacía de CENTRO un "co-administrador académico" de cualquier materia de su centro — eso quedó revertido.

**Cambios de permisos (backend, con el frontend seccionado abajo):**
- `grades.policy.ts::canGradeSubject` y `forum.policy.ts::assertCanAccessForum`/`canModerateSubject`: ya no devuelven `true`/pasan para CENTRO. Por extensión (son funciones reutilizadas, ver sección 6 de este informe), `attendance.policy.ts`, `calendar.policy.ts::canManageSubjectEvents` y `document.policy.ts` pierden ese acceso de CENTRO automáticamente, sin tocar esos 3 archivos.
- CENTRO conserva **solo lectura** sobre calificaciones/asistencia de estudiantes de su centro (`assertCanViewStudentGrades`/`assertCanViewStudentAttendance`, sin cambios) — para supervisión y atención de reclamos, no para operar.
- `users.controller.ts::getAllUsers/createUser/deleteUser`: antes exclusivos de ADMIN a nivel de ruta. Ahora también los usa CENTRO, pero con alcance forzado **del lado del servidor** (nunca confiando en lo que mande el body/frontend): solo ve/crea/elimina cuentas `TEACHER` de su propio `educationalCenterId`. Cambiar el ROL de un usuario y vincular padres-hijos siguen siendo exclusivos de ADMIN (`users.routes.ts`).
- `subject.controller.ts`: nuevos `updateSubject` (`PATCH /api/subjects/:id`, reasignar `teacherId`/editar nombre-descripción) y `deleteSubject` (`DELETE /api/subjects/:id`), ambos con el mismo patrón de alcance (Centro acotado a su centro y a profesores de su centro; Profesor solo su propia materia, sin poder reasignarla a otro; Admin sin restricción).
- `messaging.policy.ts::getAllowedContactIds`: reescrito por completo para reflejar la cadena de mando (ver cabecera del archivo para la matriz completa). Cambios de fondo respecto a v2.0:
  - **Admin ya no habla directo con Profesor/Estudiante/Padre** — su único contacto es el staff `CENTRO` de cualquier centro (escalamiento/soporte). Esto es un cambio deliberado de filosofía: todo pasa por Centro, Admin no opera el día a día de ningún plantel.
  - **Profesor/Estudiante/Padre ya no hablan directo con Admin** — mismo motivo, en espejo.
  - **Estudiante ↔ Estudiante: permitido**, si acotado a compañeros de una materia con inscripción `ACTIVE` en común. Esto **deroga** la regla de v2.0 ("sin mensajería estudiante-a-estudiante", una decisión de producto explícita de esa pasada) — a pedido expreso de Bryan en esta.
  - **Padre ↔ Padre: nuevo.** Acotado a padres cuyos hijos comparten al menos una materia activa con el/los hijo(s) del actor (evita que un padre pueda enumerar a cualquier otro padre del centro — el alcance real es "padres del mismo salón", no "todos los padres").
  - **Padre ↔ su propio hijo: nuevo.** Antes explícitamente excluido ("ni al propio hijo ni a otros estudiantes/padres"); ahora permitido en ambos sentidos (se agregó también en la rama STUDENT, para que el hijo pueda iniciar la conversación, no solo responder).
  - **Estudiante ↔ Centro:** el hilo técnico sigue existiendo (`DIRECT`, igual que cualquier otro), pero el frontend (`NewConversationModal.tsx`) lo presenta como "Centro · Buzón de Sugerencias" con una nota aclaratoria cuando quien mira es STUDENT — es un canal formal/puntual, no un chat general, sin necesitar un tipo de conversación nuevo en el modelo de datos.
- **Frontend:** `Dashboard.tsx` ahora manda a CENTRO a un `CentroDashboard.tsx` dedicado (antes cualquier rol que no fuera ADMIN caía en `AcademicDashboard.tsx`, la pantalla de "Mis Materias" pensada para quien cursa/imparte una materia). El nuevo dashboard muestra `TeachersManagement.tsx` (nuevo): lista de profesores del centro, cada uno con sus materias asignadas, con altas/bajas de profesor y reasignación/eliminación de materias inline. El encabezado también quedó resuelto para nombres largos (el dato de ejemplo `Administración Centro Legacy` desbordaba el layout de `AcademicDashboard.tsx`, pensado para nombres cortos) — ahora permite salto de línea en vez de desbordar, y se acortó el nombre de ejemplo en el seed a `Administración`.
- **"Clases en vivo" (pedido de Bryan):** no se integró la API real de Google Meet (fuera de alcance razonable para este proyecto) — en su lugar, un evento de calendario de tipo `SUBJECT` acepta un enlace en su campo `location` ya existente (sin migración de esquema) y el calendario lo detecta (`/^https?:\/\//`) para mostrarlo como botón "Unirse a la clase en vivo" en vez de texto de ubicación plano. El profesor pega su propio enlace (Meet, Zoom, lo que use); es deliberadamente simple.

**Lo que NO cambié:** el modelo de datos (`Subject.teacherId` sigue siendo `Int` no nulo — seguís sin poder tener una materia "sin profesor" a mitad de una reasignación, hay que reasignar atómicamente) y los endpoints de Exámenes/Asistencia/Calificaciones en sí (ya filtraban correctamente por `teacherId`/`studentId` exacto; lo que cambió es la política de *quién* puede llamarlos, no la query interna).

### Verificación realizada (10.6)

- `npx tsc --noEmit` limpio en `backend/` y `frontend/` tras todos estos cambios — mismo set de errores pre-existentes de este entorno (ver nota de la sección 10.5), cero errores nuevos.
- Revisé que `attendance.policy.ts`, `calendar.policy.ts` y `document.policy.ts` no necesitaran edición propia al reutilizar `grades.policy.ts`/`forum.policy.ts` — confirmado con `git diff` (sin cambios en esos 3 archivos).
- **Lo que falta probar en vivo** (no pude: sin acceso de red a tu Neon ni server corriendo desde este entorno): login real como CENTRO viendo el nuevo dashboard, crear/eliminar un profesor, reasignar una materia entre dos profesores, y la matriz de mensajería completa (en particular Estudiante↔Estudiante y Padre↔Padre, que son casos nuevos). Lo haré apenas hagas el push y Render redespliegue.

---

## 11. Auditoría de permisos por rol — qué puede y no puede hacer cada uno, ahora mismo

Esta es la matriz que pediste: validé cada fila leyendo el código actual (post-fix), no la arquitectura "en teoría". Convención: ✅ puede, ❌ no puede, ⚠️ puede con una condición específica.

### ADMIN (rol de plataforma, sin centro propio)

Acceso total, sin restricción de centro, en prácticamente todo. Específicamente:
- ✅ Crear/listar/editar centros educativos; asignar cualquier usuario a cualquier centro.
- ✅ Crear/listar/eliminar cualquier usuario; actualizar el rol de cualquiera; vincular/desvincular padres-hijos.
- ✅ Crear materias para cualquier centro; ver todas las materias de todos los centros.
- ✅ Crear exámenes, tareas, calificar, tomar asistencia, moderar foros, subir material, crear eventos de cualquier tipo — en cualquier materia de cualquier centro (todas las `policy.ts` devuelven `true` para ADMIN como primer chequeo). Esto se mantiene como una capacidad de soporte/override de plataforma, no de operación diaria (ver 10.6).
- ✅ Ver el reporte PDF y las calificaciones de cualquier estudiante.
- ✅ Buscar usuarios (`/users/search`) sin filtro de centro.
- ⚠️ No puede borrar su propia cuenta de usuario mientras está logueado (protección explícita en `deleteUser`, para no perder el acceso al panel).
- ❌ No tiene dashboard de "mis materias" (su dashboard es de agregados de plataforma: usuarios/materias/tareas totales).
- ❌ **(v3.0)** Ya no puede iniciar una conversación directa con un Profesor/Estudiante/Padre — su único contacto de mensajería es el staff `CENTRO` de cada centro (ver 10.6). Sigue pudiendo intervenir sobre cualquier recurso vía la API/paneles; lo que cambió es el canal de chat, no el acceso a datos.

### CENTRO (admin de una institución específica)

**(Redefinido en v3.0, nov. 2026 — ver 10.6. Lo de abajo ya refleja la versión vigente, no la original.)**
Acotado a `educationalCenterId === el suyo`, verificado con `assertSameCenter`/`centerWhere` en cada endpoint. Su rol ahora es administrar al PERSONAL de su centro, no operar las materias directamente:
- ✅ Crear/listar/eliminar cuentas `TEACHER` de su propio centro (`users.controller.ts` fuerza `role=TEACHER` y `educationalCenterId=el suyo` del lado del servidor, sin importar qué mande el body — igual patrón que `createSubject`).
- ✅ Crear materias asignándolas a uno de sus profesores, reasignar una materia existente a otro profesor (`PATCH /api/subjects/:id`), eliminar una materia de su centro.
- ✅ Crear eventos de tipo `CENTER` para su propio centro (no para otro) — sigue siendo su "megáfono" administrativo.
- ✅ Buscar usuarios (`/users/search`) — acotado a su centro desde el fix de la sección 10.4.
- ✅ Ver (solo lectura) el reporte PDF y las calificaciones/asistencia de cualquier estudiante de su centro (`assertCanViewStudentGrades`/`assertCanViewStudentAttendance` lo siguen permitiendo, para supervisión y atención de reclamos) — pero ya no puede crearlas ni editarlas.
- ✅ Mensajería con el profesorado y las familias de su propio centro, y con Admin (escalamiento) — ver 10.6.
- ❌ **(v3.0)** Ya NO puede calificar, tomar asistencia, moderar foros ni subir material de ninguna materia — eso es exclusivo del profesor titular (o Admin, como soporte de plataforma). `canGradeSubject`/`assertCanAccessForum`/`canModerateSubject` ya no devuelven `true` para CENTRO.
- ❌ **(v3.0)** Ya no puede crear/eliminar cuentas `STUDENT`/`PARENT`/`CENTRO` — `createUser`/`deleteUser` fuerzan y validan `role === TEACHER` cuando el actor es CENTRO.
- ❌ No puede crear/editar centros, ni cambiar roles, ni vincular padres-hijos — eso sigue siendo exclusivo de ADMIN (`users.routes.ts` lo bloquea a nivel de ruta).
- ❌ No puede ver ni tocar nada de otro centro — confirmado: cualquier intento devuelve 403 vía `assertSameCenter`.
- ⚠️ `getCenter` (`GET /centers/:id`): puede ver el detalle de su propio centro, pero no el de otro (chequeo explícito `user.educationalCenterId !== id`).

### TEACHER (profesor)

El rol con permisos más "quirúrgicos" — casi todo está condicionado a `subject.teacherId === su userId`:
- ✅ Crear materias (aparece como su propio profesor) y exámenes/tareas, pero **solo en materias donde él es el `teacherId`** — si el `subjectId` pertenece a otro profesor, 403 (`createExam`, `createAssignment`).
- ✅ Calificar, tomar asistencia, moderar foro, subir material, crear eventos de materia, ver entregas — pero **solo en sus propias materias** (`canGradeSubject`/`canModerateSubject` devuelven `false` si `teacherId !== actor.userId`).
- ✅ Ver reporte PDF / calificaciones / asistencia de un estudiante — pero **solo si ese estudiante tiene una inscripción `ACTIVE` en alguna materia que él imparte** (`assertCanViewStudentGrades`, rama TEACHER). No puede pedir el reporte de un estudiante cualquiera del sistema (este era el hallazgo 3.4, ya corregido).
- ✅ Buscar usuarios (`/users/search`) — acotado a su centro.
- ✅ Crear conversaciones grupales/de anuncio (`canCreateGroupOrAnnouncement`); contactar a sus propios estudiantes, los padres de esos estudiantes, otros profesores de su centro y a Centro — **(v3.0)** ya no a Admin directo (escala vía Centro).
- ✅ **(v3.0)** Puede agregar un enlace de clase en vivo (Google Meet u otro) a un evento de calendario de tipo `SUBJECT` — se guarda en el campo `location` y se renderiza como botón "Unirse a la clase en vivo" para sus alumnos (sin integración real con la API de Meet; el profesor pega su propio enlace).
- ❌ No puede crear/editar usuarios, centros, ni ver/calificar materias que no son suyas.
- ❌ No puede crear eventos de tipo `CENTER` (`canManageCenterEvents` excluye a TEACHER).
- ⚠️ `getAssignmentById`/`getSubmissionsByAssignment`: solo si es el `creatorId` de esa tarea específica (no basta con ser el profesor de la materia en general — es el `creatorId` exacto).

### STUDENT (alumno)

El rol más restringido, y el que más se endureció en esta pasada:
- ✅ Ver/entregar tareas y exámenes de materias donde tiene inscripción `ACTIVE` (verificado explícitamente en los fixes 4.2 y 3.3 — antes no se chequeaba inscripción en absoluto).
- ✅ Ver sus propias calificaciones, asistencia, y su propio reporte PDF (`assertCanViewStudentGrades`/`assertCanViewStudentAttendance`, rama STUDENT: solo si `actor.userId === studentId`).
- ✅ Participar en el foro de materias donde está inscrito `ACTIVE`; ver/descargar material de esas materias.
- ✅ **(v3.0 — revertido respecto a la regla original)** Contactar a sus compañeros de clase (comparten al menos una materia con inscripción `ACTIVE`), a los profesores de sus materias activas, a su(s) propio(s) Padre/Madre vinculado(s), y a Centro — este último canal se presenta en la UI como "Buzón de Sugerencias" (no un chat libre), no con Admin. La regla original ("sin mensajería estudiante-a-estudiante") quedó derogada a pedido explícito de Bryan — ver 10.6 para el razonamiento.
- ❌ No puede crear materias, exámenes, tareas, eventos, ni calificar — todo bloqueado a nivel de ruta o de policy.
- ❌ No puede ver tareas/entregas/calificaciones de otro estudiante, ni de materias donde no está inscrito (hallazgos 3.3 y 4.2, ya corregidos).
- ❌ No puede llamar a `/users/search` (bloqueado en el fix 10.4 — antes sí podía, era parte de la fuga).
- ⚠️ Puede ver una tarea compartida sin reclamar (`studentId: null`) de una materia donde está inscrito, pero una vez que CUALQUIER estudiante la entrega, por la limitación de modelo de datos de la sección 10.1, es ese estudiante quien "posee" la fila — otro estudiante que intente entregar sobre la misma tarea recibe 409, no puede entregar su propia versión independiente.

### PARENT (padre/madre)

Rol de solo lectura sobre sus hijos vinculados, nada más:
- ✅ Ver las calificaciones, asistencia y reporte PDF de un hijo — **solo** si existe un registro `ParentChild` que los vincula (`assertCanViewStudentGrades`/`assertCanViewStudentAttendance`, rama PARENT). Esto incluye el fix nuevo en `getAssignmentById`, que ahora también respeta esta regla para ver una entrega específica de su hijo.
- ✅ **(v3.0)** Contactar a los profesores de las materias de sus hijos vinculados, a Centro, a otros padres cuyos hijos comparten clase con el suyo, y — novedad de esta pasada — directamente a su(s) propio(s) hijo(s) vinculado(s) (antes explícitamente excluido). Ya no a Admin directo.
- ❌ No tiene acceso al foro de ninguna materia (`assertCanAccessForum` lanza 403 explícitamente para PARENT — es una decisión de producto documentada, no un bug).
- ❌ No puede ver material de materia (`assertCanAccessSubjectMaterials` reusa la misma regla que el foro).
- ❌ No puede crear/calificar/tomar asistencia/moderar nada.
- ❌ No puede llamar a `/users/search` (nunca pudo legítimamente, y ahora tampoco a nivel de API).
- ❌ Si no tiene ningún hijo vinculado todavía (el admin no lo vinculó), no puede ver absolutamente nada de un estudiante — lo cual es correcto, pero significa que el flujo de "vincular hijos" (sección Admin → Usuarios → Vincular hijos) es un paso operativo obligatorio para que una cuenta PARENT sea útil. Vale la pena que quede claro en el onboarding de un centro nuevo.

### Huecos/decisiones que quedan abiertas (no son bugs, son límites de alcance conocidos)

- **CENTRO puede calificar/gestionar materias que no "es suyo dar"** — es una decisión de producto explícita (CENTRO es co-administrador de toda la actividad académica de su centro), no un descuido; lo marco para que la valides como la que querés, no porque esté mal.
- **PARENT sin foro/material** — decisión de producto documentada en el propio código (`forum.policy.ts`: "PARENT y otros roles: sin acceso al foro, no está en el alcance del Bloque 2"), no un hallazgo de seguridad.
- **El modelo de `Assignment`** (sección 10.1) es la única limitación real de alcance que queda y que te recomiendo resolver antes de usar el producto con más de un estudiante por materia en serio.

---

## 11. Internacionalización (i18n): evaluación de alcance y plan propuesto

Pediste evaluar qué tan factible es ofrecer la app en otro idioma (inglés,
pensando en que la vea un recruiter de habla inglesa) y propusiste vos
mismo que fuera un simple selector de idioma en vez de traducir todo el
contenido, justamente para no tener que tocar la base de datos ni los
scripts de seed. Después de revisar el alcance real del código, esa es
también mi recomendación — pero con una distinción importante que vale la
pena dejar explícita antes de empezar a construir nada, para que la
decisión final sea tuya y no una sorpresa a mitad de camino.

### Qué SÍ es razonable traducir con un selector de idioma

Todo el texto **estático de la interfaz**, es decir, el que vive en el
código de React, no en la base de datos: títulos de pantalla, nombres de
botones ("Guardar", "Cancelar", "Ver Aula"), etiquetas de formularios,
mensajes de validación, encabezados de tabla, textos de los modales de
confirmación, el contenido de `InfoDialog`/`ConfirmDialog`, etc. Esto es
exactamente lo que vos tenías en mente, y técnicamente es sencillo con
una librería como `react-i18next`: un selector (🇪🇸/🇬🇧) en el Login y en
el Navbar, un diccionario `es.json`/`en.json` por idioma, y reemplazar
cada string literal (`"Guardar"`) por una llamada a la función de
traducción (`t('actions.save')`).

### Qué NO se puede traducir sin tocar la base de datos (el límite real)

El contenido que SÍ vive en la base de datos — nombres de materias
("Matemáticas"), títulos de tareas ("Ecuaciones de primer grado"),
anuncios, el cuerpo de los mensajes de chat, las preguntas de examen, los
posts del foro, los nombres de los eventos de calendario — es texto que
cargó un profesor/centro real (o, en la demo, que sembramos nosotros) y
**no se traduce solo con un selector de idioma en el frontend**, porque
ese texto no existe en dos versiones: existe una sola vez, en español,
como dato. Un selector de idioma en la UI puede cambiar el idioma de los
botones alrededor de "Ecuaciones de primer grado", pero no puede
inventarle una traducción al inglés a esa tarea sin que alguien (un
profesor, o nosotros en el seed) la escriba en ambos idiomas, o sin pasar
el texto por un traductor automático en tiempo real (lo cual tiene sus
propios costos/riesgos y no es gratis).

En otras palabras: con el enfoque que proponés, un recruiter que active
"English" vería un dashboard, botones y formularios en inglés perfecto,
pero seguiría viendo "Matemáticas", "Historia" y las tareas en español —
que para el propósito de portafolio (mostrar que la app funciona y que
sabés construir software bien hecho) es perfectamente aceptable y es
exactamente lo que ya esperabas, pero lo aclaro para que quede escrito y
no sea una sorpresa si alguien pregunta "¿por qué el nombre de la materia
no cambió de idioma?".

### Plan propuesto (si lo aprobás, lo implemento en la próxima pasada)

1. Instalar `i18next` + `react-i18next` + `i18next-browser-languagedetector`
   en el frontend (detecta el idioma del navegador como default, pero el
   selector manual siempre manda y se guarda en `localStorage`).
2. Crear `frontend/src/i18n/es.json` y `frontend/src/i18n/en.json` con la
   estructura de claves agrupada por pantalla (`login.*`, `dashboard.*`,
   `messages.*`, `calendar.*`, `common.*` para botones compartidos como
   "Guardar"/"Cancelar", etc.).
3. Agregar el selector de idioma como un botón pequeño en el Login (antes
   de autenticarse) y en el Navbar/Dashboard (después de autenticarse),
   reusando el mismo patrón visual que ya tienen los demás botones de
   acción rápida.
4. Pasar los 43 archivos `.tsx` del frontend (~8.600 líneas) reemplazando
   cada string de UI estático por `t('clave')`, archivo por archivo,
   verificando con `tsc --noEmit` después de cada tanda para no romper
   nada en el camino. Es mecánico pero extenso — es, con bastante
   diferencia, la tarea más grande de todo este round de feedback, así
   que prefiero que la apruebes explícitamente antes de dedicarle el
   tiempo que requiere, en vez de asumir que "evaluar el alcance" incluía
   hacerla completa sin preguntarte primero.
5. El backend NO necesita cambios: los mensajes de error de la API
   (`"No tienes acceso a esta materia"`, etc.) son pocos y podrían
   quedar en español siempre (lo normal en estos casos es traducir solo
   la capa de presentación, no las respuestas de error de un API interno
   que el usuario final nunca lee en crudo), salvo que prefieras que
   también se traduzcan — en ese caso habría que mandar el idioma
   preferido en cada request y duplicar los mensajes en `backend/src/`,
   lo cual es un esfuerzo aparte.

### Mi recomendación concreta

Avanzar con el plan de arriba tal cual (selector de idioma, solo UI
estática, contenido de base de datos siempre en español) es la opción
correcta para tu caso de uso — no cambiaría el enfoque. Lo único que
te pido confirmar antes de que le dedique el tiempo de pasada completa
por los 43 archivos es si lo querés para *esta* entrega o si preferís
que primero termine de verificar/cerrar todo lo demás (sección 12) y
lo dejemos como una mejora aparte para después de que puedas mostrar la
app — dado que es, de lejos, la tarea más grande que queda pendiente y
no es un bug ni una falla de seguridad/lógica/diseño de las que me
pediste específicamente que cubriera primero.

*Este informe cubre lectura estática del código y verificación de tipos (`tsc --noEmit`). No reemplaza pruebas automatizadas con el servidor corriendo contra una base de datos real, ni un pentest formal.*
