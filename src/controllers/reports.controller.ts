import { Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess } from '../utils/api-response';
import { getPaginationParams } from '../utils/pagination';
import type { AuthenticatedRequest } from '../types/auth';

export class ReportsController {
  static async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { page, limit, skip } = getPaginationParams(req);
      const { type } = req.query as { type?: string };
      const [reports, total] = await Promise.all([
        prisma.analyticalReport.findMany({
          where: { userId: req.user.userId, ...(type ? { reportType: type } : {}) },
          orderBy: { createdAt: 'desc' },
          skip, take: limit,
          select: { id: true, title: true, reportType: true, source: true, dateFrom: true, dateTo: true, createdAt: true, exportedAt: true },
        }),
        prisma.analyticalReport.count({ where: { userId: req.user.userId, ...(type ? { reportType: type } : {}) } }),
      ]);
      sendSuccess(res, reports, 200, { page, limit, total });
    } catch (err) { next(err); }
  }

  static async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const report = await prisma.analyticalReport.findFirst({
        where: { id: req.params.reportId as string, userId: req.user.userId },
      });
      if (!report) { sendSuccess(res, null, 404); return; }
      sendSuccess(res, { ...report, data: JSON.parse(report.dataJson) });
    } catch (err) { next(err); }
  }

  static async export(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { reportId, format = 'json' } = req.body as { reportId: string; format?: string };
      const report = await prisma.analyticalReport.findFirst({
        where: { id: reportId, userId: req.user.userId },
      });
      if (!report) { sendSuccess(res, null, 404); return; }

      await prisma.analyticalReport.update({ where: { id: reportId }, data: { exportedAt: new Date() } });

      const data = JSON.parse(report.dataJson);
      if (format === 'csv') {
        const rows = Array.isArray(data) ? data : [data];
        const headers = Object.keys(rows[0] ?? {}).join(',');
        const lines = rows.map((r: Record<string, unknown>) => Object.values(r).map(v => `"${v}"`).join(','));
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/\s+/g, '_')}.csv"`);
        res.send([headers, ...lines].join('\n'));
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${report.title.replace(/\s+/g, '_')}.json"`);
      res.send(JSON.stringify({ report: { title: report.title, type: report.reportType, generatedAt: report.createdAt }, data }, null, 2));
    } catch (err) { next(err); }
  }
}
