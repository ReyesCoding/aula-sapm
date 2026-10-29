import { Router, Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { authenticateToken } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';
import { uploadSubjectMaterial, listSubjectMaterials, deleteDocument } from '../controllers/document.controller';

// Mismo wrapper que assignment.routes.ts: evita que un error de Multer (archivo
// muy grande, etc.) tire un 500 feo en vez de un 400 legible.
const uploadSafe = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof MulterError) {
        return res.status(400).json({ message: `Error de subida: ${err.message}` });
      }
      return res.status(400).json({ message: err.message || 'Error al procesar el archivo' });
    }
    next();
  });
};

const router = Router();

router.use(authenticateToken);

router.post('/subjects/:subjectId', uploadSafe, uploadSubjectMaterial);
router.get('/subjects/:subjectId', listSubjectMaterials);
router.delete('/:id', deleteDocument);

export default router;
