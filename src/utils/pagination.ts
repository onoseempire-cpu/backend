import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface DateRangeParams {
  startDate?: string;
  endDate?: string;
  period?: string;
}

export const getPaginationParams = (req: Request): PaginationParams => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export const getDateRangeParams = (req: Request): DateRangeParams => {
  return {
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    period: req.query.period as string | undefined,
  };
};

export const buildSortOrder = (
  sortBy?: string,
  sortOrder?: string,
  allowedFields: string[] = []
): Record<string, 'asc' | 'desc'> => {
  if (!sortBy || !allowedFields.includes(sortBy)) return { createdAt: 'desc' };
  return { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
};
