/**
 * @file setup.js
 * @description Jest测试环境设置文件
 */

global.chrome = {
  runtime: {
    getManifest: jest.fn().mockReturnValue({
      version: '1.0.0',
      name: 'Resource Sniffer'
    }),
    id: 'test-extension-id',
    onMessage: {
      addListener: jest.fn()
    },
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  downloads: {
    onCreated: { addListener: jest.fn() },
    onChanged: { addListener: jest.fn() },
    onErased: { addListener: jest.fn() },
    search: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    onActivated: { addListener: jest.fn() }
  }
};

global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();

global.Blob = function(content, options) {
  return {
    content,
    options
  };
};

expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false
      };
    }
  }
});
