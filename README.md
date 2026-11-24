# 📚 Aula SAPM - Sistema de Gestión Escolar

Plataforma integral para la gestión de tareas, entregas y calificaciones, diseñada para facilitar la interacción entre Profesores y Estudiantes.

🔗 **Demo en vivo:** [aula-sapm-demo.onrender.com](https://aula-sapm-demo.onrender.com)
*(Proyecto de portafolio con datos ficticios. El backend corre en el plan gratuito de Render, así que la primera carga puede tardar ~30-50s en "despertar".)*

La propia pantalla de login de la demo incluye botones de **"Entrar como..."** para cada rol (Admin, Centro, Profesor, Estudiante, Padre/Madre): un clic y entras, sin necesidad de copiar credenciales. Las mismas cuentas están documentadas abajo por si prefieres probarlas manualmente o integrarlas en tus propias pruebas.

## 🚀 Características Principales

### 👨‍🏫 Panel de Profesor
- **Gestión de Tareas:** Crear, editar y eliminar tareas grupales o individuales.
- **Archivos Adjuntos:** Subida de material de apoyo (PDF, Imágenes, etc.) para los alumnos.
- **Calificaciones:** Visualización de entregas, asignación de notas (0-100) y feedback detallado.
- **Control de Tiempos:** Fechas de vencimiento estrictas con bloqueo automático.

### 👨‍🎓 Panel de Estudiante
- **Dashboard Intuitivo:** Vista clara de tareas Pendientes, Vencidas y Completadas.
- **Entrega de Tareas:** Subida de archivos (Word, Excel, PDF, Zip, etc.) sin restricciones de tipo.
- **Feedback:** Visualización de notas y comentarios del profesor.
- **Alertas:** Indicadores visuales de tareas próximas a vencer o ya vencidas.

## 🛠️ Stack Tecnológico

**Frontend:**
- React + TypeScript (Vite)
- TailwindCSS (Estilizado)
- Lucide React (Iconografía)
- Axios (Comunicación HTTP)

**Backend:**
- Node.js + Express
- Prisma ORM
- Base de Datos: SQLite (Entorno Dev) / PostgreSQL (Compatible)
- Multer (Gestión de Archivos)
- JWT (Autenticación y Seguridad)

## ⚙️ Instalación y Despliegue Local

Este proyecto utiliza un **Monorepo** para facilitar el desarrollo.

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/ReyesCoding/aula-sapm.git](https://github.com/ReyesCoding/aula-sapm.git)
    cd aula-sapm
    ```

2.  **Instalar dependencias (Raíz, Backend y Frontend):**
    ```bash
    npm run install:all
    ```

3.  **Configurar Variables de Entorno:**
    - Crea un archivo `.env` en `/backend` basado en el ejemplo (define `DATABASE_URL`, `JWT_SECRET`).

4.  **Inicializar Base de Datos:**
    ```bash
    cd backend
    npx prisma migrate dev --name init
    cd ..
    ```

5.  **Ejecutar el proyecto (Backend + Frontend):**
    ```bash
    npm run dev
    ```
    - Frontend: `http://localhost:5173`
    - Backend: `http://localhost:3001`

## 🛡️ Roles de Usuario (Demo)

Datos de ejemplo (sin información real) sembrados por `prisma/seed.ts`, `prisma/seed-demo-content.ts` y `prisma/seed-social-content.ts`. Todas las cuentas usan la misma contraseña de prueba.

| Rol | Email | Contraseña (Demo) | Alcance |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@aula.com` | `123456` | Plataforma completa, todos los centros |
| **Centro** | `centro@aula.com` | `123456` | Administración de "Centro Horizonte" |
| **Profesor** | `teacher@aula.com` | `123456` | Materias, tareas, exámenes, calificaciones |
| **Estudiante** | `student@aula.com` | `123456` | Vista de alumno (Pedro Jiménez) |
| **Padre/Madre** | `parent@aula.com` | `123456` | Vista de seguimiento de sus 2 hijos vinculados (Pedro y Ana) |

Hay 5 estudiantes adicionales (`maria@aula.com`, `carlos@aula.com`, `sofia@aula.com`, `diego@aula.com`, `ana@aula.com`, todos con contraseña `123456`) si quieres ver el sistema con más de un alumno inscrito a la vez, y una segunda cuenta de Padre/Madre (`parent2@aula.com`, madre de María) para probar la mensajería "padre con padre".

> Estas credenciales son intencionalmente públicas: es un entorno de demostración con datos ficticios, pensado para que cualquiera pueda explorarlo libremente. Si este código se reutiliza como base para un sistema con datos reales, elimina esta sección, cambia las contraseñas y desactiva el panel de "Modo Demo" del login con la variable de entorno `VITE_DEMO_MODE=false`.

---
Desarrollado por **Bryan Reyes**.