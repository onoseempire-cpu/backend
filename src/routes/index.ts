import { Router, Request, Response } from 'express';
import authRoutes from './auth.routes';
import integrationsRoutes from './integrations.routes';
import analyticsRoutes from './analytics.routes';
import indexerRoutes from './indexer.routes';
import crawlerRoutes from './crawler.routes';
import aiRoutes from './ai.routes';
import reportsRoutes from './reports.routes';
import notificationsRoutes from './notifications.routes';

const router = Router();

// Health check
router.get('/health', (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'healthy', version: 'v1', timestamp: new Date().toISOString() } });
});

// API routes
router.use('/auth', authRoutes);
router.use('/integrations', integrationsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/indexer', indexerRoutes);
router.use('/crawler', crawlerRoutes);
router.use('/ai', aiRoutes);
router.use('/reports', reportsRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
