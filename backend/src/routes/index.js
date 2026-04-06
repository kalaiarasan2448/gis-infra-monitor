// src/routes/progress.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { body } = require('express-validator');
const { createProgressLog, getProjectProgress, syncOfflineLogs } = require('../controllers/progressController');
const { authenticate, authorize } = require('../middleware/auth');

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp + random + original extension
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max per file
});

const router = express.Router();
router.use(authenticate);

const logRules = [
  body('project_id').isUUID().withMessage('Valid project ID required'),
  body('completion_percentage').isFloat({ min: 0, max: 100 }),
  body('log_date').optional().isDate()
];

router.post('/', authorize('admin', 'engineer'), upload.array('images', 10), logRules, createProgressLog);
router.get('/:projectId', getProjectProgress);
router.post('/sync/offline', authorize('admin', 'engineer'), syncOfflineLogs);

module.exports = router;

// ----------------------------------------------------------

// src/routes/ai.js - AI prediction routes
const aiRouter = express.Router();
const { predictCompletion, runSimulation, detectDelays, analyzeImage } = require('../controllers/aiController');

aiRouter.use(authenticate);

aiRouter.post('/predict/:projectId', predictCompletion);
aiRouter.post('/simulate/:projectId', runSimulation);
aiRouter.post('/detect-delays', authorize('admin'), detectDelays);
aiRouter.post('/analyze-image', authorize('admin', 'engineer'), upload.single('image'), analyzeImage);

module.exports = { progressRouter: router, aiRouter };
