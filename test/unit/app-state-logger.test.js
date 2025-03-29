/**
 * @file app-state-logger.test.js
 * @description 应用状态日志记录器单元测试
 */

const mockChrome = {
  runtime: {
    getManifest: jest.fn().mockReturnValue({
      version: '1.0.0',
      name: 'Resource Sniffer'
    }),
    id: 'test-extension-id'
  }
};

global.chrome = mockChrome;
global.navigator = {
  userAgent: 'Mozilla/5.0 Test',
  platform: 'Test Platform'
};

const mockLoggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  LogCategory: {
    APP: 'APP',
    DETECTION: 'DETECTION',
    RESOURCE: 'RESOURCE',
    UI: 'UI',
    NETWORK: 'NETWORK'
  }
};

jest.mock('../../src/services/logging-service', () => mockLoggingService);

const appStateLogger = require('../../src/services/app-state-logger').default;

describe('AppStateLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1617235200000);
  });

  test('应该正确记录扩展启动信息', () => {
    appStateLogger.logExtensionStartup();
    
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      mockLoggingService.LogCategory.APP,
      '扩展已启动',
      expect.objectContaining({
        version: '1.0.0',
        name: 'Resource Sniffer',
        id: 'test-extension-id',
        userAgent: 'Mozilla/5.0 Test',
        platform: 'Test Platform',
        timestamp: 1617235200000
      })
    );
  });

  test('应该正确记录资源检测开始和完成', () => {
    const detectionId = appStateLogger.logDetectionStarted(123, { deepScan: true });
    
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      mockLoggingService.LogCategory.DETECTION,
      '资源检测开始',
      expect.objectContaining({
        detectionId,
        tabId: 123,
        options: { deepScan: true },
        startTime: 1617235200000
      })
    );
    
    appStateLogger.logDetectionCompleted(detectionId, 10, { 
      startTime: 1617235200000 - 1000, // 1秒前
      imageCount: 5,
      videoCount: 5
    });
    
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      mockLoggingService.LogCategory.DETECTION,
      '资源检测完成',
      expect.objectContaining({
        detectionId,
        resourceCount: 10,
        stats: expect.objectContaining({
          imageCount: 5,
          videoCount: 5
        }),
        duration: expect.any(Number)
      })
    );
    
    expect(appStateLogger.performanceMetrics.resourceDetectionTime).toHaveLength(1);
    expect(appStateLogger.performanceMetrics.resourceDetectionTime[0]).toEqual(
      expect.objectContaining({
        detectionId,
        resourceCount: 10,
        timestamp: 1617235200000
      })
    );
  });

  test('应该正确生成性能指标摘要', () => {
    appStateLogger.performanceMetrics = {
      resourceDetectionTime: [
        { duration: 100, resourceCount: 5 },
        { duration: 200, resourceCount: 10 }
      ],
      downloadTime: [
        { duration: 1000, size: 1024 },
        { duration: 2000, size: 2048 }
      ],
      renderTime: [
        { duration: 50, componentName: 'ResourceList' },
        { duration: 30, componentName: 'FilterBar' }
      ]
    };
    
    const summary = appStateLogger.getPerformanceMetricsSummary();
    
    expect(summary).toEqual({
      averageDetectionTime: 150, // (100 + 200) / 2
      averageDownloadTime: 1500, // (1000 + 2000) / 2
      averageRenderTime: 40, // (50 + 30) / 2
      detectionSamples: 2,
      downloadSamples: 2,
      renderSamples: 2,
      uptime: expect.any(Number)
    });
    
    appStateLogger.logPerformanceMetricsSummary();
    
    expect(mockLoggingService.info).toHaveBeenCalledWith(
      mockLoggingService.LogCategory.APP,
      '性能指标摘要',
      expect.objectContaining({
        averageDetectionTime: 150,
        averageDownloadTime: 1500,
        averageRenderTime: 40,
        timestamp: 1617235200000
      })
    );
  });
});
