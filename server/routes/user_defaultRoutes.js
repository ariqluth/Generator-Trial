import express from 'express';
import { protect } from '../middleware/auth.js';
import * as user_defaultController from '../controllers/user_defaultController.js';

const router = express.Router();

// CRUD routes for user_default
router.get('/', protect, user_defaultController.getAll);
router.get('/:id', protect, user_defaultController.getById);
router.post('/', protect, user_defaultController.create);
router.put('/:id', protect, user_defaultController.update);
router.delete('/:id', protect, user_defaultController.remove);

export default router;
