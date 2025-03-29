/**
 * @file download-logger.test.js
 * @description 下载日志记录器单元测试
 */

const mockChrome = {
  downloads: {
    onCreated: { addListener: jest.fn() },
    onChanged: { addListener: jest.fn() },
    onErased: { addListener: jest.fn() },
    search: jest.fn()
  }
};

global.chrome = mockChrome;

const mockLoggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  LogCategory: {
    DOWNLOAD: 'DOWNLOAD',
    APP: 'APP'
  }
};

jest.mock('../../src/services/logging-service', () => mockLoggingService);

const downloadLogger = require('../../src/services/download-logger').default;

describe('DownloadLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1617235200000);
    downloadLogger.activeDownloads = {};
    downloadLogger.downloadHistory = [];
  });

  test('应该正确记录下载开始事件', () => {
    const downloadItem = {
      id: 123,
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 1024,
      mime: 'image/jpeg',
      startTime: new Date().toISOString()
    };
    
    downloadLogger.logDownloadStarted(downloadItem);
    
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      mockLoggingService.LogCategory.DOWNLOAD,
      '下载已开始',
      expect.objectContaining({
        downloadId: 123,
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        fileSize: 1024,
        mime: 'image/jpeg',
        timestamp: 1617235200000
      })
    );
    
    expect(downloadLogger.activeDownloads[123]).toBeDefined();
    expect(downloadLogger.activeDownloads[123].status).toBe('in_progress');
    expect(downloadLogger.activeDownloads[123].startTime).toBe(1617235200000);
  });

  test('应该正确记录下载进度更新', () => {
    downloadLogger.activeDownloads[123] = {
      id: 123,
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 1024,
      status: 'in_progress',
      startTime: 1617235200000 - 5000, // 5秒前
      progress: 0
    };
    
    downloadLogger.logDownloadProgress(123, 512); // 50%进度
    
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      mockLoggingService.LogCategory.DOWNLOAD,
      '下载进度更新',
      expect.objectContaining({
        downloadId: 123,
        bytesReceived: 512,
        progress: 50, // 百分比
        timestamp: 1617235200000
      })
    );
    
    expect(downloadLogger.activeDownloads[123].progress).toBe(50);
    expect(downloadLogger.activeDownloads[123].bytesReceived).toBe(512);
  });

  test('应该正确记录下载完成事件', () => {
    downloadLogger.activeDownloads[123] = {
      id: 123,
      url: 'https://example.com/image.jpg',
      filename: 'image.jpg',
      fileSize: 1024,
      status: 'in_progress',
      startTime: 1617235200000 - 10000, // 10秒前
      progress: 100,
      bytesReceived: 1024
    };
    
    downloadLogger.logDownloadCompleted(123, '/downloads/image.jpg');
    
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      mockLoggingService.LogCategory.DOWNLOAD,
      '下载已完成',
      expect.objectContaining({
        downloadId: 123,
        filePath: '/downloads/image.jpg',
        duration: 10000, // 10秒
        timestamp: 1617235200000
      })
    );
    
    expect(downloadLogger.activeDownloads[123]).toBeUndefined();
    
    expect(downloadLogger.downloadHistory).toHaveLength(1);
    expect(downloadLogger.downloadHistory[0]).toEqual(
      expect.objectContaining({
        id: 123,
        url: 'https://example.com/image.jpg',
        filename: 'image.jpg',
        status: 'complete',
        completedTime: 1617235200000,
        duration: 10000
      })
    );
  });
});
