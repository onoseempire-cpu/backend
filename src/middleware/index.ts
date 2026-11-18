export { authenticate, optionalAuth, authenticateJWT } from './auth.middleware';
export type { AuthenticatedRequest } from './auth.middleware';
// Alias for backward compatibility
export type { AuthenticatedRequest as AuthenticatedRequestUser } from './auth.middleware';
