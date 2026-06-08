module.exports = {
  rootDir: '.',
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/server/__tests__/**/*.test.js'],
    },
  ],
}
