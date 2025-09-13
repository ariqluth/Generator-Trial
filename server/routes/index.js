import express from 'express';
import authRoutes from './authRoutes.js';
import generatorRoutes from './generatorRoutes.min.js';
import wireframeRoutes from './wireframeRoutes.min.js';
import docsRoutes from './docsRoutes.min.js';
import user_defaultRoutes from './user_defaultRoutes.js';
import productionGuard from '../middleware/productionGuard.js';
import dynamicRoutes from './dynamicRoutes.min.js';
import customFunctionRoutes from './customFunctionRoutes.min.js';
import erdViewRoutes from './erdViewRoutes.min.js';

const router = express.Router();

// API routes
router.use('/auth', authRoutes);
router.use('/generator', productionGuard, generatorRoutes);
// Allow wireframe in all envs to support local generator UI
router.use('/wireframe', /*productionGuard,*/ wireframeRoutes);
router.use('/docs', productionGuard, docsRoutes);
router.use('/dynamic', dynamicRoutes);
router.use('/fn', customFunctionRoutes);
router.use('/erd', productionGuard, erdViewRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running'
  });
});


router.use('/user', user_defaultRoutes);

export default router;
