/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  // Integration tests (*.integration.spec.ts) need a real Postgres and run
  // separately via `npm run test:integration` / jest.integration.config.js —
  // excluded here so plain `npm test` stays fast and dependency-free.
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.spec\\.ts$'],
  clearMocks: true,
};
