import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { Response, Request } from 'express';

declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}

export interface SocketEvents {
  'auth': (userId: string) => void;
  'account.connected': (data: { provider: string; accountId: string }) => void;
  'account.disconnected': (data: { provider: string; accountId: string }) => void;
  'analytics.updated': (data: { provider: string; metrics: Record<string, number> }) => void;
  'indexing.started': (data: { jobId: string; sourceType: string }) => void;
  'indexing.progress': (data: { jobId: string; progress: number }) => void;
  'indexing.completed': (data: { jobId: string; processed: number }) => void;
  'crawler.started': (data: { jobId: string }) => void;
  'crawler.progress': (data: { jobId: string; progress: number }) => void;
  'crawler.completed': (data: { jobId: string }) => void;
  'crawler.failed': (data: { jobId: string; error: string }) => void;
}

let io: SocketIOServer | null = null;

export const initializeSockets = (server: ReturnType<typeof createServer>): SocketIOServer => {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('auth', (userId: string) => {
      socket.userId = userId;
      console.log(`User ${userId} authenticated via socket`);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: unknown): void => {
  if (!io) return;
  io.emit(event, { userId, ...(data && typeof data === 'object' ? data as Record<string, unknown> : { data }) });
};

export const emitToSocket = (socketId: string, event: string, data: unknown): void => {
  if (!io) return;
  io.to(socketId).emit(event, data);
};

/**
 * Middleware to attach socket to response
 */
export const attachSocketToResponse = (socket: SocketIOServer) => {
  return (req: Request, res: Response, next: () => void) => {
    (res as unknown as Record<string, unknown>).socket = socket;
    next();
  };
};