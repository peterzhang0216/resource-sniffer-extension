/**
 * @file rule-engine.js
 * @description 启发式规则引擎，根据URL模式和DOM结构动态调整检测策略
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 规则引擎服务
 * @class RuleEngineService
 */
class RuleEngineService {
  /**
   * 创建规则引擎服务实例
   */
  constructor() {
    this.rules = [];
    this.sitePatterns = new Map();
    this.domPatterns = new Map();
    this.urlPatterns = new Map();
    this.registerDefaultRules();
  }
  
  /**
   * 注册默认规则
   * @private
   */
  registerDefaultRules() {
    this.registerSitePattern('image-gallery', {
      hostPatterns: [
        /flickr\.com$/i,
        /imgur\.com$/i,
        /500px\.com$/i,
        /unsplash\.com$/i,
        /pexels\.com$/i,
        /pixabay\.com$/i,
        /shutterstock\.com$/i,
        /gettyimages\.com$/i,
        /instagram\.com$/i,
        /pinterest\.com$/i
      ],
      pathPatterns: [
        /\/photos?\//i,
        /\/images?\//i,
        /\/gallery\//i,
        /\/albums?\//i
      ],
      metaPatterns: [
        { name: 'keywords', value: /(photo|image|picture|gallery)/i },
        { property: 'og:type', value: /(image|photo)/i }
      ],
      domPatterns: [
        { selector: 'img[src*="original"], img[src*="large"], img[src*="full"]', minCount: 1 },
        { selector: '.gallery, .photos, .images', minCount: 1 }
      ],
      rules: [
        { action: 'prioritize', resourceType: 'image', score: 20 },
        { action: 'deepScan', resourceType: 'image', enabled: true },
        { action: 'qualityThreshold', resourceType: 'image', minWidth: 800, minHeight: 600 }
      ]
    });
    
    this.registerSitePattern('video-site', {
      hostPatterns: [
        /youtube\.com$/i,
        /vimeo\.com$/i,
        /dailymotion\.com$/i,
        /twitch\.tv$/i,
        /netflix\.com$/i,
        /hulu\.com$/i,
        /bilibili\.com$/i,
        /tiktok\.com$/i
      ],
      pathPatterns: [
        /\/watch\//i,
        /\/video\//i,
        /\/movies?\//i,
        /\/player\//i
      ],
      metaPatterns: [
        { name: 'keywords', value: /(video|movie|stream)/i },
        { property: 'og:type', value: /(video)/i }
      ],
      domPatterns: [
        { selector: 'video, .video-player, [data-video-id]', minCount: 1 }
      ],
      rules: [
        { action: 'prioritize', resourceType: 'video', score: 20 },
        { action: 'deepScan', resourceType: 'video', enabled: true },
        { action: 'scanStreaming', enabled: true },
        { action: 'qualityThreshold', resourceType: 'video', minWidth: 640, minHeight: 360 }
      ]
    });
    
    this.registerSitePattern('social-media', {
      hostPatterns: [
        /facebook\.com$/i,
        /twitter\.com$/i,
        /instagram\.com$/i,
        /linkedin\.com$/i,
        /reddit\.com$/i,
        /weibo\.com$/i,
        /vk\.com$/i
      ],
      rules: [
        { action: 'scanDynamicContent', enabled: true },
        { action: 'scanShadowDOM', enabled: true },
        { action: 'scanAjaxRequests', enabled: true }
      ]
    });
    
    this.registerSitePattern('news-site', {
      hostPatterns: [
        /news\./i,
        /cnn\.com$/i,
        /bbc\./i,
        /nytimes\.com$/i,
        /washingtonpost\.com$/i,
        /theguardian\.com$/i,
        /reuters\.com$/i
      ],
      metaPatterns: [
        { name: 'keywords', value: /(news|article)/i },
        { property: 'og:type', value: /(article)/i }
      ],
      rules: [
        { action: 'scanLazyLoaded', enabled: true },
        { action: 'scanInlineStyles', enabled: true }
      ]
    });
    
    this.registerSitePattern('e-commerce', {
      hostPatterns: [
        /amazon\./i,
        /ebay\./i,
        /walmart\.com$/i,
        /aliexpress\.com$/i,
        /etsy\.com$/i,
        /shopify\.com$/i,
        /shop\./i,
        /store\./i
      ],
      metaPatterns: [
        { name: 'keywords', value: /(shop|product|store)/i },
        { property: 'og:type', value: /(product)/i }
      ],
      domPatterns: [
        { selector: '.product, .item, [data-product-id]', minCount: 1 }
      ],
      rules: [
        { action: 'prioritize', resourceType: 'image', score: 10 },
        { action: 'scanProductImages', enabled: true },
        { action: 'qualityThreshold', resourceType: 'image', minWidth: 500, minHeight: 500 }
      ]
    });
    
    this.registerDOMPattern('image-gallery-dom', {
      conditions: [
        { selector: '.gallery, .photos, .album', minCount: 1 },
        { selector: 'img', minCount: 5 }
      ],
      rules: [
        { action: 'prioritize', resourceType: 'image', score: 15 },
        { action: 'scanSrcSet', enabled: true },
        { action: 'scanBackgroundImages', enabled: true }
      ]
    });
    
    this.registerDOMPattern('video-player-dom', {
      conditions: [
        { selector: 'video, .video-player, [data-video-id]', minCount: 1 }
      ],
      rules: [
        { action: 'prioritize', resourceType: 'video', score: 15 },
        { action: 'scanStreaming', enabled: true },
        { action: 'scanVideoSources', enabled: true }
      ]
    });
    
    this.registerDOMPattern('carousel-dom', {
      conditions: [
        { selector: '.carousel, .slider, .slideshow', minCount: 1 }
      ],
      rules: [
        { action: 'scanLazyLoaded', enabled: true },
        { action: 'scanBackgroundImages', enabled: true },
        { action: 'scanDataAttributes', enabled: true }
      ]
    });
    
    this.registerURLPattern('image-url', {
      patterns: [
        /\.(jpe?g|png|gif|webp|svg)(\?.*)?$/i,
        /\/images?\//i,
        /\/photos?\//i,
        /\/thumbnails?\//i,
        /\/gallery\//i
      ],
      rules: [
        { action: 'prioritize', resourceType: 'image', score: 10 },
        { action: 'findHighResVersions', enabled: true }
      ]
    });
    
    this.registerURLPattern('video-url', {
      patterns: [
        /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i,
        /\/videos?\//i,
        /\/movies?\//i,
        /\/watch\//i,
        /\/player\//i
      ],
      rules: [
        { action: 'prioritize', resourceType: 'video', score: 10 },
        { action: 'findHighQualityVersions', enabled: true }
      ]
    });
    
    this.registerURLPattern('streaming-url', {
      patterns: [
        /\.(m3u8|mpd)(\?.*)?$/i,
        /\/hls\//i,
        /\/dash\//i,
        /\/streaming\//i,
        /\/manifest\//i
      ],
      rules: [
        { action: 'prioritize', resourceType: 'video', score: 15 },
        { action: 'scanStreaming', enabled: true },
        { action: 'parseManifest', enabled: true }
      ]
    });
  }
  
  /**
   * 注册站点模式
   * @param {string} id - 模式ID
   * @param {Object} pattern - 模式对象
   */
  registerSitePattern(id, pattern) {
    if (!id || !pattern) return;
    
    this.sitePatterns.set(id, pattern);
    console.log(`站点模式已注册: ${id}`);
  }
  
  /**
   * 注册DOM模式
   * @param {string} id - 模式ID
   * @param {Object} pattern - 模式对象
   */
  registerDOMPattern(id, pattern) {
    if (!id || !pattern) return;
    
    this.domPatterns.set(id, pattern);
    console.log(`DOM模式已注册: ${id}`);
  }
  
  /**
   * 注册URL模式
   * @param {string} id - 模式ID
   * @param {Object} pattern - 模式对象
   */
  registerURLPattern(id, pattern) {
    if (!id || !pattern) return;
    
    this.urlPatterns.set(id, pattern);
    console.log(`URL模式已注册: ${id}`);
  }
  
  /**
   * 分析页面并应用规则
   * @param {Object} pageContext - 页面上下文
   * @returns {Object} 应用的规则
   */
  analyzePageAndApplyRules(pageContext) {
    if (!pageContext) return { rules: [] };
    
    const appliedRules = [];
    const detectionConfig = {
      deepScan: false,
      scanStreaming: false,
      scanShadowDOM: false,
      scanLazyLoaded: false,
      scanBackgroundImages: false,
      scanInlineStyles: false,
      scanDataAttributes: false,
      scanDynamicContent: false,
      scanAjaxRequests: false,
      scanSrcSet: false,
      scanVideoSources: false,
      scanProductImages: false,
      findHighResVersions: false,
      findHighQualityVersions: false,
      parseManifest: false,
      prioritizedTypes: {},
      qualityThresholds: {}
    };
    
    if (pageContext.url) {
      try {
        const url = new URL(pageContext.url);
        const hostname = url.hostname;
        const pathname = url.pathname;
        
        for (const [id, pattern] of this.sitePatterns.entries()) {
          let matchesHost = false;
          let matchesPath = false;
          let matchesMeta = false;
          let matchesDOM = false;
          
          if (pattern.hostPatterns && Array.isArray(pattern.hostPatterns)) {
            for (const hostPattern of pattern.hostPatterns) {
              if (hostPattern.test(hostname)) {
                matchesHost = true;
                break;
              }
            }
          }
          
          if (pattern.pathPatterns && Array.isArray(pattern.pathPatterns)) {
            for (const pathPattern of pattern.pathPatterns) {
              if (pathPattern.test(pathname)) {
                matchesPath = true;
                break;
              }
            }
          }
          
          if (pattern.metaPatterns && Array.isArray(pattern.metaPatterns) && pageContext.meta) {
            let metaMatches = 0;
            for (const metaPattern of pattern.metaPatterns) {
              if (metaPattern.name && pageContext.meta[metaPattern.name]) {
                if (metaPattern.value.test(pageContext.meta[metaPattern.name])) {
                  metaMatches++;
                }
              } else if (metaPattern.property && pageContext.meta[metaPattern.property]) {
                if (metaPattern.value.test(pageContext.meta[metaPattern.property])) {
                  metaMatches++;
                }
              }
            }
            
            if (metaMatches > 0) {
              matchesMeta = true;
            }
          }
          
          if (pattern.domPatterns && Array.isArray(pattern.domPatterns) && pageContext.domInfo) {
            let domMatches = 0;
            for (const domPattern of pattern.domPatterns) {
              const selector = domPattern.selector;
              const minCount = domPattern.minCount || 1;
              
              if (pageContext.domInfo[selector] && pageContext.domInfo[selector] >= minCount) {
                domMatches++;
              }
            }
            
            if (domMatches > 0) {
              matchesDOM = true;
            }
          }
          
          if (matchesHost && (matchesPath || matchesMeta || matchesDOM)) {
            if (pattern.rules && Array.isArray(pattern.rules)) {
              for (const rule of pattern.rules) {
                this.applyRule(rule, detectionConfig);
                appliedRules.push({
                  id: id,
                  type: 'site',
                  rule: rule,
                  matchedHost: matchesHost,
                  matchedPath: matchesPath,
                  matchedMeta: matchesMeta,
                  matchedDOM: matchesDOM
                });
              }
            }
          }
        }
        
        for (const [id, pattern] of this.urlPatterns.entries()) {
          if (pattern.patterns && Array.isArray(pattern.patterns)) {
            for (const urlPattern of pattern.patterns) {
              if (urlPattern.test(pageContext.url)) {
                if (pattern.rules && Array.isArray(pattern.rules)) {
                  for (const rule of pattern.rules) {
                    this.applyRule(rule, detectionConfig);
                    appliedRules.push({
                      id: id,
                      type: 'url',
                      rule: rule,
                      matchedPattern: urlPattern.toString()
                    });
                  }
                }
                break;
              }
            }
          }
        }
      } catch (e) {
        console.warn('URL分析错误:', e);
      }
    }
    
    if (pageContext.domInfo) {
      for (const [id, pattern] of this.domPatterns.entries()) {
        if (pattern.conditions && Array.isArray(pattern.conditions)) {
          let allConditionsMet = true;
          
          for (const condition of pattern.conditions) {
            const selector = condition.selector;
            const minCount = condition.minCount || 1;
            
            if (!pageContext.domInfo[selector] || pageContext.domInfo[selector] < minCount) {
              allConditionsMet = false;
              break;
            }
          }
          
          if (allConditionsMet && pattern.rules && Array.isArray(pattern.rules)) {
            for (const rule of pattern.rules) {
              this.applyRule(rule, detectionConfig);
              appliedRules.push({
                id: id,
                type: 'dom',
                rule: rule
              });
            }
          }
        }
      }
    }
    
    return {
      rules: appliedRules,
      config: detectionConfig
    };
  }
  
  /**
   * 应用规则
   * @private
   * @param {Object} rule - 规则对象
   * @param {Object} config - 配置对象
   */
  applyRule(rule, config) {
    if (!rule || !rule.action) return;
    
    switch (rule.action) {
      case 'prioritize':
        if (rule.resourceType && rule.score) {
          config.prioritizedTypes[rule.resourceType] = Math.max(
            config.prioritizedTypes[rule.resourceType] || 0,
            rule.score
          );
        }
        break;
        
      case 'qualityThreshold':
        if (rule.resourceType) {
          config.qualityThresholds[rule.resourceType] = config.qualityThresholds[rule.resourceType] || {};
          
          if (rule.minWidth) {
            config.qualityThresholds[rule.resourceType].minWidth = Math.max(
              config.qualityThresholds[rule.resourceType].minWidth || 0,
              rule.minWidth
            );
          }
          
          if (rule.minHeight) {
            config.qualityThresholds[rule.resourceType].minHeight = Math.max(
              config.qualityThresholds[rule.resourceType].minHeight || 0,
              rule.minHeight
            );
          }
          
          if (rule.minSize) {
            config.qualityThresholds[rule.resourceType].minSize = Math.max(
              config.qualityThresholds[rule.resourceType].minSize || 0,
              rule.minSize
            );
          }
        }
        break;
        
      default:
        if (rule.enabled === true && typeof config[rule.action] === 'boolean') {
          config[rule.action] = true;
        }
        break;
    }
  }
  
  /**
   * 提取页面上下文
   * @param {Object} data - 页面数据
   * @returns {Object} 页面上下文
   */
  extractPageContext(data) {
    const context = {
      url: data.url || '',
      title: data.title || '',
      meta: {},
      domInfo: {}
    };
    
    if (data.meta && typeof data.meta === 'object') {
      context.meta = data.meta;
    }
    
    if (data.domInfo && typeof data.domInfo === 'object') {
      context.domInfo = data.domInfo;
    } else if (data.document) {
      try {
        const selectors = [
          'img',
          'video',
          '.gallery',
          '.photos',
          '.album',
          '.video-player',
          '[data-video-id]',
          '.carousel',
          '.slider',
          '.slideshow',
          '.product',
          '.item',
          '[data-product-id]'
        ];
        
        for (const selector of selectors) {
          const elements = data.document.querySelectorAll(selector);
          context.domInfo[selector] = elements.length;
        }
      } catch (e) {
        console.warn('DOM信息提取错误:', e);
      }
    }
    
    return context;
  }
  
  /**
   * 应用质量阈值过滤
   * @param {Array} resources - 资源数组
   * @param {Object} config - 配置对象
   * @returns {Array} 过滤后的资源
   */
  applyQualityThresholds(resources, config) {
    if (!resources || !Array.isArray(resources) || !config || !config.qualityThresholds) {
      return resources;
    }
    
    return resources.filter(resource => {
      const type = resource.type;
      const thresholds = config.qualityThresholds[type];
      
      if (!thresholds) return true;
      
      if (thresholds.minWidth && resource.width && resource.width < thresholds.minWidth) {
        return false;
      }
      
      if (thresholds.minHeight && resource.height && resource.height < thresholds.minHeight) {
        return false;
      }
      
      if (thresholds.minSize && resource.size && resource.size < thresholds.minSize) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * 应用优先级排序
   * @param {Array} resources - 资源数组
   * @param {Object} config - 配置对象
   * @returns {Array} 排序后的资源
   */
  applyPriorityScoring(resources, config) {
    if (!resources || !Array.isArray(resources) || !config || !config.prioritizedTypes) {
      return resources;
    }
    
    resources.forEach(resource => {
      const type = resource.type;
      const priorityScore = config.prioritizedTypes[type] || 0;
      
      if (priorityScore > 0) {
        resource.score = (resource.score || 50) + priorityScore;
      }
    });
    
    return resources.sort((a, b) => (b.score || 0) - (a.score || 0));
  }
}

const ruleEngineService = new RuleEngineService();

export default ruleEngineService;
