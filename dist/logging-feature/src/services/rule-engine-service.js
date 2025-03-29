/**
 * @file rule-engine-service.js
 * @description 启发式规则引擎服务，根据URL模式和DOM结构动态调整检测策略
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../config/constants.js';

/**
 * 启发式规则引擎服务
 * @class RuleEngineService
 */
class RuleEngineService {
  /**
   * 创建规则引擎服务实例
   */
  constructor() {
    this.rules = [];
    this.sitePatterns = new Map();
    this.domainRules = new Map();
    this.initialized = false;
    
    this._initDefaultRules();
  }
  
  /**
   * 初始化默认规则
   * @private
   */
  _initDefaultRules() {
    this.rules = [
      {
        id: 'general-image-rule',
        name: '通用图片规则',
        priority: 10,
        condition: (context) => context.resourceType === RESOURCE_TYPES.IMAGE,
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['dom', 'css', 'attribute'],
          processingPriority: 'high'
        })
      },
      {
        id: 'general-video-rule',
        name: '通用视频规则',
        priority: 10,
        condition: (context) => context.resourceType === RESOURCE_TYPES.VIDEO,
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['dom', 'streaming'],
          processingPriority: 'high'
        })
      },
      {
        id: 'large-page-optimization',
        name: '大型页面优化',
        priority: 20,
        condition: (context) => context.domInfo && context.domInfo.elementCount > 1000,
        action: (context) => ({
          shouldProcess: true,
          useDistributedProcessing: true,
          batchSize: 200,
          processingPriority: 'medium'
        })
      },
      {
        id: 'image-gallery-optimization',
        name: '图片库优化',
        priority: 30,
        condition: (context) => {
          return context.domInfo && 
                 context.domInfo.imageCount > 20 && 
                 (context.domInfo.imageCount / context.domInfo.elementCount) > 0.1;
        },
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['dom', 'css', 'attribute', 'shadow'],
          useDeduplication: true,
          usePrediction: true,
          processingPriority: 'high'
        })
      },
      {
        id: 'video-site-optimization',
        name: '视频网站优化',
        priority: 30,
        condition: (context) => {
          return context.domInfo && 
                 (context.domInfo.videoCount > 0 || 
                  context.url.includes('video') || 
                  context.url.includes('watch'));
        },
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['dom', 'streaming', 'attribute'],
          useStreamingDetection: true,
          processingPriority: 'high'
        })
      },
      {
        id: 'social-media-optimization',
        name: '社交媒体优化',
        priority: 40,
        condition: (context) => {
          const domain = this._extractDomain(context.url);
          return domain.includes('instagram') || 
                 domain.includes('twitter') || 
                 domain.includes('facebook') || 
                 domain.includes('weibo') ||
                 domain.includes('tiktok') ||
                 domain.includes('pinterest');
        },
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['dom', 'shadow', 'attribute'],
          useDeduplication: true,
          usePrediction: true,
          processingPriority: 'high',
          monitorDynamicContent: true
        })
      },
      {
        id: 'e-commerce-optimization',
        name: '电商网站优化',
        priority: 40,
        condition: (context) => {
          const domain = this._extractDomain(context.url);
          return domain.includes('amazon') || 
                 domain.includes('ebay') || 
                 domain.includes('taobao') || 
                 domain.includes('tmall') ||
                 domain.includes('jd') ||
                 domain.includes('shopify') ||
                 domain.includes('shop');
        },
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['dom', 'css', 'attribute'],
          useDeduplication: true,
          usePrediction: true,
          processingPriority: 'medium',
          focusOnHighQuality: true
        })
      },
      {
        id: 'news-site-optimization',
        name: '新闻网站优化',
        priority: 40,
        condition: (context) => {
          const domain = this._extractDomain(context.url);
          return domain.includes('news') || 
                 domain.includes('cnn') || 
                 domain.includes('bbc') || 
                 domain.includes('nytimes') ||
                 domain.includes('guardian') ||
                 domain.includes('sina') ||
                 domain.includes('sohu');
        },
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['dom', 'css'],
          useDeduplication: true,
          processingPriority: 'medium'
        })
      },
      {
        id: 'spa-optimization',
        name: 'SPA应用优化',
        priority: 50,
        condition: (context) => {
          return context.domInfo && 
                 context.domInfo.hasShadowDOM && 
                 (context.url.includes('app') || context.url.includes('spa'));
        },
        action: (context) => ({
          shouldProcess: true,
          detectionMethods: ['shadow', 'dom', 'attribute'],
          monitorDynamicContent: true,
          processingPriority: 'high'
        })
      }
    ];
    
    this.sitePatterns.set('youtube.com', {
      id: 'youtube-rule',
      name: 'YouTube优化',
      priority: 100,
      detectionMethods: ['streaming', 'dom'],
      useStreamingDetection: true,
      processingPriority: 'high',
      monitorDynamicContent: true
    });
    
    this.sitePatterns.set('vimeo.com', {
      id: 'vimeo-rule',
      name: 'Vimeo优化',
      priority: 100,
      detectionMethods: ['streaming', 'dom'],
      useStreamingDetection: true,
      processingPriority: 'high'
    });
    
    this.sitePatterns.set('netflix.com', {
      id: 'netflix-rule',
      name: 'Netflix优化',
      priority: 100,
      detectionMethods: ['streaming'],
      useStreamingDetection: true,
      processingPriority: 'high'
    });
    
    this.sitePatterns.set('bilibili.com', {
      id: 'bilibili-rule',
      name: 'Bilibili优化',
      priority: 100,
      detectionMethods: ['streaming', 'dom'],
      useStreamingDetection: true,
      processingPriority: 'high',
      monitorDynamicContent: true
    });
    
    this.sitePatterns.set('flickr.com', {
      id: 'flickr-rule',
      name: 'Flickr优化',
      priority: 100,
      detectionMethods: ['dom', 'css', 'attribute'],
      useDeduplication: true,
      processingPriority: 'high',
      focusOnHighQuality: true
    });
    
    this.sitePatterns.set('500px.com', {
      id: '500px-rule',
      name: '500px优化',
      priority: 100,
      detectionMethods: ['dom', 'css', 'attribute'],
      useDeduplication: true,
      processingPriority: 'high',
      focusOnHighQuality: true
    });
    
    this.sitePatterns.set('unsplash.com', {
      id: 'unsplash-rule',
      name: 'Unsplash优化',
      priority: 100,
      detectionMethods: ['dom', 'css', 'attribute'],
      useDeduplication: true,
      processingPriority: 'high',
      focusOnHighQuality: true
    });
    
    this.initialized = true;
  }
  
  /**
   * 添加自定义规则
   * @param {Object} rule - 规则对象
   * @returns {boolean} - 是否成功添加
   */
  addRule(rule) {
    if (!rule || !rule.id || !rule.condition || !rule.action) {
      console.warn('规则格式无效');
      return false;
    }
    
    const existingRuleIndex = this.rules.findIndex(r => r.id === rule.id);
    if (existingRuleIndex !== -1) {
      this.rules[existingRuleIndex] = rule;
    } else {
      this.rules.push(rule);
    }
    
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return true;
  }
  
  /**
   * 添加网站特定规则
   * @param {string} domain - 域名
   * @param {Object} rule - 规则对象
   * @returns {boolean} - 是否成功添加
   */
  addSiteRule(domain, rule) {
    if (!domain || !rule) {
      console.warn('网站规则参数无效');
      return false;
    }
    
    this.sitePatterns.set(domain.toLowerCase(), rule);
    return true;
  }
  
  /**
   * 评估上下文并应用规则
   * @param {Object} context - 上下文对象
   * @returns {Object} - 规则评估结果
   */
  evaluateRules(context) {
    if (!context || !context.url) {
      return {
        shouldProcess: true,
        detectionMethods: ['dom', 'css', 'attribute'],
        processingPriority: 'medium'
      };
    }
    
    const defaultConfig = {
      shouldProcess: true,
      detectionMethods: ['dom', 'css', 'attribute'],
      useDeduplication: false,
      usePrediction: false,
      useStreamingDetection: false,
      monitorDynamicContent: false,
      processingPriority: 'medium',
      focusOnHighQuality: false
    };
    
    const domain = this._extractDomain(context.url);
    let config = { ...defaultConfig };
    
    for (const [siteDomain, siteRule] of this.sitePatterns.entries()) {
      if (domain.includes(siteDomain)) {
        config = { ...config, ...siteRule };
        break;
      }
    }
    
    for (const rule of this.rules) {
      try {
        if (rule.condition(context)) {
          const ruleResult = rule.action(context);
          config = { ...config, ...ruleResult };
        }
      } catch (e) {
        console.warn(`规则评估错误 (${rule.id}):`, e);
      }
    }
    
    return config;
  }
  
  /**
   * 从URL提取域名
   * @param {string} url - URL字符串
   * @returns {string} - 域名
   * @private
   */
  _extractDomain(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.toLowerCase();
    } catch (e) {
      return url.toLowerCase();
    }
  }
  
  /**
   * 获取页面上下文
   * @param {Object} data - 页面数据
   * @returns {Object} - 页面上下文
   */
  getPageContext(data) {
    const { url, documentInfo } = data;
    
    if (!url) {
      return { url: '', domInfo: null };
    }
    
    const context = {
      url,
      timestamp: Date.now(),
      domInfo: null
    };
    
    if (documentInfo) {
      context.domInfo = {
        title: documentInfo.title || '',
        elementCount: documentInfo.elementCount || 0,
        imageCount: documentInfo.imageCount || 0,
        videoCount: documentInfo.videoCount || 0,
        audioCount: documentInfo.audioCount || 0,
        iframeCount: documentInfo.iframeCount || 0,
        hasShadowDOM: documentInfo.hasShadowDOM || false
      };
      
      if (context.domInfo.imageCount > 20 && context.domInfo.imageCount > context.domInfo.videoCount * 5) {
        context.pageType = 'image-gallery';
      } else if (context.domInfo.videoCount > 0 || url.includes('video') || url.includes('watch')) {
        context.pageType = 'video-site';
      } else if (url.includes('news') || url.includes('article')) {
        context.pageType = 'news';
      } else if (url.includes('shop') || url.includes('product') || url.includes('store')) {
        context.pageType = 'e-commerce';
      }
    }
    
    return context;
  }
  
  /**
   * 获取资源处理策略
   * @param {Object} resource - 资源对象
   * @param {Object} pageContext - 页面上下文
   * @returns {Object} - 处理策略
   */
  getResourceStrategy(resource, pageContext) {
    if (!resource || !resource.url) {
      return { shouldProcess: true, priority: 'medium' };
    }
    
    const context = {
      ...pageContext,
      resourceType: resource.type || RESOURCE_TYPES.OTHER,
      resourceUrl: resource.url,
      resourceSize: resource.size,
      resourceDimensions: resource.width && resource.height ? { width: resource.width, height: resource.height } : null
    };
    
    const ruleResult = this.evaluateRules(context);
    
    const strategy = {
      shouldProcess: ruleResult.shouldProcess,
      priority: ruleResult.processingPriority || 'medium',
      useDeduplication: ruleResult.useDeduplication || false,
      usePrediction: ruleResult.usePrediction || false
    };
    
    if (resource.type === RESOURCE_TYPES.IMAGE) {
      if (resource.width && resource.height) {
        const pixels = resource.width * resource.height;
        if (pixels > 1000000) { // 1MP以上
          strategy.priority = 'high';
        } else if (pixels < 10000) { // 小图标
          strategy.priority = 'low';
        }
      }
      
      if (resource.url.includes('thumb') || resource.url.includes('icon') || resource.url.includes('small')) {
        strategy.priority = 'low';
      }
      
      if (resource.url.includes('original') || resource.url.includes('large') || resource.url.includes('full')) {
        strategy.priority = 'high';
      }
    } else if (resource.type === RESOURCE_TYPES.VIDEO) {
      strategy.priority = 'high';
    }
    
    return strategy;
  }
}

export default RuleEngineService;
