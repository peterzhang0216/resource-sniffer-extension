/**
 * @file log-analyzer-service.js
 * @description 日志分析服务，用于自动识别异常模式和提供统计报告
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from './logging-service.js';

/**
 * 日志分析服务
 * @class LogAnalyzerService
 */
class LogAnalyzerService {
  /**
   * 创建日志分析服务实例
   */
  constructor() {
    this.isEnabled = false;
    this.autoAnalysisInterval = null;
    this.patterns = [
      {
        name: '错误频率异常',
        description: '检测短时间内错误日志数量异常增加',
        check: this._checkErrorFrequency.bind(this)
      },
      {
        name: '性能退化',
        description: '检测性能指标持续下降',
        check: this._checkPerformanceDegradation.bind(this)
      },
      {
        name: '资源使用异常',
        description: '检测内存或CPU使用率异常',
        check: this._checkResourceUsageAnomaly.bind(this)
      },
      {
        name: '下载失败模式',
        description: '检测特定类型资源下载频繁失败',
        check: this._checkDownloadFailurePatterns.bind(this)
      },
      {
        name: '网络异常',
        description: '检测网络连接问题',
        check: this._checkNetworkIssues.bind(this)
      }
    ];
    
    this._loadSettings();
  }
  
  /**
   * 加载分析器设置
   * @private
   */
  async _loadSettings() {
    try {
      const storageService = (await import('./storage-service.js')).default;
      const settings = await storageService.get('log_analyzer_settings');
      
      if (settings) {
        this.isEnabled = settings.isEnabled !== undefined ? settings.isEnabled : false;
        
        if (this.isEnabled && settings.autoAnalysisInterval) {
          this.startAutoAnalysis(settings.autoAnalysisInterval);
        }
      }
    } catch (error) {
      console.error('加载日志分析器设置失败:', error);
    }
  }
  
  /**
   * 保存分析器设置
   * @private
   */
  async _saveSettings() {
    try {
      const storageService = (await import('./storage-service.js')).default;
      const settings = {
        isEnabled: this.isEnabled,
        autoAnalysisInterval: this.autoAnalysisInterval ? this._getIntervalMinutes() : null
      };
      
      await storageService.set('log_analyzer_settings', settings);
    } catch (error) {
      console.error('保存日志分析器设置失败:', error);
    }
  }
  
  /**
   * 获取自动分析间隔（分钟）
   * @returns {number} - 间隔分钟数
   * @private
   */
  _getIntervalMinutes() {
    if (!this.autoAnalysisInterval) return 0;
    return Math.floor(this.autoAnalysisInterval._idleTimeout / (60 * 1000));
  }
  
  /**
   * 启用分析器
   * @param {boolean} enabled - 是否启用
   */
  async setEnabled(enabled) {
    this.isEnabled = enabled;
    
    if (!enabled && this.autoAnalysisInterval) {
      this.stopAutoAnalysis();
    }
    
    await this._saveSettings();
    
    loggingService.info(LogCategory.ANALYSIS, `${enabled ? '启用' : '禁用'}日志分析服务`);
  }
  
  /**
   * 启动自动分析
   * @param {number} intervalMinutes - 分析间隔（分钟）
   */
  startAutoAnalysis(intervalMinutes) {
    this.stopAutoAnalysis();
    
    const intervalMs = intervalMinutes * 60 * 1000;
    this.autoAnalysisInterval = setInterval(async () => {
      if (this.isEnabled) {
        await this.analyzeAll();
      }
    }, intervalMs);
    
    loggingService.info(LogCategory.ANALYSIS, '启动自动日志分析', { intervalMinutes });
  }
  
  /**
   * 停止自动分析
   */
  stopAutoAnalysis() {
    if (this.autoAnalysisInterval) {
      clearInterval(this.autoAnalysisInterval);
      this.autoAnalysisInterval = null;
      
      loggingService.info(LogCategory.ANALYSIS, '停止自动日志分析');
    }
  }
  
  /**
   * 分析所有日志
   * @returns {Promise<Array>} - 分析结果
   */
  async analyzeAll() {
    if (!this.isEnabled) {
      return [];
    }
    
    loggingService.info(LogCategory.ANALYSIS, '开始分析日志');
    
    const results = [];
    
    try {
      const allLogs = await loggingService.getHistoryLogs();
      
      for (const pattern of this.patterns) {
        try {
          const patternResults = await pattern.check(allLogs);
          
          if (patternResults && patternResults.length > 0) {
            results.push({
              pattern: pattern.name,
              description: pattern.description,
              results: patternResults
            });
            
            loggingService.info(LogCategory.ANALYSIS, `检测到${pattern.name}`, {
              count: patternResults.length,
              details: patternResults
            });
          }
        } catch (error) {
          console.error(`执行模式检查失败 (${pattern.name}):`, error);
        }
      }
      
      if (results.length > 0) {
        loggingService.warn(LogCategory.ANALYSIS, '日志分析发现异常', { anomalies: results.length });
      } else {
        loggingService.debug(LogCategory.ANALYSIS, '日志分析未发现异常');
      }
    } catch (error) {
      console.error('分析日志失败:', error);
      loggingService.error(LogCategory.ANALYSIS, '分析日志失败', { error: error.message });
    }
    
    return results;
  }
  
  /**
   * 生成统计报告
   * @returns {Promise<Object>} - 统计报告
   */
  async generateReport() {
    try {
      const allLogs = await loggingService.getHistoryLogs();
      
      const stats = {
        total: allLogs.length,
        byLevel: {
          [LogLevel.DEBUG]: 0,
          [LogLevel.INFO]: 0,
          [LogLevel.WARNING]: 0,
          [LogLevel.ERROR]: 0
        },
        byCategory: {},
        timeDistribution: {
          lastHour: 0,
          last24Hours: 0,
          lastWeek: 0,
          older: 0
        },
        topErrors: [],
        trends: {
          errorRate: [],
          activityByHour: Array(24).fill(0)
        }
      };
      
      Object.values(LogCategory).forEach(category => {
        stats.byCategory[category] = 0;
      });
      
      const now = Date.now();
      const hourAgo = now - 60 * 60 * 1000;
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
      
      const errorMessages = {};
      
      const hourlyErrors = {};
      const hourlyLogs = {};
      
      allLogs.forEach(log => {
        stats.byLevel[log.level]++;
        
        if (stats.byCategory[log.category] !== undefined) {
          stats.byCategory[log.category]++;
        }
        
        if (log.timestamp >= hourAgo) {
          stats.timeDistribution.lastHour++;
        } else if (log.timestamp >= dayAgo) {
          stats.timeDistribution.last24Hours++;
        } else if (log.timestamp >= weekAgo) {
          stats.timeDistribution.lastWeek++;
        } else {
          stats.timeDistribution.older++;
        }
        
        if (log.level === LogLevel.ERROR) {
          const key = `${log.category}:${log.message}`;
          errorMessages[key] = (errorMessages[key] || 0) + 1;
        }
        
        const hour = new Date(log.timestamp).getHours();
        stats.trends.activityByHour[hour]++;
        
        const hourKey = Math.floor(log.timestamp / (60 * 60 * 1000));
        hourlyLogs[hourKey] = (hourlyLogs[hourKey] || 0) + 1;
        
        if (log.level === LogLevel.ERROR || log.level === LogLevel.WARNING) {
          hourlyErrors[hourKey] = (hourlyErrors[hourKey] || 0) + 1;
        }
      });
      
      stats.topErrors = Object.entries(errorMessages)
        .map(([key, count]) => {
          const [category, ...messageParts] = key.split(':');
          return {
            category,
            message: messageParts.join(':'),
            count
          };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      const hourKeys = Object.keys(hourlyLogs).sort();
      for (let i = 0; i < Math.min(24, hourKeys.length); i++) {
        const hourKey = hourKeys[hourKeys.length - 1 - i];
        const totalLogs = hourlyLogs[hourKey] || 0;
        const errorLogs = hourlyErrors[hourKey] || 0;
        const errorRate = totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
        
        stats.trends.errorRate.unshift({
          hour: new Date(hourKey * 60 * 60 * 1000).toISOString(),
          rate: errorRate.toFixed(2)
        });
      }
      
      return stats;
    } catch (error) {
      console.error('生成统计报告失败:', error);
      loggingService.error(LogCategory.ANALYSIS, '生成统计报告失败', { error: error.message });
      return null;
    }
  }
  
  /**
   * 检查错误频率异常
   * @param {Array} logs - 日志数组
   * @returns {Promise<Array>} - 异常结果
   * @private
   */
  async _checkErrorFrequency(logs) {
    const results = [];
    
    const hourlyErrors = {};
    
    logs.forEach(log => {
      if (log.level === LogLevel.ERROR) {
        const hourKey = Math.floor(log.timestamp / (60 * 60 * 1000));
        hourlyErrors[hourKey] = (hourlyErrors[hourKey] || 0) + 1;
      }
    });
    
    const errorCounts = Object.values(hourlyErrors);
    
    if (errorCounts.length >= 3) {
      const avg = errorCounts.reduce((sum, count) => sum + count, 0) / errorCounts.length;
      const variance = errorCounts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / errorCounts.length;
      const stdDev = Math.sqrt(variance);
      
      const threshold = avg + 2 * stdDev;
      
      Object.entries(hourlyErrors).forEach(([hourKey, count]) => {
        if (count > threshold) {
          results.push({
            timestamp: parseInt(hourKey) * 60 * 60 * 1000,
            count,
            threshold: threshold.toFixed(2),
            avgErrorRate: avg.toFixed(2)
          });
        }
      });
    }
    
    return results;
  }
  
  /**
   * 检查性能退化
   * @param {Array} logs - 日志数组
   * @returns {Promise<Array>} - 异常结果
   * @private
   */
  async _checkPerformanceDegradation(logs) {
    const results = [];
    
    const perfLogs = logs.filter(log => 
      log.category === LogCategory.APP && 
      log.data && 
      (log.data.performance || log.data.timing || log.data.duration)
    );
    
    const metricGroups = {};
    
    perfLogs.forEach(log => {
      let metricName = '';
      let metricValue = 0;
      
      if (log.data.performance) {
        metricName = Object.keys(log.data.performance)[0] || '';
        metricValue = log.data.performance[metricName];
      } else if (log.data.timing) {
        metricName = Object.keys(log.data.timing)[0] || '';
        metricValue = log.data.timing[metricName];
      } else if (log.data.duration) {
        metricName = log.message;
        metricValue = log.data.duration;
      }
      
      if (metricName && typeof metricValue === 'number') {
        if (!metricGroups[metricName]) {
          metricGroups[metricName] = [];
        }
        
        metricGroups[metricName].push({
          timestamp: log.timestamp,
          value: metricValue
        });
      }
    });
    
    Object.entries(metricGroups).forEach(([metricName, values]) => {
      if (values.length >= 5) {
        values.sort((a, b) => a.timestamp - b.timestamp);
        
        let isDegrading = true;
        
        for (let i = values.length - 5; i < values.length - 1; i++) {
          if (values[i].value > values[i + 1].value) {
            isDegrading = false;
            break;
          }
        }
        
        if (isDegrading) {
          const firstValue = values[values.length - 5].value;
          const lastValue = values[values.length - 1].value;
          const percentChange = ((lastValue - firstValue) / firstValue) * 100;
          
          if (percentChange > 20) {
            results.push({
              metric: metricName,
              firstValue,
              lastValue,
              percentChange: percentChange.toFixed(2),
              timestamps: values.slice(-5).map(v => v.timestamp)
            });
          }
        }
      }
    });
    
    return results;
  }
  
  /**
   * 检查资源使用异常
   * @param {Array} logs - 日志数组
   * @returns {Promise<Array>} - 异常结果
   * @private
   */
  async _checkResourceUsageAnomaly(logs) {
    const results = [];
    
    const resourceLogs = logs.filter(log => 
      log.category === LogCategory.APP && 
      log.data && 
      (log.data.memory || log.data.cpu || log.data.resources)
    );
    
    const memoryUsage = [];
    const cpuUsage = [];
    
    resourceLogs.forEach(log => {
      if (log.data.memory) {
        memoryUsage.push({
          timestamp: log.timestamp,
          value: log.data.memory
        });
      }
      
      if (log.data.cpu) {
        cpuUsage.push({
          timestamp: log.timestamp,
          value: log.data.cpu
        });
      }
      
      if (log.data.resources) {
        if (log.data.resources.memory) {
          memoryUsage.push({
            timestamp: log.timestamp,
            value: log.data.resources.memory
          });
        }
        
        if (log.data.resources.cpu) {
          cpuUsage.push({
            timestamp: log.timestamp,
            value: log.data.resources.cpu
          });
        }
      }
    });
    
    if (memoryUsage.length > 0) {
      memoryUsage.sort((a, b) => a.timestamp - b.timestamp);
      
      const values = memoryUsage.map(item => item.value);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      const threshold = avg + 2 * stdDev;
      
      memoryUsage.forEach(item => {
        if (item.value > threshold) {
          results.push({
            type: 'memory',
            timestamp: item.timestamp,
            value: item.value,
            threshold: threshold.toFixed(2),
            average: avg.toFixed(2)
          });
        }
      });
    }
    
    if (cpuUsage.length > 0) {
      cpuUsage.sort((a, b) => a.timestamp - b.timestamp);
      
      const values = cpuUsage.map(item => item.value);
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);
      
      const threshold = avg + 2 * stdDev;
      
      cpuUsage.forEach(item => {
        if (item.value > threshold) {
          results.push({
            type: 'cpu',
            timestamp: item.timestamp,
            value: item.value,
            threshold: threshold.toFixed(2),
            average: avg.toFixed(2)
          });
        }
      });
    }
    
    return results;
  }
  
  /**
   * 检查下载失败模式
   * @param {Array} logs - 日志数组
   * @returns {Promise<Array>} - 异常结果
   * @private
   */
  async _checkDownloadFailurePatterns(logs) {
    const results = [];
    
    const downloadLogs = logs.filter(log => 
      log.category === LogCategory.DOWNLOAD
    );
    
    const failuresByType = {};
    
    downloadLogs.forEach(log => {
      if (log.level === LogLevel.ERROR && log.data && log.data.resourceType) {
        const resourceType = log.data.resourceType;
        
        if (!failuresByType[resourceType]) {
          failuresByType[resourceType] = [];
        }
        
        failuresByType[resourceType].push({
          timestamp: log.timestamp,
          url: log.data.url || '',
          error: log.data.error || log.message
        });
      }
    });
    
    Object.entries(failuresByType).forEach(([resourceType, failures]) => {
      const totalDownloads = downloadLogs.filter(log => 
        log.data && log.data.resourceType === resourceType
      ).length;
      
      const failureRate = (failures.length / totalDownloads) * 100;
      
      if (failureRate > 30 && failures.length >= 3) {
        const errorPatterns = {};
        
        failures.forEach(failure => {
          const error = failure.error;
          errorPatterns[error] = (errorPatterns[error] || 0) + 1;
        });
        
        const commonErrors = Object.entries(errorPatterns)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([error, count]) => ({ error, count }));
        
        results.push({
          resourceType,
          failureCount: failures.length,
          totalCount: totalDownloads,
          failureRate: failureRate.toFixed(2),
          commonErrors
        });
      }
    });
    
    return results;
  }
  
  /**
   * 检查网络异常
   * @param {Array} logs - 日志数组
   * @returns {Promise<Array>} - 异常结果
   * @private
   */
  async _checkNetworkIssues(logs) {
    const results = [];
    
    const networkLogs = logs.filter(log => 
      log.category === LogCategory.NETWORK
    );
    
    const hourlyErrors = {};
    
    networkLogs.forEach(log => {
      if (log.level === LogLevel.ERROR || log.level === LogLevel.WARNING) {
        const hourKey = Math.floor(log.timestamp / (60 * 60 * 1000));
        
        if (!hourlyErrors[hourKey]) {
          hourlyErrors[hourKey] = {
            count: 0,
            errors: {}
          };
        }
        
        hourlyErrors[hourKey].count++;
        
        const errorType = log.data && log.data.error ? log.data.error : log.message;
        hourlyErrors[hourKey].errors[errorType] = (hourlyErrors[hourKey].errors[errorType] || 0) + 1;
      }
    });
    
    const hourKeys = Object.keys(hourlyErrors).sort();
    
    for (let i = 0; i < hourKeys.length - 2; i++) {
      const hour1 = parseInt(hourKeys[i]);
      const hour2 = parseInt(hourKeys[i + 1]);
      const hour3 = parseInt(hourKeys[i + 2]);
      
      if (hour2 === hour1 + 1 && hour3 === hour2 + 1) {
        if (hourlyErrors[hour1].count >= 3 && 
            hourlyErrors[hour2].count >= 3 && 
            hourlyErrors[hour3].count >= 3) {
          
          const allErrors = {};
          
          [hour1, hour2, hour3].forEach(hour => {
            Object.entries(hourlyErrors[hour].errors).forEach(([error, count]) => {
              allErrors[error] = (allErrors[error] || 0) + count;
            });
          });
          
          const commonErrors = Object.entries(allErrors)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([error, count]) => ({ error, count }));
          
          results.push({
            startTime: hour1 * 60 * 60 * 1000,
            endTime: (hour3 + 1) * 60 * 60 * 1000,
            duration: '3小时',
            totalErrors: hourlyErrors[hour1].count + hourlyErrors[hour2].count + hourlyErrors[hour3].count,
            commonErrors
          });
          
          i += 2;
        }
      }
    }
    
    return results;
  }
}

const logAnalyzerService = new LogAnalyzerService();
export default logAnalyzerService;
