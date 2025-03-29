/**
 * @file detection-service.js
 * @description 资源检测服务，管理不同的检测策略和适配网站特征
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { SOURCE_TYPES } from '../config/constants.js';

/**
 * 资源检测服务
 * @class DetectionService
 */
class DetectionService {
  /**
   * 创建检测服务实例
   */
  constructor() {
    this.detectionStrategies = {};
    this.sitePatterns = {};
    this.initDefaultStrategies();
  }
  
  /**
   * 初始化默认检测策略
   * @private
   */
  initDefaultStrategies() {
    this.detectionStrategies = {
      'standard': {
        name: '标准检测',
        priority: 10,
        sources: [SOURCE_TYPES.DOM, SOURCE_TYPES.NETWORK]
      },
      'enhanced': {
        name: '增强检测',
        priority: 20,
        sources: [SOURCE_TYPES.DOM, SOURCE_TYPES.CSS, SOURCE_TYPES.ATTRIBUTE, SOURCE_TYPES.NETWORK]
      },
      'comprehensive': {
        name: '全面检测',
        priority: 30,
        sources: [SOURCE_TYPES.DOM, SOURCE_TYPES.CSS, SOURCE_TYPES.SHADOW_DOM, 
                 SOURCE_TYPES.ATTRIBUTE, SOURCE_TYPES.NESTED, SOURCE_TYPES.STREAMING, 
                 SOURCE_TYPES.NETWORK]
      }
    };
    
    this.sitePatterns = {
      'video': {
        pattern: /(youtube|vimeo|dailymotion|netflix|hulu|bilibili)/i,
        strategy: 'comprehensive'
      },
      'image': {
        pattern: /(flickr|imgur|500px|unsplash|pexels|pixabay)/i,
        strategy: 'enhanced'
      },
      'social': {
        pattern: /(facebook|twitter|instagram|pinterest|linkedin|reddit)/i,
        strategy: 'enhanced'
      },
      'news': {
        pattern: /(cnn|bbc|nytimes|theguardian|washingtonpost|reuters)/i,
        strategy: 'standard'
      },
      'ecommerce': {
        pattern: /(amazon|ebay|aliexpress|taobao|jd|walmart|shopify)/i,
        strategy: 'enhanced'
      }
    };
  }
  
  /**
   * 根据网站URL选择最佳检测策略
   * @param {string} url - 网站URL
   * @returns {Object} - 检测策略对象
   */
  selectStrategy(url) {
    try {
      if (!url) return this.detectionStrategies.standard;
      
      const hostname = new URL(url).hostname.toLowerCase();
      
      for (const [type, sitePattern] of Object.entries(this.sitePatterns)) {
        if (sitePattern.pattern.test(hostname)) {
          return this.detectionStrategies[sitePattern.strategy];
        }
      }
      
      return this.detectionStrategies.standard;
    } catch (e) {
      console.warn('选择检测策略错误:', e);
      return this.detectionStrategies.standard;
    }
  }
  
  /**
   * 获取指定策略的检测源类型
   * @param {string} strategyName - 策略名称
   * @returns {Array} - 检测源类型数组
   */
  getDetectionSources(strategyName) {
    const strategy = this.detectionStrategies[strategyName];
    return strategy ? strategy.sources : this.detectionStrategies.standard.sources;
  }
  
  /**
   * 添加自定义检测策略
   * @param {string} name - 策略名称
   * @param {Object} strategy - 策略对象
   * @returns {boolean} - 是否成功添加
   */
  addStrategy(name, strategy) {
    if (!name || !strategy) return false;
    
    this.detectionStrategies[name] = {
      name: strategy.name || name,
      priority: strategy.priority || 0,
      sources: strategy.sources || []
    };
    
    return true;
  }
  
  /**
   * 添加网站特征匹配
   * @param {string} type - 网站类型
   * @param {RegExp} pattern - 匹配模式
   * @param {string} strategy - 策略名称
   * @returns {boolean} - 是否成功添加
   */
  addSitePattern(type, pattern, strategy) {
    if (!type || !pattern || !strategy) return false;
    if (!this.detectionStrategies[strategy]) return false;
    
    this.sitePatterns[type] = {
      pattern: pattern,
      strategy: strategy
    };
    
    return true;
  }
  
  /**
   * 分析网页内容以确定最佳检测策略
   * @param {Document} document - 网页文档对象
   * @param {string} url - 网页URL
   * @returns {Object} - 检测策略对象
   */
  analyzePageContent(document, url) {
    try {
      const urlBasedStrategy = this.selectStrategy(url);
      
      if (urlBasedStrategy !== this.detectionStrategies.standard) {
        return urlBasedStrategy;
      }
      
      const videoElements = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
      const imageElements = document.querySelectorAll('img');
      const galleryElements = document.querySelectorAll('.gallery, .slideshow, [class*="gallery"], [class*="slider"]');
      
      if (videoElements.length > 3) {
        return this.detectionStrategies.comprehensive;
      } else if (imageElements.length > 20 || galleryElements.length > 0) {
        return this.detectionStrategies.enhanced;
      }
      
      const shadowRoots = document.querySelectorAll('*').length > 0 ? 
        Array.from(document.querySelectorAll('*')).filter(el => el.shadowRoot) : [];
      
      if (shadowRoots.length > 0) {
        return this.detectionStrategies.comprehensive;
      }
      
      return this.detectionStrategies.standard;
    } catch (e) {
      console.warn('分析页面内容错误:', e);
      return this.detectionStrategies.standard;
    }
  }
  
  /**
   * 获取特定网站的自定义检测器
   * @param {string} hostname - 网站主机名
   * @returns {Object|null} - 自定义检测器对象
   */
  getCustomDetector(hostname) {
    const customDetectors = {
      'youtube.com': {
        name: 'YouTube检测器',
        detect: (document) => {
          const videoElements = document.querySelectorAll('video');
          const highQualityUrls = [];
          
          videoElements.forEach(video => {
            if (video.src) {
              highQualityUrls.push({
                url: video.src,
                type: 'video',
                quality: 'HD',
                width: video.videoWidth,
                height: video.videoHeight,
                source: 'dom'
              });
            }
          });
          
          const thumbnails = document.querySelectorAll('img[src*="ytimg.com"]');
          thumbnails.forEach(img => {
            if (img.src) {
              highQualityUrls.push({
                url: img.src,
                type: 'image',
                quality: 'SD',
                width: img.width,
                height: img.height,
                source: 'dom'
              });
            }
          });
          
          return highQualityUrls;
        }
      },
      'vimeo.com': {
        name: 'Vimeo检测器',
        detect: (document) => {
          const videoElements = document.querySelectorAll('video');
          const resources = [];
          
          videoElements.forEach(video => {
            if (video.src) {
              resources.push({
                url: video.src,
                type: 'video',
                quality: 'HD',
                width: video.videoWidth,
                height: video.videoHeight,
                source: 'dom'
              });
            }
          });
          
          return resources;
        }
      },
      'instagram.com': {
        name: 'Instagram检测器',
        detect: (document) => {
          const resources = [];
          
          document.querySelectorAll('img[srcset]').forEach(img => {
            if (img.srcset) {
              const srcsetParts = img.srcset.split(',');
              let highestQualityUrl = '';
              let highestWidth = 0;
              
              srcsetParts.forEach(part => {
                const [url, width] = part.trim().split(' ');
                const numWidth = parseInt(width);
                if (numWidth > highestWidth) {
                  highestWidth = numWidth;
                  highestQualityUrl = url;
                }
              });
              
              if (highestQualityUrl) {
                resources.push({
                  url: highestQualityUrl,
                  type: 'image',
                  quality: 'HD',
                  width: highestWidth,
                  height: Math.round(highestWidth * (img.height / img.width)),
                  source: 'dom'
                });
              }
            }
          });
          
          document.querySelectorAll('video').forEach(video => {
            if (video.src) {
              resources.push({
                url: video.src,
                type: 'video',
                quality: 'HD',
                width: video.videoWidth,
                height: video.videoHeight,
                source: 'dom'
              });
            }
          });
          
          return resources;
        }
      }
    };
    
    return customDetectors[hostname] || null;
  }
  
  /**
   * 检测页面中的资源
   * @param {Document} document - 网页文档对象
   * @param {string} url - 网页URL
   * @param {Object} options - 检测选项
   * @returns {Array} - 检测到的资源数组
   */
  detectResources(document, url, options = {}) {
    try {
      const resources = [];
      const hostname = new URL(url).hostname;
      
      const customDetector = this.getCustomDetector(hostname);
      if (customDetector) {
        const customResources = customDetector.detect(document);
        resources.push(...customResources);
      }
      
      const strategy = options.strategy || 
                      this.analyzePageContent(document, url);
      
      const sources = strategy.sources;
      
      if (sources.includes(SOURCE_TYPES.DOM)) {
        this._detectDOMResources(document, resources);
      }
      
      if (sources.includes(SOURCE_TYPES.CSS)) {
        this._detectCSSResources(document, resources);
      }
      
      if (sources.includes(SOURCE_TYPES.SHADOW_DOM)) {
        this._detectShadowDOMResources(document, resources);
      }
      
      if (sources.includes(SOURCE_TYPES.ATTRIBUTE)) {
        this._detectAttributeResources(document, resources);
      }
      
      if (sources.includes(SOURCE_TYPES.NESTED)) {
        this._detectNestedResources(document, resources);
      }
      
      return resources;
    } catch (e) {
      console.error('检测资源错误:', e);
      return [];
    }
  }
  
  /**
   * 检测DOM元素中的资源
   * @param {Document} document - 网页文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  _detectDOMResources(document, resources) {
    document.querySelectorAll('img[src]').forEach(img => {
      if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
        resources.push({
          url: img.src,
          type: 'image',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          source: SOURCE_TYPES.DOM,
          timestamp: Date.now()
        });
      }
    });
    
    document.querySelectorAll('video[src]').forEach(video => {
      if (video.src && !video.src.startsWith('data:') && !video.src.startsWith('blob:')) {
        resources.push({
          url: video.src,
          type: 'video',
          width: video.videoWidth,
          height: video.videoHeight,
          source: SOURCE_TYPES.DOM,
          timestamp: Date.now()
        });
      }
    });
    
    document.querySelectorAll('video > source[src]').forEach(source => {
      if (source.src && !source.src.startsWith('data:') && !source.src.startsWith('blob:')) {
        resources.push({
          url: source.src,
          type: 'video',
          contentType: source.type,
          source: SOURCE_TYPES.DOM,
          timestamp: Date.now()
        });
      }
    });
    
    document.querySelectorAll('audio[src]').forEach(audio => {
      if (audio.src && !audio.src.startsWith('data:') && !audio.src.startsWith('blob:')) {
        resources.push({
          url: audio.src,
          type: 'audio',
          source: SOURCE_TYPES.DOM,
          timestamp: Date.now()
        });
      }
    });
    
    document.querySelectorAll('audio > source[src]').forEach(source => {
      if (source.src && !source.src.startsWith('data:') && !source.src.startsWith('blob:')) {
        resources.push({
          url: source.src,
          type: 'audio',
          contentType: source.type,
          source: SOURCE_TYPES.DOM,
          timestamp: Date.now()
        });
      }
    });
    
    document.querySelectorAll('a[href]').forEach(link => {
      if (link.href && !link.href.startsWith('data:') && !link.href.startsWith('blob:')) {
        const href = link.href.toLowerCase();
        if (href.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/)) {
          resources.push({
            url: link.href,
            type: 'image',
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now()
          });
        } else if (href.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/)) {
          resources.push({
            url: link.href,
            type: 'video',
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now()
          });
        } else if (href.match(/\.(mp3|wav|ogg|flac)(\?.*)?$/)) {
          resources.push({
            url: link.href,
            type: 'audio',
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now()
          });
        }
      }
    });
  }
  
  /**
   * 检测CSS中的资源
   * @param {Document} document - 网页文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  _detectCSSResources(document, resources) {
    try {
      const styleSheets = Array.from(document.styleSheets);
      
      styleSheets.forEach(styleSheet => {
        try {
          if (!styleSheet.cssRules) return;
          
          const cssRules = Array.from(styleSheet.cssRules);
          
          cssRules.forEach(rule => {
            if (rule.style) {
              const backgroundImage = rule.style.backgroundImage;
              if (backgroundImage) {
                const urlMatches = backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/g);
                if (urlMatches) {
                  urlMatches.forEach(urlMatch => {
                    const url = urlMatch.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1');
                    if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
                      resources.push({
                        url: url,
                        type: 'image',
                        source: SOURCE_TYPES.CSS,
                        timestamp: Date.now()
                      });
                    }
                  });
                }
              }
              
              const urlProperties = ['borderImage', 'listStyleImage', 'content'];
              urlProperties.forEach(prop => {
                const value = rule.style[prop];
                if (value) {
                  const urlMatches = value.match(/url\(['"]?([^'"]+)['"]?\)/g);
                  if (urlMatches) {
                    urlMatches.forEach(urlMatch => {
                      const url = urlMatch.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1');
                      if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
                        resources.push({
                          url: url,
                          type: 'image',
                          source: SOURCE_TYPES.CSS,
                          timestamp: Date.now()
                        });
                      }
                    });
                  }
                }
              });
            }
            
            if (rule.href) {
              resources.push({
                url: rule.href,
                type: 'other',
                source: SOURCE_TYPES.CSS,
                timestamp: Date.now()
              });
            }
          });
        } catch (e) {
          console.warn('无法访问样式表规则:', e);
        }
      });
    } catch (e) {
      console.error('CSS资源检测错误:', e);
    }
  }
  
  /**
   * 检测Shadow DOM中的资源
   * @param {Document} document - 网页文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  _detectShadowDOMResources(document, resources) {
    try {
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(element => {
        if (element.shadowRoot) {
          this._detectDOMResources(element.shadowRoot, resources);
          this._detectCSSResources(element.shadowRoot, resources);
          
          this._detectShadowDOMResources(element.shadowRoot, resources);
        }
      });
    } catch (e) {
      console.error('Shadow DOM资源检测错误:', e);
    }
  }
  
  /**
   * 检测自定义属性中的资源
   * @param {Document} document - 网页文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  _detectAttributeResources(document, resources) {
    try {
      const allElements = document.querySelectorAll('*');
      
      const customAttributes = [
        'data-src', 'data-original', 'data-url', 'data-image',
        'data-background', 'data-poster', 'data-thumb', 'data-thumbnail',
        'data-bg', 'data-lazy', 'data-lazy-src', 'data-srcset',
        'data-high-res-src', 'data-low-res-src', 'data-video', 'data-audio'
      ];
      
      allElements.forEach(element => {
        customAttributes.forEach(attr => {
          if (element.hasAttribute(attr)) {
            const value = element.getAttribute(attr);
            if (value && !value.startsWith('data:') && !value.startsWith('blob:')) {
              let type = 'other';
              
              if (element.tagName === 'IMG' || 
                  attr.includes('image') || 
                  attr.includes('src') || 
                  attr.includes('thumb') || 
                  attr.includes('bg')) {
                type = 'image';
              } else if (element.tagName === 'VIDEO' || 
                         attr.includes('video') || 
                         attr.includes('poster')) {
                type = 'video';
              } else if (element.tagName === 'AUDIO' || 
                         attr.includes('audio')) {
                type = 'audio';
              }
              
              resources.push({
                url: value,
                type: type,
                source: SOURCE_TYPES.ATTRIBUTE,
                timestamp: Date.now()
              });
            }
          }
        });
      });
    } catch (e) {
      console.error('自定义属性资源检测错误:', e);
    }
  }
  
  /**
   * 检测嵌套资源
   * @param {Document} document - 网页文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  _detectNestedResources(document, resources) {
    try {
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          const iframeDocument = iframe.contentDocument;
          
          if (iframeDocument) {
            this._detectDOMResources(iframeDocument, resources);
            this._detectCSSResources(iframeDocument, resources);
            this._detectShadowDOMResources(iframeDocument, resources);
            this._detectAttributeResources(iframeDocument, resources);
          }
        } catch (e) {
          console.warn('无法访问iframe内容:', e);
        }
      });
      
      document.querySelectorAll('object[data], embed[src]').forEach(element => {
        const url = element.data || element.src;
        if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
          resources.push({
            url: url,
            type: 'other',
            source: SOURCE_TYPES.NESTED,
            timestamp: Date.now()
          });
        }
      });
    } catch (e) {
      console.error('嵌套资源检测错误:', e);
    }
  }
}

export default DetectionService;
