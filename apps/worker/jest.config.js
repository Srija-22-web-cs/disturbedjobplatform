/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@distributed-job-platform/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@distributed-job-platform/shared-utils$': '<rootDir>/../../packages/shared-utils/src/index.ts',
  },
};

module.exports = config;
