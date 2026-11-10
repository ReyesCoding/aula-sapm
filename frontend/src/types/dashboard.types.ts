// Forma de una sola tarjeta de estadística. `type`/`subtext` son opcionales:
// hoy solo AcademicDashboard.tsx los usa (para hacer la tarjeta cliqueable y
// mostrar un subtítulo); StatsGrid/AdminDashboard simplemente los ignoran si
// no vienen. Antes AcademicDashboard.tsx declaraba su PROPIA copia local de
// este tipo (con esos dos campos extra) en vez de extender este — dos
// definiciones divergentes de lo mismo (hallazgo 6.4). Ahora hay una sola.
export interface StatItem {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  type?: string;
  subtext?: string;
}

export interface UserSummary {
  id: number;
  name: string;
  email?: string;
}

export interface SubjectSummary {
  id: number;
  name: string;
}

export interface StudentItem {
  student: UserSummary;
  subject: SubjectSummary;
}

export interface AssignmentTask {
  id: number;
  // v2.1: en la lista "por calificar" del profesor, `id` sigue siendo el ID
  // de la TAREA (assignment) — para no romper la navegación que ya existe a
  // /subject/:id con highlightId. `submissionId`, cuando viene, es el ID real
  // de la entrega (Submission): úsalo como key de lista en vez de `id`,
  // porque ahora una misma tarea compartida puede aparecer más de una vez
  // (una fila por cada alumno que entregó) y `id` solo ya no es único ahí.
  submissionId?: number;
  title: string;
  subject: SubjectSummary;
  student?: UserSummary;
  status?: string;
  grade?: number;
}

export interface ExamItem {
  id: number;
  title: string;
  subject: SubjectSummary;
  _count?: { submissions: number };
}

export interface EnrollmentRequest {
  id: number;
  student: UserSummary;
  subject: SubjectSummary;
}

// `details` es específico de cada rol (listas que alimentan los modales de
// detalle del dashboard de profesor/centro/admin). Antes vivía duplicado
// dentro de AcademicDashboard.tsx como un tipo `DashboardData` aparte.
export interface DashboardDetails {
  uniqueStudents?: StudentItem[];
  assignmentsToGrade?: AssignmentTask[];
  activeExams?: ExamItem[];
  pendingAssignments?: AssignmentTask[];
  pendingExams?: ExamItem[];
  completedAssignments?: AssignmentTask[];
  pendingEnrollments?: EnrollmentRequest[];
}

// Respuesta real de GET /dashboard/stats.
export interface DashboardStats {
  stats: StatItem[];
  details?: DashboardDetails;
}
