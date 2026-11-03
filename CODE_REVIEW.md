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

**Esto no es un bug de autorización — es una limitación de diseño que afecta la funcionalidad central de "tareas".**

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

### Verificación realizada

- `npx tsc --noEmit` limpio en `backend/` y `frontend/` después de **cada** cambio significativo, no solo al final.
- `grep` exhaustivo, repetido al final de todo, confirmando cero: `@ts-ignore`, `(req as any).user` en controllers, `{ error: }`, `alert(`, `new PrismaClient` duplicado, y referencias a cualquier archivo borrado.
- Trazado manual de cada endpoint modificado, siguiendo el flujo rol → policy → query de Prisma, para los 4 hallazgos críticos + los 2 nuevos (10.1, 10.4).
- **Lo que NO pude verificar:** no tengo acceso de red a tu base de datos de Neon desde este entorno, así que no corrí las rutas contra datos reales ni un server levantado — esto es revisión estática + compilación, no una prueba de integración end-to-end. Tampoco corrí `npm run build` del frontend hasta el final (falló por un problema de binario nativo de Rollup específico de este entorno de ejecución, no relacionado con ningún cambio que hice — `tsc --noEmit`, que es la verificación de tipos real, sí pasó limpio). Si querés que verifiquemos con el servidor realmente corriendo, es el siguiente paso lógico y lo puedo guiar.

---

## 11. Auditoría de permisos por rol — qué puede y no puede hacer cada uno, ahora mismo

Esta es la matriz que pediste: validé cada fila leyendo el código actual (post-fix), no la arquitectura "en teoría". Convención: ✅ puede, ❌ no puede, ⚠️ puede con una condición específica.

### ADMIN (rol de plataforma, sin centro propio)

Acceso total, sin restricción de centro, en prácticamente todo. Específicamente:
- ✅ Crear/listar/editar centros educativos; asignar cualquier usuario a cualquier centro.
- ✅ Crear/listar/eliminar cualquier usuario; actualizar el rol de cualquiera; vincular/desvincular padres-hijos.
- ✅ Crear materias para cualquier centro; ver todas las materias de todos los centros.
- ✅ Crear exámenes, tareas, calificar, tomar asistencia, moderar foros, subir material, crear eventos de cualquier tipo — en cualquier materia de cualquier centro (todas las `policy.ts` devuelven `true` para ADMIN como primer chequeo).
- ✅ Ver el reporte PDF y las calificaciones de cualquier estudiante.
- ✅ Buscar usuarios (`/users/search`) sin filtro de centro.
- ⚠️ No puede borrar su propia cuenta de usuario mientras está logueado (protección explícita en `deleteUser`, para no perder el acceso al panel).
- ❌ No tiene dashboard de "mis materias" (su dashboard es de agregados de plataforma: usuarios/materias/tareas totales).

### CENTRO (admin de una institución específica)

Todo lo de arriba, pero **acotado a `educationalCenterId === el suyo`**, verificado con `assertSameCenter`/`centerWhere` en cada endpoint:
- ✅ Ver/crear materias de su centro; crear exámenes y tareas en cualquier materia de su centro (no necesita ser el profesor asignado — `canGradeSubject` lo permite explícitamente para CENTRO).
- ✅ Calificar, tomar asistencia, moderar foros, subir material, crear eventos — en cualquier materia de su centro, por el mismo motivo (es "co-administrador" de toda la materia, no solo de la suya).
- ✅ Crear eventos de tipo `CENTER` para su propio centro (no para otro).
- ✅ Buscar usuarios (`/users/search`) — acotado a su centro desde el fix de la sección 10.4.
- ✅ Ver el reporte PDF y las calificaciones de cualquier estudiante de su centro (`assertCanViewStudentGrades` lo valida contra `educationalCenterId`).
- ❌ No puede crear/editar centros, ni crear/eliminar usuarios, ni cambiar roles — eso sigue siendo exclusivo de ADMIN (`users.routes.ts` lo bloquea a nivel de ruta).
- ❌ No puede ver ni tocar nada de otro centro — confirmado: cualquier intento devuelve 403 vía `assertSameCenter`.
- ⚠️ `getCenter` (`GET /centers/:id`): puede ver el detalle de su propio centro, pero no el de otro (chequeo explícito `user.educationalCenterId !== id`).

### TEACHER (profesor)

El rol con permisos más "quirúrgicos" — casi todo está condicionado a `subject.teacherId === su userId`:
- ✅ Crear materias (aparece como su propio profesor) y exámenes/tareas, pero **solo en materias donde él es el `teacherId`** — si el `subjectId` pertenece a otro profesor, 403 (`createExam`, `createAssignment`).
- ✅ Calificar, tomar asistencia, moderar foro, subir material, crear eventos de materia, ver entregas — pero **solo en sus propias materias** (`canGradeSubject`/`canModerateSubject` devuelven `false` si `teacherId !== actor.userId`).
- ✅ Ver reporte PDF / calificaciones / asistencia de un estudiante — pero **solo si ese estudiante tiene una inscripción `ACTIVE` en alguna materia que él imparte** (`assertCanViewStudentGrades`, rama TEACHER). No puede pedir el reporte de un estudiante cualquiera del sistema (este era el hallazgo 3.4, ya corregido).
- ✅ Buscar usuarios (`/users/search`) — acotado a su centro.
- ✅ Crear conversaciones grupales/de anuncio (`canCreateGroupOrAnnouncement`); contactar a sus propios estudiantes, los padres de esos estudiantes, y el staff de su centro — no a estudiantes de otras materias ni de otros profesores.
- ❌ No puede crear/editar usuarios, centros, ni ver/calificar materias que no son suyas.
- ❌ No puede crear eventos de tipo `CENTER` (`canManageCenterEvents` excluye a TEACHER).
- ⚠️ `getAssignmentById`/`getSubmissionsByAssignment`: solo si es el `creatorId` de esa tarea específica (no basta con ser el profesor de la materia en general — es el `creatorId` exacto).

### STUDENT (alumno)

El rol más restringido, y el que más se endureció en esta pasada:
- ✅ Ver/entregar tareas y exámenes de materias donde tiene inscripción `ACTIVE` (verificado explícitamente en los fixes 4.2 y 3.3 — antes no se chequeaba inscripción en absoluto).
- ✅ Ver sus propias calificaciones, asistencia, y su propio reporte PDF (`assertCanViewStudentGrades`/`assertCanViewStudentAttendance`, rama STUDENT: solo si `actor.userId === studentId`).
- ✅ Participar en el foro de materias donde está inscrito `ACTIVE`; ver/descargar material de esas materias.
- ✅ Contactar a los profesores de sus materias activas y al staff (CENTRO/ADMIN) de su centro — **no** a otros estudiantes (regla explícita, "sin mensajería estudiante-a-estudiante", documentada en `messaging.policy.ts`).
- ❌ No puede crear materias, exámenes, tareas, eventos, ni calificar — todo bloqueado a nivel de ruta o de policy.
- ❌ No puede ver tareas/entregas/calificaciones de otro estudiante, ni de materias donde no está inscrito (hallazgos 3.3 y 4.2, ya corregidos).
- ❌ No puede llamar a `/users/search` (bloqueado en el fix 10.4 — antes sí podía, era parte de la fuga).
- ⚠️ Puede ver una tarea compartida sin reclamar (`studentId: null`) de una materia donde está inscrito, pero una vez que CUALQUIER estudiante la entrega, por la limitación de modelo de datos de la sección 10.1, es ese estudiante quien "posee" la fila — otro estudiante que intente entregar sobre la misma tarea recibe 409, no puede entregar su propia versión independiente.

### PARENT (padre/madre)

Rol de solo lectura sobre sus hijos vinculados, nada más:
- ✅ Ver las calificaciones, asistencia y reporte PDF de un hijo — **solo** si existe un registro `ParentChild` que los vincula (`assertCanViewStudentGrades`/`assertCanViewStudentAttendance`, rama PARENT). Esto incluye el fix nuevo en `getAssignmentById`, que ahora también respeta esta regla para ver una entrega específica de su hijo.
- ✅ Contactar a los profesores de las materias de sus hijos vinculados, y al staff de su centro.
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

*Este informe cubre lectura estática del código y verificación de tipos (`tsc --noEmit`). No reemplaza pruebas automatizadas con el servidor corriendo contra una base de datos real, ni un pentest formal.*
