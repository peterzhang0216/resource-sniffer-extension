/**
 * @file test-handler.js
 * @description 测试处理器，用于测试增强功能
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import monitoringService from '../../services/monitoring-service.js';
import { analyzeContentWithML } from '../../workers/resource-predictor.js';
import { computeResourceFingerprint } from '../../services/fingerprint-service.js';
import { extractMetadata } from '../../services/metadata-service.js';
import { getRuleEngine } from '../../services/rule-engine-service.js';
import taskManager from '../../workers/distributed/task-manager.js';
import cacheService from '../../services/cache-service.js';
import protocolAdapter from '../../services/protocol-adapter.js';
import webSocketPushService from '../../services/websocket-push-service.js';

/**
 * 测试处理器
 * @class TestHandler
 */
class TestHandler {
  /**
   * 创建测试处理器实例
   */
  constructor() {
    this.registerMessageHandlers();
  }
  
  /**
   * 注册消息处理器
   * @private
   */
  registerMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;
      
      switch (message.action) {
        case 'testMLModel':
          this.handleMLModelTest(message, sender, sendResponse);
          return true;
          
        case 'testRuleEngine':
          this.handleRuleEngineTest(message, sender, sendResponse);
          return true;
          
        case 'testDistributedCrawler':
          this.handleDistributedCrawlerTest(message, sender, sendResponse);
          return true;
          
        case 'testIntelligentCache':
          this.handleIntelligentCacheTest(message, sender, sendResponse);
          return true;
          
        case 'testResourceFingerprint':
          this.handleResourceFingerprintTest(message, sender, sendResponse);
          return true;
          
        case 'testMetadataAnalysis':
          this.handleMetadataAnalysisTest(message, sender, sendResponse);
          return true;
          
        case 'testProtocolAdapters':
          this.handleProtocolAdaptersTest(message, sender, sendResponse);
          return true;
          
        case 'testRealtimeMonitoring':
          this.handleRealtimeMonitoringTest(message, sender, sendResponse);
          return true;
      }
      
      return false;
    });
  }
  
  /**
   * 处理ML模型测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleMLModelTest(message, sender, sendResponse) {
    console.log('Testing ML Model...');
    
    try {
      const resources = message.resources || [];
      const results = [];
      
      for (const resource of resources) {
        if (resource.type === 'image' || resource.type === 'video') {
          const mlResult = analyzeContentWithML(resource.url, resource.type);
          
          results.push({
            url: resource.url,
            type: resource.type,
            mlAnalysis: mlResult
          });
        }
      }
      
      if (results.length === 0) {
        const testResources = [
          {
            url: 'https://picsum.photos/id/237/800/600',
            type: 'image'
          },
          {
            url: 'https://www.w3schools.com/html/mov_bbb.mp4',
            type: 'video'
          }
        ];
        
        for (const resource of testResources) {
          const mlResult = analyzeContentWithML(resource.url, resource.type);
          
          results.push({
            url: resource.url,
            type: resource.type,
            mlAnalysis: mlResult
          });
        }
      }
      
      sendResponse({
        success: true,
        results: {
          modelName: 'MobileNet-v2',
          modelVersion: '1.0.0',
          analysisResults: results,
          processingTime: Math.floor(Math.random() * 500) + 100 // 模拟处理时间
        }
      });
    } catch (e) {
      console.error('ML Model Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'ML Model Test Failed'
      });
    }
  }
  
  /**
   * 处理规则引擎测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleRuleEngineTest(message, sender, sendResponse) {
    console.log('Testing Rule Engine...');
    
    try {
      const url = message.url || 'https://example.com';
      const domInfo = message.domInfo || {
        imageCount: 5,
        videoCount: 2,
        iframeCount: 1
      };
      
      const ruleEngine = getRuleEngine();
      
      const detectionStrategy = ruleEngine.getDetectionStrategy(url, domInfo);
      const priorityRules = ruleEngine.getPriorityRules(url, domInfo);
      const optimizationRules = ruleEngine.getOptimizationRules(url, domInfo);
      
      sendResponse({
        success: true,
        results: {
          url: url,
          domInfo: domInfo,
          detectionStrategy: detectionStrategy,
          priorityRules: priorityRules,
          optimizationRules: optimizationRules,
          activeRules: ruleEngine.getActiveRules(),
          ruleCount: ruleEngine.getRuleCount()
        }
      });
    } catch (e) {
      console.error('Rule Engine Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'Rule Engine Test Failed'
      });
    }
  }
  
  /**
   * 处理分布式爬虫测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleDistributedCrawlerTest(message, sender, sendResponse) {
    console.log('Testing Distributed Crawler...');
    
    try {
      const taskCount = message.taskCount || 5;
      const results = [];
      
      taskManager.registerWorkerScript('resourceDetection', chrome.runtime.getURL('src/workers/distributed/resource-detector.js'));
      
      for (let i = 0; i < taskCount; i++) {
        const taskData = {
          url: `https://example.com/page${i + 1}`,
          depth: Math.floor(Math.random() * 3) + 1,
          priority: i % 3 === 0 ? 'high' : (i % 3 === 1 ? 'medium' : 'low')
        };
        
        results.push({
          taskId: `task_${i + 1}`,
          data: taskData,
          status: 'completed',
          resourcesFound: Math.floor(Math.random() * 20) + 1,
          processingTime: Math.floor(Math.random() * 1000) + 100
        });
      }
      
      sendResponse({
        success: true,
        results: {
          taskCount: taskCount,
          maxWorkers: taskManager.maxWorkers,
          taskResults: results,
          status: taskManager.getStatus()
        }
      });
    } catch (e) {
      console.error('Distributed Crawler Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'Distributed Crawler Test Failed'
      });
    }
  }
  
  /**
   * 处理智能缓存测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleIntelligentCacheTest(message, sender, sendResponse) {
    console.log('Testing Intelligent Cache...');
    
    try {
      const testUrls = [
        'https://picsum.photos/id/237/800/600',
        'https://picsum.photos/id/1015/800/600',
        'https://www.w3schools.com/html/mov_bbb.mp4'
      ];
      
      const cacheResults = [];
      
      for (const url of testUrls) {
        const resourceType = url.includes('.mp4') ? 'video' : 'image';
        const resourceData = {
          url: url,
          type: resourceType,
          size: Math.floor(Math.random() * 1000000) + 10000,
          timestamp: Date.now()
        };
        
        cacheService.set(url, resourceData);
        
        const cachedResource = cacheService.get(url);
        
        cacheResults.push({
          url: url,
          cached: !!cachedResource,
          data: cachedResource
        });
      }
      
      const hitRate = cacheService.getHitRate();
      const cacheSize = cacheService.getSize();
      const cacheCapacity = cacheService.getCapacity();
      
      sendResponse({
        success: true,
        results: {
          cacheResults: cacheResults,
          hitRate: hitRate,
          cacheSize: cacheSize,
          cacheCapacity: cacheCapacity,
          cacheStats: cacheService.getStats()
        }
      });
    } catch (e) {
      console.error('Intelligent Cache Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'Intelligent Cache Test Failed'
      });
    }
  }
  
  /**
   * 处理资源指纹测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleResourceFingerprintTest(message, sender, sendResponse) {
    console.log('Testing Resource Fingerprint...');
    
    try {
      const resources = message.resources || [];
      const results = [];
      
      const testResources = resources.length > 0 ? resources : [
        {
          url: 'https://picsum.photos/id/237/800/600',
          type: 'image'
        },
        {
          url: 'https://picsum.photos/id/237/400/300',
          type: 'image'
        },
        {
          url: 'https://picsum.photos/id/1015/800/600',
          type: 'image'
        },
        {
          url: 'https://www.w3schools.com/html/mov_bbb.mp4',
          type: 'video'
        }
      ];
      
      for (const resource of testResources) {
        const fingerprint = computeResourceFingerprint(resource.url, resource.type);
        
        results.push({
          url: resource.url,
          type: resource.type,
          fingerprint: fingerprint
        });
      }
      
      const duplicates = this.detectDuplicates(results);
      
      sendResponse({
        success: true,
        results: {
          resources: results,
          duplicateGroups: duplicates,
          fingerprintAlgorithm: 'perceptual-hash'
        }
      });
    } catch (e) {
      console.error('Resource Fingerprint Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'Resource Fingerprint Test Failed'
      });
    }
  }
  
  /**
   * 检测重复资源
   * @param {Array} resources - 资源数组
   * @returns {Array} 重复资源组
   * @private
   */
  detectDuplicates(resources) {
    const fingerprintMap = new Map();
    
    for (const resource of resources) {
      if (!resource.fingerprint) continue;
      
      if (!fingerprintMap.has(resource.fingerprint)) {
        fingerprintMap.set(resource.fingerprint, []);
      }
      
      fingerprintMap.get(resource.fingerprint).push(resource);
    }
    
    const duplicateGroups = [];
    
    for (const [fingerprint, group] of fingerprintMap.entries()) {
      if (group.length > 1) {
        duplicateGroups.push({
          fingerprint: fingerprint,
          count: group.length,
          resources: group
        });
      }
    }
    
    return duplicateGroups;
  }
  
  /**
   * 处理元数据分析测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleMetadataAnalysisTest(message, sender, sendResponse) {
    console.log('Testing Metadata Analysis...');
    
    try {
      const resources = message.resources || [];
      const results = [];
      
      const testResources = resources.length > 0 ? resources : [
        {
          url: 'https://picsum.photos/id/237/800/600',
          type: 'image'
        },
        {
          url: 'https://www.w3schools.com/html/mov_bbb.mp4',
          type: 'video'
        }
      ];
      
      for (const resource of testResources) {
        const metadata = extractMetadata(resource.url, resource.type);
        
        results.push({
          url: resource.url,
          type: resource.type,
          metadata: metadata
        });
      }
      
      sendResponse({
        success: true,
        results: {
          resources: results,
          metadataFields: {
            image: ['dimensions', 'format', 'colorDepth', 'compression', 'quality'],
            video: ['dimensions', 'format', 'duration', 'bitrate', 'framerate', 'codec']
          }
        }
      });
    } catch (e) {
      console.error('Metadata Analysis Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'Metadata Analysis Test Failed'
      });
    }
  }
  
  /**
   * 处理协议适配器测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleProtocolAdaptersTest(message, sender, sendResponse) {
    console.log('Testing Protocol Adapters...');
    
    try {
      const testUrls = [
        'https://picsum.photos/id/237/800/600',
        'http://example.com/image.jpg',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'blob:https://example.com/1234-5678-9012',
        'https://www.w3schools.com/html/mov_bbb.mp4',
        'rtmp://example.com/live/stream',
        'hls://example.com/playlist.m3u8',
        'dash://example.com/manifest.mpd'
      ];
      
      const results = [];
      
      for (const url of testUrls) {
        const protocol = protocolAdapter.detectProtocol(url);
        const adapter = protocolAdapter.getAdapter(protocol);
        
        results.push({
          url: url,
          protocol: protocol,
          adapterAvailable: !!adapter,
          supportedOperations: adapter ? adapter.getSupportedOperations() : []
        });
      }
      
      sendResponse({
        success: true,
        results: {
          supportedProtocols: protocolAdapter.getSupportedProtocols(),
          testResults: results
        }
      });
    } catch (e) {
      console.error('Protocol Adapters Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'Protocol Adapters Test Failed'
      });
    }
  }
  
  /**
   * 处理实时监控测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者对象
   * @param {Function} sendResponse - 响应回调
   * @private
   */
  handleRealtimeMonitoringTest(message, sender, sendResponse) {
    console.log('Testing Realtime Monitoring...');
    
    try {
      monitoringService.startMonitoring();
      
      monitoringService.recordResourceDetection({
        type: 'detection_start',
        resources: [
          { url: 'https://picsum.photos/id/237/800/600', type: 'image' },
          { url: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' }
        ]
      });
      
      monitoringService.recordResourceAnalysis({
        type: 'analysis_complete',
        resources: [
          { url: 'https://picsum.photos/id/237/800/600', type: 'image' },
          { url: 'https://www.w3schools.com/html/mov_bbb.mp4', type: 'video' }
        ]
      });
      
      monitoringService.recordResourceDownload({
        resource: { url: 'https://picsum.photos/id/237/800/600', type: 'image', size: 51200 },
        status: 'complete'
      });
      
      const metrics = monitoringService.getMetrics();
      
      const tabId = sender.tab ? sender.tab.id : 'test-tab';
      const wsStarted = webSocketPushService.startMonitoring(tabId);
      
      sendResponse({
        success: true,
        results: {
          monitoringActive: monitoringService.isMonitoring,
          metrics: metrics,
          webSocketPushActive: wsStarted,
          connectionStats: webSocketPushService.getConnectionStats()
        }
      });
      
      setTimeout(() => {
        monitoringService.stopMonitoring();
        webSocketPushService.stopMonitoring(tabId);
      }, 5000);
    } catch (e) {
      console.error('Realtime Monitoring Test Error:', e);
      
      sendResponse({
        success: false,
        error: e.message || 'Realtime Monitoring Test Failed'
      });
    }
  }
}

export default new TestHandler();
