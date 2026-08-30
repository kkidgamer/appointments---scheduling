module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/*.test.js',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/seed.js',
    '!src/test-concurrency.js',
  ],
  coverageDirectory: 'coverage',
  verbose: true,
};
