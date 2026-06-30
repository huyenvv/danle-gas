module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  transform: { '^.+\\.ts$': ['@swc/jest'] },
}
