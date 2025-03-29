/**
 * @file app-state-logger.js
 * @description 应用状态日志记录服务，记录应用状态变化和关键事件
 * @version 1.1.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from './logging-service.js';

/**
 * 应用状态日志记录服务
 * @class AppStateLogger
 */
class AppStateLogger {
  /**
   * 创建应用状态日志记录服务实例
   */
  constructor() {
    this.extensionInfo = null;
    this.startTime = Date.now();
    this.performanceMetrics = {
      resourceDetectionTime: [],
      downloadTime: [],
      renderTime: []
    };
    
    this.benchmarkData = {
      lastBenchmarkTime: 0,
      benchmarkInterval: 3600000, // 默认每小时运行一次基准测试
      performanceHistory: {},
      degradationThreshold: 0.2, // 性能退化阈值（20%）
      isAutoBenchmarkEnabled: true
    };
    
    this.userBehaviorData = {
      interactions: [],
      patterns: {},
      maxInteractionsStored: 100,
      isAnalysisEnabled: true,
      lastAnalysisTime: 0,
      analysisInterval: 86400000 // 默认每天分析一次
    };
    
    this.resourceUsageData = {
      memoryUsage: [],
      cpuUsage: [],
      maxSamplesStored: 50,
      isMonitoringEnabled: true,
      monitoringInterval: 60000, // 默认每分钟监控一次
      memoryWarningThreshold: 100 * 1024 * 1024, // 100MB
      cpuWarningThreshold: 0.5 // 50%
    };
    
    this._initializeExtensionInfo();
    this._initializeMonitoring();
  }
  
  /**
   * 初始化扩展信息
   * @private
   */
  async _initializeExtensionInfo() {
    try {
      this.extensionInfo = {
        version: chrome.runtime.getManifest().version,
        name: chrome.runtime.getManifest().name,
        id: chrome.runtime.id,
        startTime: this.startTime
      };
      
      this.logExtensionStartup();
    } catch (error) {
      console.error('初始化扩展信息失败:', error);
    }
  }
  
  /**
   * 初始化监控系统
   * @private
   */
  _initializeMonitoring() {
    try {
      this._loadMonitoringSettings();
      
      if (this.benchmarkData.isAutoBenchmarkEnabled) {
        this._scheduleAutoBenchmark();
      }
      
      if (this.resourceUsageData.isMonitoringEnabled) {
        this._scheduleResourceMonitoring();
      }
      
      if (this.userBehaviorData.isAnalysisEnabled) {
        this._scheduleUserBehaviorAnalysis();
      }
      
      loggingService.info(LogCategory.APP, '监控系统已初始化', {
        autoBenchmark: this.benchmarkData.isAutoBenchmarkEnabled,
        resourceMonitoring: this.resourceUsageData.isMonitoringEnabled,
        behaviorAnalysis: this.userBehaviorData.isAnalysisEnabled
      });
    } catch (error) {
      console.error('初始化监控系统失败:', error);
      loggingService.error(LogCategory.APP, '初始化监控系统失败', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * 加载监控设置
   * @private
   */
  async _loadMonitoringSettings() {
    try {
      const settings = await new Promise(resolve => {
        chrome.storage.local.get('monitoringSettings', result => {
          resolve(result.monitoringSettings || {});
        });
      });
      
      if (settings.benchmarkData) {
        this.benchmarkData = { ...this.benchmarkData, ...settings.benchmarkData };
      }
      
      if (settings.userBehaviorData) {
        this.userBehaviorData = { ...this.userBehaviorData, ...settings.userBehaviorData };
      }
      
      if (settings.resourceUsageData) {
        this.resourceUsageData = { ...this.resourceUsageData, ...settings.resourceUsageData };
      }
    } catch (error) {
      console.error('加载监控设置失败:', error);
    }
  }
  
  /**
   * 保存监控设置
   * @private
   */
  async _saveMonitoringSettings() {
    try {
      const settings = {
        benchmarkData: {
          benchmarkInterval: this.benchmarkData.benchmarkInterval,
          degradationThreshold: this.benchmarkData.degradationThreshold,
          isAutoBenchmarkEnabled: this.benchmarkData.isAutoBenchmarkEnabled
        },
        userBehaviorData: {
          maxInteractionsStored: this.userBehaviorData.maxInteractionsStored,
          isAnalysisEnabled: this.userBehaviorData.isAnalysisEnabled,
          analysisInterval: this.userBehaviorData.analysisInterval
        },
        resourceUsageData: {
          maxSamplesStored: this.resourceUsageData.maxSamplesStored,
          isMonitoringEnabled: this.resourceUsageData.isMonitoringEnabled,
          monitoringInterval: this.resourceUsageData.monitoringInterval,
          memoryWarningThreshold: this.resourceUsageData.memoryWarningThreshold,
          cpuWarningThreshold: this.resourceUsageData.cpuWarningThreshold
        }
      };
      
      await new Promise(resolve => {
        chrome.storage.local.set({ monitoringSettings: settings }, resolve);
      });
    } catch (error) {
      console.error('保存监控设置失败:', error);
    }
  }
  
  /**
   * 记录扩展启动
   */
  logExtensionStartup() {
    loggingService.info(LogCategory.APP, '扩展已启动', {
      ...this.extensionInfo,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录扩展关闭
   */
  logExtensionShutdown() {
    const runTime = Date.now() - this.startTime;
    
    loggingService.info(LogCategory.APP, '扩展已关闭', {
      ...this.extensionInfo,
      runTime: runTime,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录配置更新
   * @param {Object} settings - 更新后的设置
   */
  logSettingsUpdated(settings) {
    loggingService.info(LogCategory.APP, '设置已更新', {
      timestamp: Date.now(),
      settings: {
        ...settings,
        defaultPath: settings.defaultPath ? '(路径已隐藏)' : undefined
      }
    });
  }
  
  /**
   * 记录标签页变化
   * @param {number} tabId - 标签页ID
   * @param {string} url - 标签页URL
   */
  logTabChange(tabId, url) {
    if (!url) return;
    
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    loggingService.debug(LogCategory.APP, '标签页已变化', {
      tabId,
      domain,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录资源检测开始
   * @param {number} tabId - 标签页ID
   * @param {Object} options - 检测选项
   */
  logDetectionStarted(tabId, options = {}) {
    const detectionId = `detection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    loggingService.info(LogCategory.DETECTION, '资源检测开始', {
      detectionId,
      tabId,
      options,
      startTime: Date.now()
    });
    
    return detectionId;
  }
  
  /**
   * 记录资源检测完成
   * @param {string} detectionId - 检测ID
   * @param {number} resourceCount - 资源数量
   * @param {Object} stats - 检测统计信息
   */
  logDetectionCompleted(detectionId, resourceCount, stats = {}) {
    const endTime = Date.now();
    
    loggingService.info(LogCategory.DETECTION, '资源检测完成', {
      detectionId,
      resourceCount,
      stats,
      endTime,
      duration: stats.startTime ? (endTime - stats.startTime) : null
    });
    
    if (stats.startTime) {
      this.performanceMetrics.resourceDetectionTime.push({
        detectionId,
        duration: endTime - stats.startTime,
        resourceCount,
        timestamp: endTime
      });
      
      if (this.performanceMetrics.resourceDetectionTime.length > 20) {
        this.performanceMetrics.resourceDetectionTime.shift();
      }
    }
  }
  
  /**
   * 记录资源过滤
   * @param {Object} filterOptions - 过滤选项
   * @param {number} beforeCount - 过滤前数量
   * @param {number} afterCount - 过滤后数量
   */
  logResourceFiltered(filterOptions, beforeCount, afterCount) {
    loggingService.debug(LogCategory.RESOURCE, '资源已过滤', {
      filterOptions,
      beforeCount,
      afterCount,
      filteredCount: beforeCount - afterCount,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录资源排序
   * @param {string} sortMethod - 排序方法
   * @param {number} resourceCount - 资源数量
   */
  logResourceSorted(sortMethod, resourceCount) {
    loggingService.debug(LogCategory.RESOURCE, '资源已排序', {
      sortMethod,
      resourceCount,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录UI渲染
   * @param {string} componentName - 组件名称
   * @param {number} renderTime - 渲染时间(毫秒)
   */
  logUIRendered(componentName, renderTime) {
    loggingService.debug(LogCategory.UI, 'UI组件已渲染', {
      componentName,
      renderTime,
      timestamp: Date.now()
    });
    
    this.performanceMetrics.renderTime.push({
      componentName,
      duration: renderTime,
      timestamp: Date.now()
    });
    
    if (this.performanceMetrics.renderTime.length > 20) {
      this.performanceMetrics.renderTime.shift();
    }
  }
  
  /**
   * 记录用户交互
   * @param {string} action - 交互动作
   * @param {Object} details - 交互详情
   */
  logUserInteraction(action, details = {}) {
    const timestamp = Date.now();
    
    loggingService.debug(LogCategory.UI, '用户交互', {
      action,
      ...details,
      timestamp
    });
    
    if (this.userBehaviorData.isAnalysisEnabled) {
      const interaction = {
        action,
        details,
        timestamp,
        sessionId: this.extensionInfo ? this.extensionInfo.id : 'unknown',
        url: details.url || (window.location ? window.location.href : 'unknown')
      };
      
      this.userBehaviorData.interactions.push(interaction);
      
      if (this.userBehaviorData.interactions.length > this.userBehaviorData.maxInteractionsStored) {
        this.userBehaviorData.interactions.shift();
      }
      
      this._analyzeInteractionPattern(interaction);
    }
  }
  
  /**
   * 分析用户交互模式
   * @param {Object} interaction - 用户交互数据
   * @private
   */
  _analyzeInteractionPattern(interaction) {
    try {
      const { action } = interaction;
      
      if (!this.userBehaviorData.patterns[action]) {
        this.userBehaviorData.patterns[action] = {
          count: 0,
          lastTime: 0,
          avgTimeBetween: 0,
          frequentlyUsed: false
        };
      }
      
      const pattern = this.userBehaviorData.patterns[action];
      pattern.count++;
      
      if (pattern.lastTime > 0) {
        const timeBetween = interaction.timestamp - pattern.lastTime;
        pattern.avgTimeBetween = (pattern.avgTimeBetween * (pattern.count - 1) + timeBetween) / pattern.count;
      }
      
      pattern.lastTime = interaction.timestamp;
      
      pattern.frequentlyUsed = pattern.count >= 5;
      
      if (pattern.count === 5) {
        loggingService.info(LogCategory.APP, '发现频繁使用的功能', {
          action,
          count: pattern.count,
          avgTimeBetween: pattern.avgTimeBetween
        });
      }
    } catch (error) {
      console.error('分析用户交互模式失败:', error);
    }
  }
  
  /**
   * 记录错误
   * @param {string} source - 错误来源
   * @param {Error} error - 错误对象
   * @param {Object} context - 错误上下文
   */
  logError(source, error, context = {}) {
    loggingService.error(LogCategory.APP, `错误: ${source}`, {
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录警告
   * @param {string} source - 警告来源
   * @param {string} message - 警告消息
   * @param {Object} context - 警告上下文
   */
  logWarning(source, message, context = {}) {
    loggingService.warn(LogCategory.APP, `警告: ${source}`, {
      message,
      ...context,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录网络请求
   * @param {string} url - 请求URL
   * @param {string} method - 请求方法
   * @param {number} status - 状态码
   * @param {number} duration - 请求时长(毫秒)
   */
  logNetworkRequest(url, method, status, duration) {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    
    loggingService.debug(LogCategory.NETWORK, '网络请求', {
      domain,
      path,
      method,
      status,
      duration,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录性能指标
   * @param {string} metricName - 指标名称
   * @param {number} value - 指标值
   * @param {Object} context - 上下文信息
   */
  logPerformanceMetric(metricName, value, context = {}) {
    loggingService.debug(LogCategory.APP, '性能指标', {
      metricName,
      value,
      ...context,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录扩展更新
   * @param {string} previousVersion - 之前的版本
   * @param {string} currentVersion - 当前版本
   */
  logExtensionUpdated(previousVersion, currentVersion) {
    loggingService.info(LogCategory.APP, '扩展已更新', {
      previousVersion,
      currentVersion,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录存储操作
   * @param {string} operation - 操作类型 (get, set, remove)
   * @param {string} key - 存储键
   * @param {boolean} success - 是否成功
   */
  logStorageOperation(operation, key, success) {
    loggingService.debug(LogCategory.APP, '存储操作', {
      operation,
      key,
      success,
      timestamp: Date.now()
    });
  }
  
  /**
   * 获取性能指标摘要
   * @returns {Object} - 性能指标摘要
   */
  getPerformanceMetricsSummary() {
    const calculateAverage = (arr, property) => {
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((sum, item) => sum + item[property], 0) / arr.length;
    };
    
    return {
      averageDetectionTime: calculateAverage(this.performanceMetrics.resourceDetectionTime, 'duration'),
      averageDownloadTime: calculateAverage(this.performanceMetrics.downloadTime, 'duration'),
      averageRenderTime: calculateAverage(this.performanceMetrics.renderTime, 'duration'),
      detectionSamples: this.performanceMetrics.resourceDetectionTime.length,
      downloadSamples: this.performanceMetrics.downloadTime.length,
      renderSamples: this.performanceMetrics.renderTime.length,
      uptime: Date.now() - this.startTime
    };
  }
  
  /**
   * 记录性能指标摘要
   */
  logPerformanceMetricsSummary() {
    const summary = this.getPerformanceMetricsSummary();
    
    loggingService.info(LogCategory.APP, '性能指标摘要', {
      ...summary,
      timestamp: Date.now()
    });
  }
  
  /**
   * 获取用户行为分析结果
   * @returns {Object} - 用户行为分析结果
   */
  getUserBehaviorAnalysis() {
    const interactionPatterns = this._analyzeInteractionFrequency();
    const sessionAnalysis = this._analyzeUserSessions();
    const optimizationSuggestions = this._generateOptimizationSuggestions(
      interactionPatterns,
      sessionAnalysis
    );
    
    return {
      interactionPatterns,
      sessionAnalysis,
      optimizationSuggestions,
      timestamp: Date.now()
    };
  }
  
  /**
   * 分析交互频率
   * @returns {Object} - 交互频率分析结果
   * @private
   */
  _analyzeInteractionFrequency() {
    const result = {
      mostFrequentActions: [],
      leastFrequentActions: [],
      actionFrequency: {}
    };
    
    try {
      const { patterns } = this.userBehaviorData;
      const actions = Object.keys(patterns);
      
      if (actions.length === 0) {
        return result;
      }
      
      actions.forEach(action => {
        result.actionFrequency[action] = {
          count: patterns[action].count,
          avgTimeBetween: patterns[action].avgTimeBetween,
          lastTime: patterns[action].lastTime
        };
      });
      
      const sortedActions = actions.sort((a, b) => 
        patterns[b].count - patterns[a].count
      );
      
      result.mostFrequentActions = sortedActions.slice(0, 3).map(action => ({
        action,
        count: patterns[action].count,
        avgTimeBetween: patterns[action].avgTimeBetween
      }));
      
      result.leastFrequentActions = sortedActions.slice(-3).map(action => ({
        action,
        count: patterns[action].count,
        avgTimeBetween: patterns[action].avgTimeBetween
      }));
    } catch (error) {
      console.error('分析交互频率失败:', error);
    }
    
    return result;
  }
  
  /**
   * 分析用户会话
   * @returns {Object} - 会话分析结果
   * @private
   */
  _analyzeUserSessions() {
    const result = {
      averageSessionDuration: 0,
      averageActionsPerSession: 0,
      sessionCount: 0,
      mostCommonActions: []
    };
    
    try {
      const { interactions } = this.userBehaviorData;
      
      if (interactions.length === 0) {
        return result;
      }
      
      const sessions = {};
      interactions.forEach(interaction => {
        const { sessionId } = interaction;
        if (!sessions[sessionId]) {
          sessions[sessionId] = {
            actions: [],
            startTime: interaction.timestamp,
            endTime: interaction.timestamp
          };
        }
        
        sessions[sessionId].actions.push(interaction.action);
        sessions[sessionId].endTime = Math.max(sessions[sessionId].endTime, interaction.timestamp);
      });
      
      const sessionIds = Object.keys(sessions);
      result.sessionCount = sessionIds.length;
      
      let totalDuration = 0;
      let totalActions = 0;
      const actionCounts = {};
      
      sessionIds.forEach(sessionId => {
        const session = sessions[sessionId];
        const duration = session.endTime - session.startTime;
        
        totalDuration += duration;
        totalActions += session.actions.length;
        
        session.actions.forEach(action => {
          actionCounts[action] = (actionCounts[action] || 0) + 1;
        });
      });
      
      if (result.sessionCount > 0) {
        result.averageSessionDuration = totalDuration / result.sessionCount;
        result.averageActionsPerSession = totalActions / result.sessionCount;
      }
      
      result.mostCommonActions = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([action, count]) => ({ action, count }));
    } catch (error) {
      console.error('分析用户会话失败:', error);
    }
    
    return result;
  }
  
  /**
   * 生成优化建议
   * @param {Object} interactionPatterns - 交互模式分析结果
   * @param {Object} sessionAnalysis - 会话分析结果
   * @returns {Array} - 优化建议列表
   * @private
   */
  _generateOptimizationSuggestions(interactionPatterns, sessionAnalysis) {
    const suggestions = [];
    
    try {
      if (interactionPatterns.mostFrequentActions.length > 0) {
        const mostUsed = interactionPatterns.mostFrequentActions[0];
        suggestions.push({
          type: 'UI_OPTIMIZATION',
          title: '优化常用功能访问',
          description: `将"${mostUsed.action}"功能放在更显眼的位置，因为它是最常用的操作。`,
          priority: 'high'
        });
      }
      
      if (interactionPatterns.leastFrequentActions.length > 0) {
        const leastUsed = interactionPatterns.leastFrequentActions[0];
        if (leastUsed.count < 2) {
          suggestions.push({
            type: 'UI_SIMPLIFICATION',
            title: '简化不常用功能',
            description: `考虑将"${leastUsed.action}"功能移至二级菜单，因为它很少被使用。`,
            priority: 'medium'
          });
        }
      }
      
      if (sessionAnalysis.averageSessionDuration > 300000) { // 5分钟以上
        suggestions.push({
          type: 'PERFORMANCE',
          title: '优化长会话性能',
          description: '用户平均会话时间较长，建议优化内存管理和资源释放，提高长时间使用的稳定性。',
          priority: 'high'
        });
      }
      
      if (sessionAnalysis.averageActionsPerSession > 20) {
        suggestions.push({
          type: 'WORKFLOW',
          title: '简化操作流程',
          description: '用户平均每次会话执行大量操作，考虑添加批处理功能或快捷方式减少重复操作。',
          priority: 'medium'
        });
      }
      
      suggestions.push({
        type: 'PERSONALIZATION',
        title: '添加个性化设置',
        description: '基于用户行为模式，建议添加个性化设置选项，让用户可以自定义常用功能和界面布局。',
        priority: 'low'
      });
    } catch (error) {
      console.error('生成优化建议失败:', error);
    }
    
    return suggestions;
  }
  
  /**
   * 获取资源使用情况摘要
   * @returns {Object} - 资源使用情况摘要
   */
  getResourceUsageSummary() {
    const calculateAverage = (arr, property) => {
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((sum, item) => sum + (item[property] || 0), 0) / arr.length;
    };
    
    return {
      averageMemoryUsage: calculateAverage(this.resourceUsageData.memoryUsage, 'usedPercentage'),
      averageCPUUsage: calculateAverage(this.resourceUsageData.cpuUsage, 'avgUsagePercentage'),
      memorySamples: this.resourceUsageData.memoryUsage.length,
      cpuSamples: this.resourceUsageData.cpuUsage.length,
      lastMemoryUsage: this.resourceUsageData.memoryUsage.length > 0 
        ? this.resourceUsageData.memoryUsage[this.resourceUsageData.memoryUsage.length - 1] 
        : null,
      lastCPUUsage: this.resourceUsageData.cpuUsage.length > 0 
        ? this.resourceUsageData.cpuUsage[this.resourceUsageData.cpuUsage.length - 1] 
        : null,
      timestamp: Date.now()
    };
  }
  
  /**
   * 设置性能基准测试配置
   * @param {Object} config - 配置对象
   */
  setBenchmarkConfig(config) {
    if (config.benchmarkInterval !== undefined) {
      this.benchmarkData.benchmarkInterval = config.benchmarkInterval;
    }
    
    if (config.degradationThreshold !== undefined) {
      this.benchmarkData.degradationThreshold = config.degradationThreshold;
    }
    
    if (config.isAutoBenchmarkEnabled !== undefined) {
      this.benchmarkData.isAutoBenchmarkEnabled = config.isAutoBenchmarkEnabled;
    }
    
    this._saveMonitoringSettings();
    
    loggingService.info(LogCategory.APP, '性能基准测试配置已更新', {
      benchmarkInterval: this.benchmarkData.benchmarkInterval,
      degradationThreshold: this.benchmarkData.degradationThreshold,
      isAutoBenchmarkEnabled: this.benchmarkData.isAutoBenchmarkEnabled
    });
  }
  
  /**
   * 设置资源监控配置
   * @param {Object} config - 配置对象
   */
  setResourceMonitoringConfig(config) {
    if (config.monitoringInterval !== undefined) {
      this.resourceUsageData.monitoringInterval = config.monitoringInterval;
    }
    
    if (config.memoryWarningThreshold !== undefined) {
      this.resourceUsageData.memoryWarningThreshold = config.memoryWarningThreshold;
    }
    
    if (config.cpuWarningThreshold !== undefined) {
      this.resourceUsageData.cpuWarningThreshold = config.cpuWarningThreshold;
    }
    
    if (config.isMonitoringEnabled !== undefined) {
      this.resourceUsageData.isMonitoringEnabled = config.isMonitoringEnabled;
    }
    
    if (config.maxSamplesStored !== undefined) {
      this.resourceUsageData.maxSamplesStored = config.maxSamplesStored;
    }
    
    this._saveMonitoringSettings();
    
    loggingService.info(LogCategory.APP, '资源监控配置已更新', {
      monitoringInterval: this.resourceUsageData.monitoringInterval,
      memoryWarningThreshold: this.resourceUsageData.memoryWarningThreshold,
      cpuWarningThreshold: this.resourceUsageData.cpuWarningThreshold,
      isMonitoringEnabled: this.resourceUsageData.isMonitoringEnabled,
      maxSamplesStored: this.resourceUsageData.maxSamplesStored
    });
  }
  
  /**
   * 设置用户行为分析配置
   * @param {Object} config - 配置对象
   */
  setUserBehaviorAnalysisConfig(config) {
    if (config.analysisInterval !== undefined) {
      this.userBehaviorData.analysisInterval = config.analysisInterval;
    }
    
    if (config.isAnalysisEnabled !== undefined) {
      this.userBehaviorData.isAnalysisEnabled = config.isAnalysisEnabled;
    }
    
    if (config.maxInteractionsStored !== undefined) {
      this.userBehaviorData.maxInteractionsStored = config.maxInteractionsStored;
    }
    
    this._saveMonitoringSettings();
    
    loggingService.info(LogCategory.APP, '用户行为分析配置已更新', {
      analysisInterval: this.userBehaviorData.analysisInterval,
      isAnalysisEnabled: this.userBehaviorData.isAnalysisEnabled,
      maxInteractionsStored: this.userBehaviorData.maxInteractionsStored
    });
  }
  
  /**
   * 安排自动基准测试
   * @private
   */
  _scheduleAutoBenchmark() {
    const runBenchmark = async () => {
      try {
        await this.runPerformanceBenchmark();
        
        setTimeout(runBenchmark, this.benchmarkData.benchmarkInterval);
      } catch (error) {
        console.error('执行自动基准测试失败:', error);
        setTimeout(runBenchmark, this.benchmarkData.benchmarkInterval * 2);
      }
    };
    
    setTimeout(runBenchmark, 30000);
  }
  
  /**
   * 运行性能基准测试
   * @returns {Promise<Object>} - 基准测试结果
   */
  async runPerformanceBenchmark() {
    try {
      loggingService.info(LogCategory.APP, '开始性能基准测试');
      
      const benchmarkStart = Date.now();
      this.benchmarkData.lastBenchmarkTime = benchmarkStart;
      
      const currentMetrics = this.getPerformanceMetricsSummary();
      
      const indexedDBService = (await import('./indexeddb-service.js')).default;
      const historicalMetrics = await indexedDBService.getMetrics('performance', 10);
      
      const comparisonResults = this._comparePerformanceMetrics(currentMetrics, historicalMetrics);
      
      await indexedDBService.saveMetric('performance', {
        timestamp: benchmarkStart,
        metrics: currentMetrics
      });
      
      loggingService.info(LogCategory.APP, '性能基准测试完成', {
        duration: Date.now() - benchmarkStart,
        currentMetrics,
        comparisonResults
      });
      
      return {
        metrics: currentMetrics,
        comparison: comparisonResults
      };
    } catch (error) {
      loggingService.error(LogCategory.APP, '性能基准测试失败', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
  
  /**
   * 比较性能指标
   * @param {Object} currentMetrics - 当前性能指标
   * @param {Array} historicalMetrics - 历史性能指标
   * @returns {Object} - 比较结果
   * @private
   */
  _comparePerformanceMetrics(currentMetrics, historicalMetrics) {
    const results = {
      hasDegradation: false,
      degradedMetrics: [],
      improvedMetrics: [],
      details: {}
    };
    
    if (!historicalMetrics || historicalMetrics.length === 0) {
      return results;
    }
    
    const historicalAvg = {};
    const metricsToCompare = [
      'averageDetectionTime',
      'averageDownloadTime',
      'averageRenderTime'
    ];
    
    metricsToCompare.forEach(metric => {
      historicalAvg[metric] = historicalMetrics.reduce((sum, item) => {
        return sum + (item.data.metrics[metric] || 0);
      }, 0) / historicalMetrics.length;
    });
    
    metricsToCompare.forEach(metric => {
      const current = currentMetrics[metric] || 0;
      const historical = historicalAvg[metric] || 0;
      
      if (historical === 0) return;
      
      const change = (current - historical) / historical;
      const changePercent = Math.abs(change * 100).toFixed(2);
      
      results.details[metric] = {
        current,
        historical,
        change,
        changePercent: `${changePercent}%`
      };
      
      if (change > this.benchmarkData.degradationThreshold) {
        results.hasDegradation = true;
        results.degradedMetrics.push(metric);
        
        loggingService.warn(LogCategory.APP, '检测到性能退化', {
          metric,
          current,
          historical,
          degradation: `${changePercent}%`,
          threshold: `${this.benchmarkData.degradationThreshold * 100}%`
        });
      }
      
      if (change < -0.1) { // 改进超过10%
        results.improvedMetrics.push(metric);
      }
    });
    
    return results;
  }
  
  /**
   * 安排资源使用监控
   * @private
   */
  _scheduleResourceMonitoring() {
    const monitorResources = async () => {
      try {
        await this.monitorResourceUsage();
        
        setTimeout(monitorResources, this.resourceUsageData.monitoringInterval);
      } catch (error) {
        console.error('监控资源使用失败:', error);
        setTimeout(monitorResources, this.resourceUsageData.monitoringInterval * 2);
      }
    };
    
    setTimeout(monitorResources, 10000);
  }
  
  /**
   * 监控资源使用情况
   * @returns {Promise<Object>} - 资源使用情况
   */
  async monitorResourceUsage() {
    try {
      const memoryInfo = await this._getMemoryUsage();
      
      const cpuInfo = await this._getCPUUsage();
      
      const timestamp = Date.now();
      
      this.resourceUsageData.memoryUsage.push({
        ...memoryInfo,
        timestamp
      });
      
      this.resourceUsageData.cpuUsage.push({
        ...cpuInfo,
        timestamp
      });
      
      if (this.resourceUsageData.memoryUsage.length > this.resourceUsageData.maxSamplesStored) {
        this.resourceUsageData.memoryUsage.shift();
      }
      
      if (this.resourceUsageData.cpuUsage.length > this.resourceUsageData.maxSamplesStored) {
        this.resourceUsageData.cpuUsage.shift();
      }
      
      this._checkResourceWarningThresholds(memoryInfo, cpuInfo);
      
      loggingService.debug(LogCategory.APP, '资源使用情况', {
        memory: memoryInfo,
        cpu: cpuInfo,
        timestamp
      });
      
      return {
        memory: memoryInfo,
        cpu: cpuInfo,
        timestamp
      };
    } catch (error) {
      console.error('监控资源使用失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取内存使用情况
   * @returns {Promise<Object>} - 内存使用情况
   * @private
   */
  async _getMemoryUsage() {
    try {
      if (chrome.system && chrome.system.memory) {
        return new Promise(resolve => {
          chrome.system.memory.getInfo(info => {
            resolve({
              availableCapacity: info.availableCapacity,
              capacity: info.capacity,
              usedPercentage: (1 - info.availableCapacity / info.capacity) * 100
            });
          });
        });
      }
      
      if (performance && performance.memory) {
        const memory = performance.memory;
        return {
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usedPercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        };
      }
      
      return {
        usedJSHeapSize: 0,
        totalJSHeapSize: 0,
        jsHeapSizeLimit: 0,
        usedPercentage: 0,
        unavailable: true
      };
    } catch (error) {
      console.error('获取内存使用情况失败:', error);
      return { error: error.message, unavailable: true };
    }
  }
  
  /**
   * 获取CPU使用情况
   * @returns {Promise<Object>} - CPU使用情况
   * @private
   */
  async _getCPUUsage() {
    try {
      if (chrome.system && chrome.system.cpu) {
        return new Promise(resolve => {
          chrome.system.cpu.getInfo(info => {
            const processors = info.processors;
            let totalUsage = 0;
            
            processors.forEach(processor => {
              const usage = processor.usage;
              const total = usage.user + usage.kernel + usage.idle;
              const used = usage.user + usage.kernel;
              totalUsage += used / total;
            });
            
            const avgUsage = totalUsage / processors.length;
            
            resolve({
              numProcessors: processors.length,
              archName: info.archName,
              modelName: info.modelName,
              avgUsagePercentage: avgUsage * 100
            });
          });
        });
      }
      
      return {
        numProcessors: navigator.hardwareConcurrency || 0,
        avgUsagePercentage: 0,
        unavailable: true
      };
    } catch (error) {
      console.error('获取CPU使用情况失败:', error);
      return { error: error.message, unavailable: true };
    }
  }
  
  /**
   * 检查资源使用是否超过警告阈值
   * @param {Object} memoryInfo - 内存使用情况
   * @param {Object} cpuInfo - CPU使用情况
   * @private
   */
  _checkResourceWarningThresholds(memoryInfo, cpuInfo) {
    try {
      if (!memoryInfo.unavailable) {
        let memoryUsage = 0;
        
        if (memoryInfo.usedJSHeapSize) {
          memoryUsage = memoryInfo.usedJSHeapSize;
        } else if (memoryInfo.capacity && memoryInfo.availableCapacity) {
          memoryUsage = memoryInfo.capacity - memoryInfo.availableCapacity;
        }
        
        if (memoryUsage > this.resourceUsageData.memoryWarningThreshold) {
          loggingService.warn(LogCategory.APP, '内存使用超过警告阈值', {
            current: `${(memoryUsage / (1024 * 1024)).toFixed(2)} MB`,
            threshold: `${(this.resourceUsageData.memoryWarningThreshold / (1024 * 1024)).toFixed(2)} MB`,
            usedPercentage: `${memoryInfo.usedPercentage.toFixed(2)}%`
          });
        }
      }
      
      if (!cpuInfo.unavailable && cpuInfo.avgUsagePercentage > this.resourceUsageData.cpuWarningThreshold * 100) {
        loggingService.warn(LogCategory.APP, 'CPU使用超过警告阈值', {
          current: `${cpuInfo.avgUsagePercentage.toFixed(2)}%`,
          threshold: `${(this.resourceUsageData.cpuWarningThreshold * 100).toFixed(2)}%`,
          numProcessors: cpuInfo.numProcessors
        });
      }
    } catch (error) {
      console.error('检查资源警告阈值失败:', error);
    }
  }
  
  /**
   * 安排用户行为分析
   * @private
   */
  _scheduleUserBehaviorAnalysis() {
    const analyzeUserBehavior = async () => {
      try {
        await this.analyzeUserBehavior();
        
        setTimeout(analyzeUserBehavior, this.userBehaviorData.analysisInterval);
      } catch (error) {
        console.error('分析用户行为失败:', error);
        setTimeout(analyzeUserBehavior, this.userBehaviorData.analysisInterval * 2);
      }
    };
    
    setTimeout(analyzeUserBehavior, 3600000);
  }
  
  /**
   * 分析用户行为
   * @returns {Promise<Object>} - 分析结果
   */
  async analyzeUserBehavior() {
    try {
      loggingService.info(LogCategory.APP, '开始用户行为分析');
      
      const analysisStart = Date.now();
      this.userBehaviorData.lastAnalysisTime = analysisStart;
      
      const interactionPatterns = this._analyzeInteractionFrequency();
      
      const sessionAnalysis = this._analyzeUserSessions();
      
      const optimizationSuggestions = this._generateOptimizationSuggestions(
        interactionPatterns,
        sessionAnalysis
      );
      
      loggingService.info(LogCategory.APP, '用户行为分析完成', {
        duration: Date.now() - analysisStart,
        interactionPatterns,
        sessionAnalysis,
        optimizationSuggestions
      });
      
      return {
        interactionPatterns,
        sessionAnalysis,
        optimizationSuggestions,
        timestamp: Date.now()
      };
    } catch (error) {
      loggingService.error(LogCategory.APP, '用户行为分析失败', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

const appStateLogger = new AppStateLogger();

export default appStateLogger;
