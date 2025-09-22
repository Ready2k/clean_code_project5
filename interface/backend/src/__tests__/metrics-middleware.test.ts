import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { recordMetrics, trackAPIUsage, trackSecurityEvents } from '../middleware/metrics.js';

// Mock the system monitoring service
const mockSystemMonitoringService = {
  recordRequest: vi.fn(),
  addSystemEvent: vi.fn()
};

vi.mock('../services/system-monitoring-service.js', () => ({
  getSystemMonitoringService: () => mockSystemMonitoringService
}));

vi.mock('../utils/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('Metrics Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('test-user-agent')
    };

    mockRes = {
      statusCode: 200,
      end: vi.fn()
    };

    mockNext = vi.fn();

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('recordMetrics', () => {
    it('should record successful request metrics', (done) => {
      const originalEnd = mockRes.end;
      
      recordMetrics(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledOnce();
      
      // Simulate response end
      setTimeout(() => {
        mockRes.end!('response data');
        
        expect(mockSystemMonitoringService.recordRequest).toHaveBeenCalledWith(
          expect.any(Number),
          true
        );
        done();
      }, 10);
    });

    it('should record failed request metrics', (done) => {
      mockRes.statusCode = 500;
      
      recordMetrics(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledOnce();
      
      // Simulate response end
      setTimeout(() => {
        mockRes.end!('error response');
        
        expect(mockSystemMonitoringService.recordRequest).toHaveBeenCalledWith(
          expect.any(Number),
          false
        );
        done();
      }, 10);
    });

    it('should log slow requests', (done) => {
      recordMetrics(mockReq as Request, mockRes as Response, mockNext);
      
      // Simulate slow response (delay before ending)
      setTimeout(() => {
        mockRes.end!('slow response');
        
        expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
          'warning',
          'performance',
          expect.stringContaining('Slow request'),
          expect.objectContaining({
            responseTime: expect.any(Number),
            statusCode: 200,
            method: 'GET',
            path: '/api/test'
          })
        );
        done();
      }, 1100); // More than 1000ms threshold
    });

    it('should log server errors', (done) => {
      mockRes.statusCode = 500;
      
      recordMetrics(mockReq as Request, mockRes as Response, mockNext);
      
      setTimeout(() => {
        mockRes.end!('server error');
        
        expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
          'error',
          'system',
          expect.stringContaining('Server error'),
          expect.objectContaining({
            statusCode: 500,
            method: 'GET',
            path: '/api/test'
          })
        );
        done();
      }, 10);
    });

    it('should handle metrics recording errors gracefully', (done) => {
      mockSystemMonitoringService.recordRequest.mockImplementation(() => {
        throw new Error('Metrics service error');
      });
      
      recordMetrics(mockReq as Request, mockRes as Response, mockNext);
      
      setTimeout(() => {
        // Should not throw, just log error
        expect(() => mockRes.end!('response')).not.toThrow();
        done();
      }, 10);
    });
  });

  describe('trackAPIUsage', () => {
    it('should track prompt creation', () => {
      mockReq.path = '/api/prompts';
      mockReq.method = 'POST';
      (mockReq as any).user = { userId: 'test-user' };
      
      trackAPIUsage(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
        'info',
        'service',
        'Prompt created via API',
        expect.objectContaining({
          method: 'POST',
          path: '/api/prompts',
          userId: 'test-user'
        })
      );
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should track connection creation', () => {
      mockReq.path = '/api/connections';
      mockReq.method = 'POST';
      (mockReq as any).user = { userId: 'test-user' };
      
      trackAPIUsage(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
        'info',
        'service',
        'LLM connection created',
        expect.objectContaining({
          method: 'POST',
          path: '/api/connections',
          userId: 'test-user'
        })
      );
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should track prompt enhancement', () => {
      mockReq.path = '/api/prompts/123/enhance';
      mockReq.method = 'POST';
      (mockReq as any).user = { userId: 'test-user' };
      
      trackAPIUsage(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
        'info',
        'service',
        'Prompt enhancement initiated',
        expect.objectContaining({
          method: 'POST',
          path: '/api/prompts/123/enhance',
          userId: 'test-user'
        })
      );
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should not track non-matching requests', () => {
      mockReq.path = '/api/other';
      mockReq.method = 'GET';
      
      trackAPIUsage(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle tracking errors gracefully', () => {
      mockSystemMonitoringService.addSystemEvent.mockImplementation(() => {
        throw new Error('Tracking service error');
      });
      
      mockReq.path = '/api/prompts';
      mockReq.method = 'POST';
      
      expect(() => {
        trackAPIUsage(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('trackSecurityEvents', () => {
    it('should track failed login attempts', () => {
      mockReq.path = '/api/auth/login';
      mockRes.statusCode = 401;
      
      trackSecurityEvents(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
        'warning',
        'security',
        'Failed login attempt',
        expect.objectContaining({
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
          timestamp: expect.any(String)
        })
      );
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should track unauthorized access attempts', () => {
      mockReq.path = '/api/admin/users';
      mockRes.statusCode = 403;
      (mockReq as any).user = { userId: 'test-user' };
      
      trackSecurityEvents(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
        'warning',
        'security',
        'Unauthorized access attempt',
        expect.objectContaining({
          method: 'GET',
          path: '/api/admin/users',
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
          userId: 'test-user'
        })
      );
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should track rate limit violations', () => {
      mockReq.path = '/api/prompts';
      mockRes.statusCode = 429;
      
      trackSecurityEvents(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
        'warning',
        'security',
        'Rate limit exceeded',
        expect.objectContaining({
          ip: '127.0.0.1',
          userAgent: 'test-user-agent',
          path: '/api/prompts'
        })
      );
      
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should not track successful requests', () => {
      mockReq.path = '/api/prompts';
      mockRes.statusCode = 200;
      
      trackSecurityEvents(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockSystemMonitoringService.addSystemEvent).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledOnce();
    });

    it('should handle security tracking errors gracefully', () => {
      mockSystemMonitoringService.addSystemEvent.mockImplementation(() => {
        throw new Error('Security tracking error');
      });
      
      mockReq.path = '/api/auth/login';
      mockRes.statusCode = 401;
      
      expect(() => {
        trackSecurityEvents(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();
      
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('integration', () => {
    it('should work together in middleware chain', (done) => {
      const middlewares = [recordMetrics, trackAPIUsage, trackSecurityEvents];
      
      mockReq.path = '/api/prompts';
      mockReq.method = 'POST';
      (mockReq as any).user = { userId: 'test-user' };
      
      let middlewareIndex = 0;
      const nextFunction = () => {
        middlewareIndex++;
        if (middlewareIndex < middlewares.length) {
          middlewares[middlewareIndex](mockReq as Request, mockRes as Response, nextFunction);
        } else {
          // All middlewares completed
          setTimeout(() => {
            mockRes.end!('response');
            
            // Should have recorded metrics and tracked API usage
            expect(mockSystemMonitoringService.recordRequest).toHaveBeenCalled();
            expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
              'info',
              'service',
              'Prompt created via API',
              expect.any(Object)
            );
            done();
          }, 10);
        }
      };
      
      middlewares[0](mockReq as Request, mockRes as Response, nextFunction);
    });

    it('should handle multiple events in single request', (done) => {
      mockReq.path = '/api/auth/login';
      mockReq.method = 'POST';
      mockRes.statusCode = 401; // Failed login
      
      const middlewares = [recordMetrics, trackAPIUsage, trackSecurityEvents];
      
      let middlewareIndex = 0;
      const nextFunction = () => {
        middlewareIndex++;
        if (middlewareIndex < middlewares.length) {
          middlewares[middlewareIndex](mockReq as Request, mockRes as Response, nextFunction);
        } else {
          setTimeout(() => {
            mockRes.end!('unauthorized');
            
            // Should have recorded failed request metrics
            expect(mockSystemMonitoringService.recordRequest).toHaveBeenCalledWith(
              expect.any(Number),
              false
            );
            
            // Should have tracked security event
            expect(mockSystemMonitoringService.addSystemEvent).toHaveBeenCalledWith(
              'warning',
              'security',
              'Failed login attempt',
              expect.any(Object)
            );
            
            done();
          }, 10);
        }
      };
      
      middlewares[0](mockReq as Request, mockRes as Response, nextFunction);
    });
  });
});