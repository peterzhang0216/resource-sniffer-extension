/**
 * @file mock-modules.js
 * @description 模拟ES模块的实现，用于单元测试
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

class IndexedDBService {
  constructor(dbName, version) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.ready = Promise.resolve();
  }

  _initDatabase() {
    return Promise.resolve();
  }

  saveData(storeName, data) {
    return Promise.resolve(true);
  }

  getData(storeName, id) {
    return Promise.resolve({ id: '1', data: 'test' });
  }

  deleteData(storeName, id) {
    return Promise.resolve(true);
  }
}

const CompressionUtils = {
  compress: (data) => Promise.resolve('compressed-data'),
  decompress: (data) => Promise.resolve('{"id":"1","data":"test"}'),
  isCompressionSupported: () => true,
  compressLZString: (data) => 'compressed-lz-data',
  decompressLZString: (data) => 'decompressed-lz-data',
  estimateCompressionRatio: (original, compressed) => 75
};

class RemoteLoggingService {
  constructor() {
    this.isEnabled = true;
    this.endpoint = 'https://example.com/logs';
    this.batchSize = 10;
    this.minLevel = 'warning';
    this.logQueue = [];
  }

  init() {
    return Promise.resolve();
  }

  sendLog(log) {
    return Promise.resolve();
  }

  _sendLogBatch(logs) {
    return Promise.resolve();
  }

  _shouldSendLog(log) {
    return log.level === 'warning' || log.level === 'error';
  }

  updateConfig(config) {
    return Promise.resolve();
  }
}

class LogAnalyzerService {
  analyzeLevelDistribution(logs) {
    return {
      info: 2,
      warning: 2,
      error: 2
    };
  }

  analyzeCategoryDistribution(logs) {
    return {
      resource: 2,
      download: 2,
      network: 2
    };
  }

  analyzeTimeTrend(logs, timeInterval) {
    return [
      { startTime: Date.now() - 3600000, endTime: Date.now() - 1800000, count: 3 },
      { startTime: Date.now() - 1800000, endTime: Date.now(), count: 3 }
    ];
  }

  detectAnomalies(logs) {
    return [
      {
        type: 'frequency_anomaly',
        description: 'Unusual number of network error logs',
        severity: 0.8,
        affectedLogs: logs.filter(log => log.category === 'network' && log.level === 'error')
      }
    ];
  }

  generatePerformanceReport(logs) {
    return {
      metrics: {
        resourceDetectionTime: { avg: 176.67, min: 150, max: 200 },
        memoryUsage: { avg: 55, min: 50, max: 60 }
      },
      trends: {
        resourceDetectionTime: [150, 180, 200],
        memoryUsage: [50, 55, 60]
      },
      recommendations: [
        'Consider optimizing resource detection algorithm',
        'Monitor memory usage growth'
      ]
    };
  }

  compareLogPeriods(period1Logs, period2Logs) {
    return {
      levelChanges: {
        info: 0,
        warning: 0,
        error: 0
      },
      categoryChanges: {
        resource: 0,
        download: 0,
        network: 0
      },
      messagePatternChanges: [],
      significantChanges: []
    };
  }
}

class LogVisualization {
  constructor(container) {
    this.container = container;
    this.charts = {};
    this.currentMode = 'trend';
  }

  createTrendChart(logs) {
    this.charts.trend = { destroy: jest.fn() };
    return this.charts.trend;
  }

  createDistributionChart(logs, property) {
    this.charts.distribution = { destroy: jest.fn() };
    return this.charts.distribution;
  }

  createCategoryChart(logs) {
    this.charts.category = { destroy: jest.fn() };
    return this.charts.category;
  }

  switchMode(mode, logs) {
    if (this.charts[this.currentMode]) {
      this.charts[this.currentMode].destroy();
    }
    this.currentMode = mode;
    return this.charts[mode];
  }

  updateChart(logs) {
    if (this.charts[this.currentMode]) {
      this.charts[this.currentMode].destroy();
    }
    return this.createTrendChart(logs);
  }

  exportChart() {
    return 'data:image/png;base64,test';
  }
}

class SearchHistory {
  constructor(callback) {
    this.callback = callback;
    this.history = [];
    this.maxHistorySize = 10;
  }

  init() {
    this.history = [
      { term: 'error', timestamp: Date.now() - 3600000, count: 5 },
      { term: 'warning', timestamp: Date.now() - 7200000, count: 3 },
      { term: 'resource', timestamp: Date.now() - 10800000, count: 2 }
    ];
    return Promise.resolve();
  }

  addTerm(term) {
    const existingItem = this.history.find(item => item.term === term);
    if (existingItem) {
      existingItem.count += 1;
      existingItem.timestamp = Date.now();
    } else {
      this.history.push({
        term,
        timestamp: Date.now(),
        count: 1
      });
    }
    
    if (this.history.length > this.maxHistorySize) {
      this.history.sort((a, b) => a.timestamp - b.timestamp);
      this.history.shift();
    }
    
    this.callback();
    return Promise.resolve();
  }

  removeTerm(term) {
    this.history = this.history.filter(item => item.term !== term);
    this.callback();
    return Promise.resolve();
  }

  clearHistory() {
    this.history = [];
    this.callback();
    return Promise.resolve();
  }

  getSortedHistory(sortBy) {
    if (sortBy === 'frequency') {
      return [...this.history].sort((a, b) => b.count - a.count);
    } else {
      return [...this.history].sort((a, b) => b.timestamp - a.timestamp);
    }
  }
}

module.exports = {
  IndexedDBService,
  compress: CompressionUtils.compress,
  decompress: CompressionUtils.decompress,
  isCompressionSupported: CompressionUtils.isCompressionSupported,
  compressLZString: CompressionUtils.compressLZString,
  decompressLZString: CompressionUtils.decompressLZString,
  estimateCompressionRatio: CompressionUtils.estimateCompressionRatio,
  RemoteLoggingService,
  LogAnalyzerService,
  LogVisualization,
  SearchHistory
};
