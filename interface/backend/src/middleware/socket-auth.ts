import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { AuthenticationError, ErrorCode } from '../types/errors.js';
import { JWTPayload, ROLE_PERMISSIONS } from '../types/auth.js';

declare module 'socket.io' {
  interface Socket {
    user?: JWTPayload;
  }
}

export const authenticateSocket = (socket: Socket, next: (err?: Error) => void): void => {
  const token = socket.handshake.auth['token'];

  if (!token) {
    return next(new AuthenticationError('Access token required', ErrorCode.AUTHENTICATION_REQUIRED));
  }

  try {
    const jwtSecret = process.env['JWT_SECRET'] || 'your-secret-key';
    
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    decoded.permissions = ROLE_PERMISSIONS[decoded.role] || [];
    
    socket.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AuthenticationError('Invalid token', ErrorCode.TOKEN_INVALID));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AuthenticationError('Token expired', ErrorCode.TOKEN_EXPIRED));
    }
    return next(new AuthenticationError('Authentication failed', ErrorCode.TOKEN_INVALID));
  }
};