import { http, HttpResponse } from 'msw';
import { mockUser, mockPrompt, mockConnection } from '../test-utils';

const API_BASE = 'http://localhost:8000/api';

export const handlers = [
  // Auth endpoints
  http.post(`${API_BASE}/auth/login`, () => {
    return HttpResponse.json({
      user: mockUser,
      token: 'mock-jwt-token',
    });
  }),

  rest.get(`${API_BASE}/auth/me`, (req, res, ctx) => {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res(ctx.status(401), ctx.json({ error: 'Unauthorized' }));
    }
    return res(ctx.json(mockUser));
  }),

  rest.post(`${API_BASE}/auth/logout`, (req, res, ctx) => {
    return res(ctx.status(200));
  }),

  // Prompts endpoints
  rest.get(`${API_BASE}/prompts`, (req, res, ctx) => {
    const page = req.url.searchParams.get('page') || '1';
    const limit = req.url.searchParams.get('limit') || '10';
    
    return res(
      ctx.json({
        prompts: [mockPrompt],
        total: 1,
        page: parseInt(page),
        limit: parseInt(limit),
      })
    );
  }),

  rest.get(`${API_BASE}/prompts/:id`, (req, res, ctx) => {
    const { id } = req.params;
    if (id === '1') {
      return res(ctx.json(mockPrompt));
    }
    return res(ctx.status(404), ctx.json({ error: 'Prompt not found' }));
  }),

  rest.post(`${API_BASE}/prompts`, (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ ...mockPrompt, id: '2' }));
  }),

  rest.put(`${API_BASE}/prompts/:id`, (req, res, ctx) => {
    return res(ctx.json(mockPrompt));
  }),

  rest.delete(`${API_BASE}/prompts/:id`, (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  rest.post(`${API_BASE}/prompts/:id/enhance`, (req, res, ctx) => {
    return res(
      ctx.json({
        enhanced: true,
        result: {
          ...mockPrompt,
          humanPrompt: {
            ...mockPrompt.humanPrompt,
            goal: 'Enhanced goal',
          },
        },
        rationale: 'Enhanced for better clarity',
        confidence: 0.9,
      })
    );
  }),

  rest.post(`${API_BASE}/prompts/:id/render/:provider`, (req, res, ctx) => {
    const { provider } = req.params;
    return res(
      ctx.json({
        provider,
        rendered: `Rendered prompt for ${provider}`,
        variables: {},
      })
    );
  }),

  rest.post(`${API_BASE}/prompts/:id/rate`, (req, res, ctx) => {
    return res(ctx.status(201));
  }),

  // Connections endpoints
  rest.get(`${API_BASE}/connections`, (req, res, ctx) => {
    return res(ctx.json([mockConnection]));
  }),

  rest.post(`${API_BASE}/connections`, (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ ...mockConnection, id: '2' }));
  }),

  rest.put(`${API_BASE}/connections/:id`, (req, res, ctx) => {
    return res(ctx.json(mockConnection));
  }),

  rest.delete(`${API_BASE}/connections/:id`, (req, res, ctx) => {
    return res(ctx.status(204));
  }),

  rest.post(`${API_BASE}/connections/:id/test`, (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        latency: 150,
        availableModels: ['gpt-3.5-turbo', 'gpt-4'],
        testedAt: new Date().toISOString(),
      })
    );
  }),

  // System endpoints
  rest.get(`${API_BASE}/system/status`, (req, res, ctx) => {
    return res(
      ctx.json({
        status: 'healthy',
        services: {
          api: { status: 'up', responseTime: 50 },
          database: { status: 'up', responseTime: 25 },
          storage: { status: 'up', responseTime: 10 },
          llm: { status: 'up', responseTime: 200 },
        },
        uptime: 86400,
        version: '1.0.0',
      })
    );
  }),

  rest.get(`${API_BASE}/system/stats`, (req, res, ctx) => {
    return res(
      ctx.json({
        totalPrompts: 150,
        totalUsers: 25,
        totalConnections: 5,
        averageRating: 4.2,
        storageUsed: '2.5GB',
        requestsToday: 1250,
      })
    );
  }),

  // Admin endpoints
  rest.get(`${API_BASE}/admin/users`, (req, res, ctx) => {
    return res(ctx.json([mockUser]));
  }),

  rest.post(`${API_BASE}/admin/users`, (req, res, ctx) => {
    return res(ctx.status(201), ctx.json({ ...mockUser, id: '2' }));
  }),

  // Error simulation endpoints
  rest.get(`${API_BASE}/test/error`, (req, res, ctx) => {
    return res(ctx.status(500), ctx.json({ error: 'Internal server error' }));
  }),

  rest.get(`${API_BASE}/test/slow`, (req, res, ctx) => {
    return res(ctx.delay(2000), ctx.json({ message: 'Slow response' }));
  }),
];