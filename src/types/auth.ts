import { Request } from 'express';

export interface JwtAccessPayload {
  userId: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

export interface JwtRefreshPayload {
  userId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: string;
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}
