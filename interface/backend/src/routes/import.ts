import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../middleware/error-handler.js';
import { requirePermission } from '../middleware/auth.js';
import { Permission } from '../types/auth.js';
import * as importController from '../controllers/import.js';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Allow JSON, YAML, and text files
    const allowedMimes = [
      'application/json',
      'text/plain',
      'text/yaml',
      'application/x-yaml',
      'text/x-yaml',
      'text/markdown',
      'text/x-markdown'
    ];
    
    const allowedExtensions = ['.json', '.yaml', '.yml', '.txt', '.md', '.markdown'];
    const hasValidMime = allowedMimes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );

    if (hasValidMime || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JSON, YAML, and text files are allowed.'));
    }
  }
});

// Import operations
router.get('/formats', requirePermission(Permission.WRITE_PROMPTS), asyncHandler(importController.getSupportedFormats));
router.post('/validate', requirePermission(Permission.WRITE_PROMPTS), asyncHandler(importController.validateImportContent));
router.post('/content', requirePermission(Permission.WRITE_PROMPTS), asyncHandler(importController.importFromContent));
router.post('/url', requirePermission(Permission.WRITE_PROMPTS), asyncHandler(importController.importFromUrl));
router.post('/file', requirePermission(Permission.WRITE_PROMPTS), upload.single('file'), asyncHandler(importController.importFromFile));

export { router as importRoutes };