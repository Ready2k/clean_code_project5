import { beforeAll } from 'vitest';

beforeAll(() => {
  // Set test environment variables
  process.env['NODE_ENV'] = 'test';
  process.env['JWT_SECRET'] = 'test-jwt-secret-key-for-testing-only';
  process.env['LOG_LEVEL'] = 'error'; // Reduce log noise in tests
});