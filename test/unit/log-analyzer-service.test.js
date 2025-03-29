/**
 * @file log-analyzer-service.test.js
 * @description 日志分析服务单元测试
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

const LogAnalyzerService = require('../../src/services/log-analyzer-service');

describe('LogAnalyzerService', () => {
  let logAnalyzerService;
  let testLogs;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    logAnalyzerService = new LogAnalyzerService();
    
    testLogs = [
      { id: '1', timestamp: Date.now() - 3600000, level: 'info', category: 'resource', message: 'Resource detected', data: { url: 'https://example.com/image1.jpg', type: 'image' } },
      { id: '2', timestamp: Date.now() - 3000000, level: 'warning', category: 'download', message: 'Slow download', data: { url: 'https://example.com/image2.jpg', speed: 50 } },
      { id: '3', timestamp: Date.now() - 2400000, level: 'error', category: 'network', message: 'Network error', data: { url: 'https://example.com/video.mp4', error: 'timeout' } },
      { id: '4', timestamp: Date.now() - 1800000, level: 'info', category: 'resource', message: 'Resource detected', data: { url: 'https://example.com/image3.jpg', type: 'image' } },
      { id: '5', timestamp: Date.now() - 1200000, level: 'warning', category: 'download', message: 'Slow download', data: { url: 'https://example.com/image4.jpg', speed: 30 } },
      { id: '6', timestamp: Date.now() - 600000, level: 'error', category: 'network', message: 'Network error', data: { url: 'https://example.com/audio.mp3', error: 'timeout' } }
    ];
  });
  
  test('应该正确分析日志级别分布', () => {
    const levelDistribution = logAnalyzerService.analyzeLevelDistribution(testLogs);
    
    expect(levelDistribution).toEqual({
      info: 2,
      warning: 2,
      error: 2
    });
    
    expect(levelDistribution.info).toBe(2);
    expect(levelDistribution.warning).toBe(2);
    expect(levelDistribution.error).toBe(2);
  });
  
  test('应该正确分析日志类别分布', () => {
    const categoryDistribution = logAnalyzerService.analyzeCategoryDistribution(testLogs);
    
    expect(categoryDistribution).toEqual({
      resource: 2,
      download: 2,
      network: 2
    });
    
    expect(categoryDistribution.resource).toBe(2);
    expect(categoryDistribution.download).toBe(2);
    expect(categoryDistribution.network).toBe(2);
  });
  
  test('应该正确分析时间趋势', () => {
    const timeInterval = 1800000; // 30分钟
    const timeTrend = logAnalyzerService.analyzeTimeTrend(testLogs, timeInterval);
    
    expect(Array.isArray(timeTrend)).toBe(true);
    expect(timeTrend.length).toBeGreaterThan(0);
    
    timeTrend.forEach(interval => {
      expect(interval).toHaveProperty('startTime');
      expect(interval).toHaveProperty('endTime');
      expect(interval).toHaveProperty('count');
      expect(typeof interval.count).toBe('number');
    });
    
    const totalCount = timeTrend.reduce((sum, interval) => sum + interval.count, 0);
    expect(totalCount).toBe(testLogs.length);
  });
  
  test('应该正确检测异常模式', () => {
    const logsWithAnomaly = [
      ...testLogs,
      { id: '7', timestamp: Date.now() - 500000, level: 'error', category: 'network', message: 'Network error', data: { url: 'https://example.com/video2.mp4', error: 'timeout' } },
      { id: '8', timestamp: Date.now() - 400000, level: 'error', category: 'network', message: 'Network error', data: { url: 'https://example.com/video3.mp4', error: 'timeout' } },
      { id: '9', timestamp: Date.now() - 300000, level: 'error', category: 'network', message: 'Network error', data: { url: 'https://example.com/video4.mp4', error: 'timeout' } }
    ];
    
    const anomalies = logAnalyzerService.detectAnomalies(logsWithAnomaly);
    
    expect(Array.isArray(anomalies)).toBe(true);
    expect(anomalies.length).toBeGreaterThan(0);
    
    anomalies.forEach(anomaly => {
      expect(anomaly).toHaveProperty('type');
      expect(anomaly).toHaveProperty('description');
      expect(anomaly).toHaveProperty('severity');
      expect(anomaly).toHaveProperty('affectedLogs');
      expect(Array.isArray(anomaly.affectedLogs)).toBe(true);
    });
    
    const networkErrorAnomaly = anomalies.find(a => 
      a.type === 'frequency_anomaly' && 
      a.description.includes('network') && 
      a.description.includes('error')
    );
    
    expect(networkErrorAnomaly).toBeDefined();
    expect(networkErrorAnomaly.severity).toBeGreaterThanOrEqual(0.5);
    expect(networkErrorAnomaly.affectedLogs.length).toBeGreaterThanOrEqual(3);
  });
  
  test('应该正确生成性能报告', () => {
    const performanceLogs = [
      { id: '1', timestamp: Date.now() - 3600000, level: 'info', category: 'performance', message: 'Performance data', data: { resourceDetectionTime: 150, memoryUsage: 50 } },
      { id: '2', timestamp: Date.now() - 2400000, level: 'info', category: 'performance', message: 'Performance data', data: { resourceDetectionTime: 180, memoryUsage: 55 } },
      { id: '3', timestamp: Date.now() - 1200000, level: 'info', category: 'performance', message: 'Performance data', data: { resourceDetectionTime: 200, memoryUsage: 60 } }
    ];
    
    const performanceReport = logAnalyzerService.generatePerformanceReport(performanceLogs);
    
    expect(performanceReport).toHaveProperty('metrics');
    expect(performanceReport).toHaveProperty('trends');
    expect(performanceReport).toHaveProperty('recommendations');
    
    expect(performanceReport.metrics).toHaveProperty('resourceDetectionTime');
    expect(performanceReport.metrics).toHaveProperty('memoryUsage');
    
    expect(performanceReport.metrics.resourceDetectionTime.avg).toBeGreaterThan(0);
    expect(performanceReport.metrics.resourceDetectionTime.min).toBeLessThanOrEqual(performanceReport.metrics.resourceDetectionTime.avg);
    expect(performanceReport.metrics.resourceDetectionTime.max).toBeGreaterThanOrEqual(performanceReport.metrics.resourceDetectionTime.avg);
    
    expect(Array.isArray(performanceReport.trends.resourceDetectionTime)).toBe(true);
    expect(Array.isArray(performanceReport.trends.memoryUsage)).toBe(true);
    
    expect(Array.isArray(performanceReport.recommendations)).toBe(true);
  });
  
  test('应该正确比较两个时间段的日志', () => {
    const period1Logs = testLogs.slice(0, 3); // 前3条
    const period2Logs = testLogs.slice(3);    // 后3条
    
    const comparison = logAnalyzerService.compareLogPeriods(period1Logs, period2Logs);
    
    expect(comparison).toHaveProperty('levelChanges');
    expect(comparison).toHaveProperty('categoryChanges');
    expect(comparison).toHaveProperty('messagePatternChanges');
    expect(comparison).toHaveProperty('significantChanges');
    
    expect(comparison.levelChanges).toHaveProperty('info');
    expect(comparison.levelChanges).toHaveProperty('warning');
    expect(comparison.levelChanges).toHaveProperty('error');
    
    expect(comparison.categoryChanges).toHaveProperty('resource');
    expect(comparison.categoryChanges).toHaveProperty('download');
    expect(comparison.categoryChanges).toHaveProperty('network');
    
    expect(Array.isArray(comparison.significantChanges)).toBe(true);
  });
});
