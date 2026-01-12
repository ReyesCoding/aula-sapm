import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Asegurarnos de que la carpeta uploads exista (Buena práctica para evitar errores si borras la carpeta)
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // ✅ TU LÓGICA ANTERIOR (Perfecta y sin dependencias extra)
    // Genera: 1735689000-123456789.xlsx
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 20 * 1024 * 1024 // 👈 ACTUALIZADO: Límite de 20MB (Antes era 5MB)
  },
  // 🗑️ ELIMINADO EL fileFilter: 
  // Al no poner filtro, Multer acepta Excel, Zip, Word, Imágenes... ¡Todo!
});