import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export class NotificationsController {
  static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { page, limit } = getPaginationParams(req);
      const result = await NotificationService.getAll(userId, page, limit);
      const unreadCount = await NotificationService.unreadCount(userId);
      sendSuccess(res, result.notifications, 200, { page, limit, total: result.total, unreadCount } as any);
    } catch (err) { next(err); }
  }

  static async getUnread(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const notifications = await NotificationService.getUnread(userId);
      sendSuccess(res, notifications);
    } catch (err) { next(err); }
  }

  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const notificationId = req.params.notificationId as string;
      await NotificationService.markRead(userId, notificationId);
      sendSuccess(res, { message: 'Marked as read' });
    } catch (err) { next(err); }
  }

  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      await NotificationService.markAllRead(userId);
      sendSuccess(res, { message: 'All notifications marked as read' });
    } catch (err) { next(err); }
  }
}