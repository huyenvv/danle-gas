module.exports = {
  rootDir: '.',
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/server/__tests__/**/*.test.js'],
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/client/__tests__/**/*.test.{js,jsx}'],
      setupFilesAfterEach: ['<rootDir>/src/client/__tests__/setup.js'],
      transform: {
        '^.+\\.(js|jsx)$': 'babel-jest',
      },
      moduleFileExtensions: ['js', 'jsx'],
    },
  ],
}
