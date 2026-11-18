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

// This interface is used by the integrations controller
// The middleware's AuthenticatedRequest has user.id, but integrations controller expects user.userId
export interface AuthenticatedRequestWithUserId extends Request {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

// Legacy interface for backward compatibility
export interface AuthenticatedRequest extends Request {
  method: string;
  path: string;
  url: string;
  ip: string;
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
