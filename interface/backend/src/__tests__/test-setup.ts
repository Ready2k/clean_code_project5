import express from 'express';
import cors from 'cors';
import { MockRedisService } from '../services/mock-redis-service.js';
import { UserService } from '../services/user-service.js';
import { authRoutes } from '../routes/auth.js';
import { adminRoutes } from '../routes/admin.js';
import { errorHandler } from '../middleware/error-handler.js';

export async function createTestApp() {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Initialize test services
  const redisService = new MockRedisService();
  await redisService.connect();
  const userService = new UserService(redisService);
  
  // Mock service getters globally
  const originalGetUserService = global.getUserService;
  global.getUserService = () => userService;
  
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  
  // Error handling
  app.use(errorHandler);
  
  return {
    app,
    redisService,
    userService,
    cleanup: async () => {
      await redisService.flushall();
      await redisService.disconnect();
      global.getUserService = originalGetUserService;
    }
  };
}

// Extend global namespace
declare global {
  var getUserService: () => UserService;
}