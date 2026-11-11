import { Response } from 'express';

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    lastSync?: string | null;
    reportingDelay?: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: ApiSuccess<T>['meta']
): void => {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  } satisfies ApiSuccess<T>);
};

export const sendError = (
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
): void => {
  res.status(statusCode).json({
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  } satisfies ApiError);
};

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
  extra?: Record<string, unknown>
): void => {
  res.status(200).json({
    success: true,
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), ...extra },
  });
};
