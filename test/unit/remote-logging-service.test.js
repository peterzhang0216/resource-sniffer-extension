/**
 * @file remote-logging-service.test.js
 * @description 远程日志服务单元测试
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

global.fetch = jest.fn();

const mockStorage = {
  get: jest.fn(),
  set: jest.fn()
};

global.chrome.storage.local = mockStorage;

const RemoteLoggingService = require('../../src/services/remote-logging-service');

describe('RemoteLoggingService', () => {
  let remoteLoggingService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    global.fetch.mockReset();
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
    
    mockStorage.get.mockImplementation((key, callback) => {
      callback({
        'remote_logging_enabled': true,
        'remote_logging_endpoint': 'https://example.com/logs',
        'remote_logging_batch_size': 10,
        'remote_logging_level': 'warning'
      });
    });
    
    remoteLoggingService = new RemoteLoggingService();
  });
  
  test('应该正确初始化远程日志服务', async () => {
    await remoteLoggingService.init();
    
    expect(mockStorage.get).toHaveBeenCalled();
    expect(remoteLoggingService.isEnabled).toBe(true);
    expect(remoteLoggingService.endpoint).toBe('https://example.com/logs');
    expect(remoteLoggingService.batchSize).toBe(10);
    expect(remoteLoggingService.minLevel).toBe('warning');
  });
  
  test('应该根据日志级别过滤日志', async () => {
    await remoteLoggingService.init();
    
    const debugLog = { level: 'debug', message: 'Debug message' };
    const infoLog = { level: 'info', message: 'Info message' };
    const warningLog = { level: 'warning', message: 'Warning message' };
    const errorLog = { level: 'error', message: 'Error message' };
    
    expect(remoteLoggingService._shouldSendLog(debugLog)).toBe(false);
    expect(remoteLoggingService._shouldSendLog(infoLog)).toBe(false);
    expect(remoteLoggingService._shouldSendLog(warningLog)).toBe(true);
    expect(remoteLoggingService._shouldSendLog(errorLog)).toBe(true);
  });
  
  test('应该正确发送日志批次', async () => {
    await remoteLoggingService.init();
    
    const testLogs = [
      { level: 'warning', message: 'Warning 1', timestamp: Date.now() },
      { level: 'error', message: 'Error 1', timestamp: Date.now() }
    ];
    
    await remoteLoggingService._sendLogBatch(testLogs);
    
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/logs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: expect.any(String)
      })
    );
    
    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.logs).toEqual(testLogs);
    expect(requestBody.extension).toBe('Resource Sniffer');
    expect(requestBody.version).toBeDefined();
  });
  
  test('应该在禁用时不发送日志', async () => {
    mockStorage.get.mockImplementation((key, callback) => {
      callback({
        'remote_logging_enabled': false
      });
    });
    
    await remoteLoggingService.init();
    
    const testLog = { level: 'error', message: 'Test error', timestamp: Date.now() };
    await remoteLoggingService.sendLog(testLog);
    
    expect(global.fetch).not.toHaveBeenCalled();
  });
  
  test('应该在达到批次大小时自动发送日志', async () => {
    await remoteLoggingService.init();
    
    remoteLoggingService.batchSize = 2;
    
    await remoteLoggingService.sendLog({ level: 'error', message: 'Error 1', timestamp: Date.now() });
    await remoteLoggingService.sendLog({ level: 'error', message: 'Error 2', timestamp: Date.now() });
    
    expect(global.fetch).toHaveBeenCalledTimes(1);
    
    expect(remoteLoggingService.logQueue.length).toBe(0);
  });
  
  test('应该处理网络错误并重试', async () => {
    await remoteLoggingService.init();
    
    global.fetch.mockRejectedValueOnce(new Error('Network error'));
    
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true })
    });
    
    const testLogs = [
      { level: 'error', message: 'Test error', timestamp: Date.now() }
    ];
    
    await remoteLoggingService._sendLogBatch(testLogs);
    
    expect(global.fetch).toHaveBeenCalledTimes(2);
    
    const firstRequestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    const secondRequestBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(firstRequestBody).toEqual(secondRequestBody);
  });
  
  test('应该正确更新配置', async () => {
    await remoteLoggingService.init();
    
    const newConfig = {
      enabled: false,
      endpoint: 'https://new-endpoint.com/logs',
      batchSize: 20,
      minLevel: 'error'
    };
    
    await remoteLoggingService.updateConfig(newConfig);
    
    expect(mockStorage.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'remote_logging_enabled': false,
        'remote_logging_endpoint': 'https://new-endpoint.com/logs',
        'remote_logging_batch_size': 20,
        'remote_logging_level': 'error'
      }),
      expect.any(Function)
    );
    
    expect(remoteLoggingService.isEnabled).toBe(false);
    expect(remoteLoggingService.endpoint).toBe('https://new-endpoint.com/logs');
    expect(remoteLoggingService.batchSize).toBe(20);
    expect(remoteLoggingService.minLevel).toBe('error');
  });
});
