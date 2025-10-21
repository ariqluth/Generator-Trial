import express from 'express';
import { getGraph } from '../controllers/erdController.js';

const router = express.Router();

router.get('/graph', getGraph);

export default router;
