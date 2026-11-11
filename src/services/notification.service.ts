import prisma from '../config/database';
import { logger } from '../utils/logger';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'sync' | 'indexing' | 'crawler';

export class NotificationService {
  static async create(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    try {
      return await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    } catch (err) {
      logger.error('Failed to create notification', { error: err, userId, title });
      return null;
    }
  }

  static async getUnread(userId: string, limit = 50) {
    return prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  static async getAll(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);
    return { notifications, total, page, limit };
  }

  static async markRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  static async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  static async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, isRead: false } });
  }
}
