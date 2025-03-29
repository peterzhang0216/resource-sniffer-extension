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
    '^@/(.*)$': '<rootDir>/src/$1',
    '../../src/services/indexeddb-service': '<rootDir>/mock-modules.js',
    '../../src/utils/compression-utils': '<rootDir>/mock-modules.js',
    '../../src/services/remote-logging-service': '<rootDir>/mock-modules.js',
    '../../src/services/log-analyzer-service': '<rootDir>/mock-modules.js',
    '../../src/components/log-viewer': '<rootDir>/mock-modules.js',
    '../../src/components/log-tab': '<rootDir>/mock-modules.js',
    '../../src/libs/chart.min.js': '<rootDir>/mock-modules.js'
  },
  
  testTimeout: 10000,
  
  setupFilesAfterEnv: [
    '<rootDir>/setup.js'
  ],
  
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  transformIgnorePatterns: [
    '/node_modules/'
  ]
};
