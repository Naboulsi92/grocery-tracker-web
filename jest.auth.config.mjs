import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

export default createJestConfig({
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/private-route.test.ts'],
});
