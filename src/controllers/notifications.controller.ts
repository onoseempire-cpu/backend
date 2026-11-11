import { Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { sendSuccess } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import type { AuthenticatedRequest } from '../types/auth';

export class NotificationsController {
  static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit } = getPaginationParams(req);
      const result = await NotificationService.getAll(req.user.userId, page, limit);
      const unreadCount = await NotificationService.unreadCount(req.user.userId);
      sendSuccess(res, result.notifications, 200, { page, limit, total: result.total, unreadCount } as unknown as Parameters<typeof sendSuccess>[3]);
    } catch (err) { next(err); }
  }

  static async getUnread(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const notifications = await NotificationService.getUnread(req.user.userId);
      sendSuccess(res, notifications);
    } catch (err) { next(err); }
  }

  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const notificationId = req.params.notificationId as string;
      await NotificationService.markRead(req.user.userId, notificationId);
      sendSuccess(res, { message: 'Marked as read' });
    } catch (err) { next(err); }
  }

  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await NotificationService.markAllRead(req.user.userId);
      sendSuccess(res, { message: 'All notifications marked as read' });
    } catch (err) { next(err); }
  }
}
