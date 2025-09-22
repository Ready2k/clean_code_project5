import { Request, Response } from 'express';
import { getConnectionManagementService } from '../services/connection-management-service.js';
import { AuthenticatedRequest } from '../types/auth.js';
import { 
  CreateConnectionRequest, 
  UpdateConnectionRequest,
  ConnectionListResponse,
  ConnectionResponse,
  ConnectionTestResponse,
  AvailableModelsResponse
} from '../types/connections.js';
import { logger } from '../utils/logger.js';
import { AppError, ValidationError } from '../types/errors.js';

// Extend the AuthenticatedRequest to include params and app
interface ExtendedAuthenticatedRequest extends AuthenticatedRequest {
  params: any;
  app: any;
}

/**
 * Get all connections for the authenticated user
 */
export const getConnections = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const connectionService = getConnectionManagementService();
    const connections = await connectionService.getConnections(userId);

    const response: ConnectionListResponse = {
      connections,
      total: connections.length
    };

    logger.info('Retrieved connections for user', {
      userId,
      count: connections.length
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get connections:', error);
    throw error;
  }
};

/**
 * Create a new connection
 */
export const createConnection = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const createRequest = req.body as unknown as CreateConnectionRequest;
    
    // Validate required fields
    if (!createRequest.name || !createRequest.provider || !createRequest.config) {
      throw new ValidationError('Missing required fields: name, provider, config');
    }

    const connectionService = getConnectionManagementService();
    const connection = await connectionService.createConnection(userId, createRequest);

    const response: ConnectionResponse = {
      connection
    };

    logger.info('Created new connection', {
      connectionId: connection.id,
      userId,
      provider: connection.provider
    });

    res.status(201).json(response);
  } catch (error) {
    logger.error('Failed to create connection:', error);
    throw error;
  }
};

/**
 * Get a specific connection by ID
 */
export const getConnection = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const { connectionId } = req.params;
    if (!connectionId) {
      throw new ValidationError('Connection ID is required', 'connectionId');
    }

    const connectionService = getConnectionManagementService();
    const connection = await connectionService.getConnection(userId, connectionId);

    const response: ConnectionResponse = {
      connection
    };

    logger.info('Retrieved connection', {
      connectionId,
      userId
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get connection:', error);
    throw error;
  }
};

/**
 * Update a connection
 */
export const updateConnection = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const { connectionId } = req.params;
    if (!connectionId) {
      throw new ValidationError('Connection ID is required', 'connectionId');
    }

    const updateRequest = req.body as unknown as UpdateConnectionRequest;
    
    // Validate that at least one field is being updated
    if (!updateRequest.name && !updateRequest.config && !updateRequest.status) {
      throw new ValidationError('At least one field must be provided for update');
    }

    const connectionService = getConnectionManagementService();
    const connection = await connectionService.updateConnection(userId, connectionId, updateRequest);

    const response: ConnectionResponse = {
      connection
    };

    logger.info('Updated connection', {
      connectionId,
      userId,
      updatedFields: Object.keys(updateRequest)
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to update connection:', error);
    throw error;
  }
};

/**
 * Delete a connection
 */
export const deleteConnection = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const { connectionId } = req.params;
    if (!connectionId) {
      throw new ValidationError('Connection ID is required', 'connectionId');
    }

    const connectionService = getConnectionManagementService();
    await connectionService.deleteConnection(userId, connectionId);

    logger.info('Deleted connection', {
      connectionId,
      userId
    });

    res.status(204).send();
  } catch (error) {
    logger.error('Failed to delete connection:', error);
    throw error;
  }
};

/**
 * Test a connection
 */
export const testConnection = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const { connectionId } = req.params;
    if (!connectionId) {
      throw new ValidationError('Connection ID is required', 'connectionId');
    }

    const connectionService = getConnectionManagementService();
    
    // Emit real-time update that testing has started
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('connection:test:started', { connectionId });
    }

    const testResult = await connectionService.testConnection(userId, connectionId);

    const response: ConnectionTestResponse = {
      result: testResult
    };

    // Emit real-time update with test results
    if (io) {
      io.to(`user:${userId}`).emit('connection:test:completed', { 
        connectionId, 
        result: testResult 
      });
    }

    logger.info('Tested connection', {
      connectionId,
      userId,
      success: testResult.success,
      latency: testResult.latency
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to test connection:', error);
    
    // Emit real-time update about test failure
    const userId = req.user?.userId;
    const { connectionId } = req.params;
    const io = req.app.get('io');
    if (io && userId && connectionId) {
      io.to(`user:${userId}`).emit('connection:test:failed', { 
        connectionId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    throw error;
  }
};

/**
 * Get available models for a provider
 */
export const getAvailableModels = async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider } = req.params;
    
    if (!provider || !['openai', 'bedrock'].includes(provider)) {
      throw new ValidationError('Provider must be either "openai" or "bedrock"', 'provider');
    }

    const connectionService = getConnectionManagementService();
    const models = connectionService.getAvailableModels(provider as 'openai' | 'bedrock');

    const response: AvailableModelsResponse = {
      models,
      provider
    };

    logger.info('Retrieved available models', {
      provider,
      modelCount: models.length
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get available models:', error);
    throw error;
  }
};

/**
 * Get connection status (health check for specific connection)
 */
export const getConnectionStatus = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const { connectionId } = req.params;
    if (!connectionId) {
      throw new ValidationError('Connection ID is required', 'connectionId');
    }

    const connectionService = getConnectionManagementService();
    const connection = await connectionService.getConnection(userId, connectionId);

    const statusInfo = {
      id: connection.id,
      name: connection.name,
      provider: connection.provider,
      status: connection.status,
      lastTested: connection.lastTested,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt
    };

    logger.info('Retrieved connection status', {
      connectionId,
      userId,
      status: connection.status
    });

    res.json(statusInfo);
  } catch (error) {
    logger.error('Failed to get connection status:', error);
    throw error;
  }
};

/**
 * Get health status of all connections for a user
 */
export const getAllConnectionsHealth = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const connectionService = getConnectionManagementService();
    const connections = await connectionService.getConnections(userId);
    const stats = await connectionService.getConnectionStats(userId);

    const healthInfo = {
      summary: stats,
      connections: connections.map(conn => ({
        id: conn.id,
        name: conn.name,
        provider: conn.provider,
        status: conn.status,
        lastTested: conn.lastTested
      }))
    };

    logger.info('Retrieved all connections health', {
      userId,
      totalConnections: stats.total,
      activeConnections: stats.active
    });

    res.json(healthInfo);
  } catch (error) {
    logger.error('Failed to get all connections health:', error);
    throw error;
  }
};

/**
 * Test all connections for a user
 */
export const testAllConnections = async (req: ExtendedAuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new AppError('User ID not found in request', 401, 'AUTHENTICATION_REQUIRED' as any);
    }

    const connectionService = getConnectionManagementService();
    
    // Emit real-time update that bulk testing has started
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${userId}`).emit('connections:test:started', { userId });
    }

    const testResults = await connectionService.testAllConnections(userId);

    // Emit real-time update with all test results
    if (io) {
      io.to(`user:${userId}`).emit('connections:test:completed', { 
        userId, 
        results: testResults 
      });
    }

    logger.info('Tested all connections', {
      userId,
      totalTests: Object.keys(testResults).length,
      successfulTests: Object.values(testResults).filter(r => r.success).length
    });

    res.json({ results: testResults });
  } catch (error) {
    logger.error('Failed to test all connections:', error);
    
    // Emit real-time update about bulk test failure
    const userId = req.user?.userId;
    const io = req.app.get('io');
    if (io && userId) {
      io.to(`user:${userId}`).emit('connections:test:failed', { 
        userId, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
    
    throw error;
  }
};