# 📚 Aula SAPM - Sistema de Gestión Escolar

Plataforma integral para la gestión de tareas, entregas y calificaciones, diseñada para facilitar la interacción entre Profesores y Estudiantes.

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

| Rol | Email | Contraseña (Demo) |
| :--- | :--- | :--- |
| **Profesor** | `profe@aula.com` | `123456` |
| **Estudiante** | `student@aula.com` | `123456` |

---
Desarrollado por **Bryan Reyes**.