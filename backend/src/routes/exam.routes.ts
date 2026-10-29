import { Router } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware'; // O donde tengas tu middleware
import { 
    createExam, 
    getExamsBySubject, 
    getExamById, 
    submitExam, 
    getExamResults, 
    toggleExamResults // 👈 Antes se llamaba toggleExamVisibility
} from '../controllers/exam.controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas de Exámenes
router.post('/', createExam); // Crear examen
router.get('/subject/:subjectId', getExamsBySubject); // Listar por materia
router.get('/:id', getExamById); // Ver detalle / Responder
router.post('/submit', submitExam); // Enviar respuestas

// Rutas de Profesor
router.get('/:id/results', getExamResults); // Ver notas de alumnos
router.patch('/:id/toggle', toggleExamResults); // Activar/Desactivar revisión

export default router;