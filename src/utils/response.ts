import { Response } from 'express';

export const successResponse = <T>(
  data: T,
  message?: string
) => {
  return {
    success: true,
    data,
    message,
  };
};

export const errorResponse = (
  code: string,
  message: string,
  details?: unknown
) => {
  return {
    success: false,
    error: { code, message, details },
  };
};

export const createdResponse = <T>(
  data: T,
  message = 'Resource created successfully'
) => {
  return {
    success: true,
    data,
    message,
  };
};

export const notFoundResponse = (
  resource = 'Resource',
  id?: string
) => {
  const message = id
    ? `${resource} with ID ${id} not found`
    : `${resource} not found`;
  return {
    success: false,
    error: { code: 'NOT_FOUND', message },
  };
};

export const unauthorizedResponse = (
  message = 'Unauthorized'
) => {
  return {
    success: false,
    error: { code: 'UNAUTHORIZED', message },
  };
};

export const forbiddenResponse = (
  message = 'Forbidden'
) => {
  return {
    success: false,
    error: { code: 'FORBIDDEN', message },
  };
};

export const validationErrorResponse = (
  message = 'Validation error',
  details?: unknown
) => {
  return {
    success: false,
    error: { code: 'VALIDATION_ERROR', message, details },
  };
};

export const internalErrorResponse = (
  message = 'Internal server error',
  details?: unknown
) => {
  return {
    success: false,
    error: { code: 'INTERNAL_ERROR', message, details },
  };
};