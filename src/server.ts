import http from 'http';
import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initSocketServer } from './sockets/socket.server';
import { IndexerScheduler } from './indexer/indexer.scheduler';
import prisma from './config/database';

const PORT = env.PORT;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('✅ Database connected (SQLite)');

    // Create HTTP server
    const httpServer = http.createServer(app);

    // Initialize Socket.IO
    initSocketServer(httpServer);
    logger.info('✅ Socket.IO initialized');

    // Start cron schedulers
    IndexerScheduler.start();
    logger.info('✅ Background schedulers started');

    // Start listening
    httpServer.listen(PORT, () => {
      logger.info(`🚀 PMAV Backend running on http://localhost:${PORT}`);
      logger.info(`📡 API: http://localhost:${PORT}/api/${env.API_VERSION}`);
      logger.info(`🔌 WebSocket: ws://localhost:${PORT}`);
      logger.info(`🌍 Environment: ${env.NODE_ENV}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);
      IndexerScheduler.stop();
      httpServer.close(async () => {
        await prisma.$disconnect();
        logger.info('Server shut down. Goodbye.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err) {
    logger.error('Failed to start server', { error: err });
    process.exit(1);
  }
}

startServer();
