/**
 * @file jest.config.js
 * @description Jest配置文件，用于运行单元测试
 */

module.exports = {
  testEnvironment: 'jsdom',
  
  testMatch: [
    '**/test/unit/**/*.test.js'
  ],
  
  collectCoverage: true,
  collectCoverageFrom: [
    'src/services/*.js',
    'src/components/*.js'
  ],
  coverageDirectory: 'coverage',
  
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  testTimeout: 10000,
  
  setupFilesAfterEnv: [
    '<rootDir>/test/unit/setup.js'
  ],
  
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  transformIgnorePatterns: [
    '/node_modules/'
  ]
};
