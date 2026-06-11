/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.tsx', '**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@distributed-job-platform/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@distributed-job-platform/shared-utils$': '<rootDir>/../../packages/shared-utils/src/index.ts',
  },
  setupFilesAfterFramework: [],
};

module.exports = config;
