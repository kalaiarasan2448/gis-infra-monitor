// src/routes/projects.js
const express = require('express');
const { body } = require('express-validator');
const {
  getAllProjects, getProjectById, createProject,
  updateProject, deleteProject, getStats
} = require('../controllers/projectController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// All project routes require authentication
router.use(authenticate);

// Validation rules for creating a project
const projectRules = [
  body('name').trim().notEmpty().withMessage('Project name is required'),
  body('category').isIn(['education', 'healthcare', 'road', 'water', 'electricity', 'housing', 'other']),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
  body('start_date').isDate().withMessage('Valid start date required'),
  body('expected_end_date').isDate().withMessage('Valid expected end date required')
];

router.get('/stats/summary', getStats);            // GET  /api/projects/stats/summary
router.get('/', getAllProjects);                    // GET  /api/projects
router.get('/:id', getProjectById);                // GET  /api/projects/:id
router.post('/', authorize('admin', 'engineer'), projectRules, createProject);  // POST
router.put('/:id', authorize('admin', 'engineer'), updateProject);              // PUT
router.delete('/:id', authorize('admin'), deleteProject);                       // DELETE

module.exports = router;
