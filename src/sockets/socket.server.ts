import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { JwtAccessPayload } from '../types/auth';

let ioInstance: Server | null = null;

export const initSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: [env.FRONTEND_URL, env.ELECTRON_ORIGIN, 'file://'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtAccessPayload;
      socket.data.userId = payload.userId;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    logger.info('Socket connected', { userId, socketId: socket.id });

    // Join user-specific room for targeted broadcasts
    socket.join(`user:${userId}`);

    socket.on('ping', (cb) => { if (typeof cb === 'function') cb({ pong: true, timestamp: new Date().toISOString() }); });

    socket.on('disconnect', (reason) => {
      logger.debug('Socket disconnected', { userId, reason });
    });

    // Send welcome event
    socket.emit('connected', {
      userId,
      message: 'Real-time connection established',
      timestamp: new Date().toISOString(),
    });
  });

  ioInstance = io;
  logger.info('Socket.IO server initialized');
  return io;
};

export const getSocketServer = (): Server => {
  if (!ioInstance) throw new Error('Socket server not initialized');
  return ioInstance;
};

export const emitToUser = (userId: string, event: string, data: Record<string, unknown>): void => {
  try {
    getSocketServer().to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Failed to emit socket event', { userId, event, error: err });
  }
};
