/**
 * @file logging-service.test.js
 * @description 日志服务单元测试
 */

const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

global.chrome = mockChrome;

jest.mock('../../src/services/logging-service', () => {
  const original = jest.requireActual('../../src/services/logging-service');
  return {
    ...original,
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3
    },
    LogCategory: {
      APP: 'app',
      RESOURCE: 'resource',
      DOWNLOAD: 'download',
      UI: 'ui',
      NETWORK: 'network',
      DETECTION: 'detection'
    }
  };
});

const loggingService = require('../../src/services/logging-service');

describe('LoggingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockChrome.storage.local.get.mockImplementation((key, callback) => {
      callback({
        loggingEnabled: true,
        logLevel: 0, // DEBUG
        maxLogEntries: 1000
      });
    });
  });

  test('应该正确记录不同级别的日志', () => {
    const logSpy = jest.spyOn(loggingService, '_storeLog');
    
    loggingService.debug('APP', '调试信息', { data: 'test' });
    loggingService.info('RESOURCE', '信息消息', { count: 5 });
    loggingService.warn('DOWNLOAD', '警告消息', { file: 'image.jpg' });
    loggingService.error('NETWORK', '错误消息', { status: 404 });
    
    expect(logSpy).toHaveBeenCalledTimes(4);
    
    expect(logSpy).toHaveBeenNthCalledWith(1, expect.objectContaining({
      level: 0, // DEBUG
      category: 'APP',
      message: '调试信息',
      data: { data: 'test' }
    }));
    
    expect(logSpy).toHaveBeenNthCalledWith(4, expect.objectContaining({
      level: 3, // ERROR
      category: 'NETWORK',
      message: '错误消息',
      data: { status: 404 }
    }));
  });

  test('应该根据设置的日志级别过滤日志', () => {
    loggingService.setLogLevel(1);
    
    const logSpy = jest.spyOn(loggingService, '_storeLog');
    
    loggingService.debug('APP', '调试信息'); // 不应记录
    loggingService.info('RESOURCE', '信息消息'); // 应记录
    loggingService.warn('DOWNLOAD', '警告消息'); // 应记录
    loggingService.error('NETWORK', '错误消息'); // 应记录
    
    expect(logSpy).toHaveBeenCalledTimes(3);
    
    expect(logSpy).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 0,
      message: '调试信息'
    }));
  });

  test('应该能够导出日志为JSON格式', async () => {
    loggingService.logs = [
      { timestamp: 1617235200000, level: 1, category: 'APP', message: '测试日志1' },
      { timestamp: 1617235300000, level: 2, category: 'RESOURCE', message: '测试日志2' }
    ];
    
    const exportedLogs = await loggingService.exportLogs();
    
    expect(exportedLogs).toBeDefined();
    expect(typeof exportedLogs).toBe('string');
    
    const parsedLogs = JSON.parse(exportedLogs);
    
    expect(parsedLogs).toHaveLength(2);
    expect(parsedLogs[0].message).toBe('测试日志1');
    expect(parsedLogs[1].category).toBe('RESOURCE');
  });
});
