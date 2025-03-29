/**
 * @file attribute-detector.js
 * @description 自定义属性资源检测器，用于从元素的自定义属性中提取媒体资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../../config/constants.js';
import URLUtils from '../../utils/url-utils.js';

/**
 * 自定义属性资源检测器
 * @class AttributeDetector
 */
class AttributeDetector {
  /**
   * 从元素的自定义属性中提取资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static extractResources(document) {
    const resources = [];
    
    try {
      const allElements = document.querySelectorAll('*');
      
      const customAttributes = [
        'data-src', 'data-original', 'data-url', 'data-image',
        'data-background', 'data-poster', 'data-thumb', 'data-thumbnail',
        'data-bg', 'data-lazy', 'data-lazy-src', 'data-srcset',
        'data-high-res-src', 'data-low-res-src', 'data-video', 'data-audio',
        'data-original-src', 'data-large', 'data-medium', 'data-small',
        'data-full', 'data-hd', 'data-sd', 'data-source', 'data-img',
        'data-cover', 'data-bg-src', 'data-fallback', 'data-webp',
        'data-mp4', 'data-webm', 'data-ogg', 'data-preview'
      ];
      
      allElements.forEach(element => {
        this._checkCommonAttributes(element, customAttributes, resources);
        
        this._checkAllDataAttributes(element, resources);
        
        this._checkLazyLoadAttributes(element, resources);
        
        this._checkImageSetAttributes(element, resources);
      });
      
      return resources;
    } catch (e) {
      console.error('自定义属性资源检测错误:', e);
      return resources;
    }
  }
  
  /**
   * 检查常见自定义属性
   * @param {Element} element - 元素对象
   * @param {Array} attributes - 属性名数组
   * @param {Array} resources - 资源数组
   * @private
   */
  static _checkCommonAttributes(element, attributes, resources) {
    try {
      attributes.forEach(attr => {
        if (element.hasAttribute(attr)) {
          const value = element.getAttribute(attr);
          if (value && !value.startsWith('data:') && !value.startsWith('blob:') && !value.startsWith('javascript:')) {
            let type = RESOURCE_TYPES.OTHER;
            
            if (element.tagName === 'IMG' || 
                attr.includes('image') || 
                attr.includes('src') || 
                attr.includes('thumb') || 
                attr.includes('bg') ||
                attr.includes('img') ||
                attr.includes('cover') ||
                attr.includes('webp')) {
              type = RESOURCE_TYPES.IMAGE;
            } else if (element.tagName === 'VIDEO' || 
                       attr.includes('video') || 
                       attr.includes('poster') ||
                       attr.includes('mp4') ||
                       attr.includes('webm') ||
                       attr.includes('ogg')) {
              type = RESOURCE_TYPES.VIDEO;
            } else if (element.tagName === 'AUDIO' || 
                       attr.includes('audio')) {
              type = RESOURCE_TYPES.AUDIO;
            }
            
            try {
              const absoluteUrl = new URL(value, window.location.href).href;
              
              resources.push({
                url: absoluteUrl,
                type: type,
                source: SOURCE_TYPES.ATTRIBUTE,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(absoluteUrl) || 'attribute-resource',
                quality: this._estimateQualityFromAttribute(attr, value)
              });
            } catch (e) {
              console.warn('无效URL:', value, e);
            }
          }
        }
      });
    } catch (e) {
      console.warn('检查常见自定义属性错误:', e);
    }
  }
  
  /**
   * 检查所有data-*属性
   * @param {Element} element - 元素对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _checkAllDataAttributes(element, resources) {
    try {
      const dataAttributes = Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-'));
      
      dataAttributes.forEach(attr => {
        const value = attr.value;
        
        if (value && 
            !value.startsWith('data:') && 
            !value.startsWith('blob:') && 
            !value.startsWith('javascript:') &&
            !value.startsWith('#') &&
            !value.startsWith('{') &&
            value.length > 5) {
          
          if (this._looksLikeUrl(value)) {
            try {
              const absoluteUrl = new URL(value, window.location.href).href;
              
              let type = RESOURCE_TYPES.OTHER;
              
              if (absoluteUrl.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i)) {
                type = RESOURCE_TYPES.IMAGE;
              } else if (absoluteUrl.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv)(\?.*)?$/i)) {
                type = RESOURCE_TYPES.VIDEO;
              } else if (absoluteUrl.match(/\.(mp3|wav|ogg|flac|aac|m4a)(\?.*)?$/i)) {
                type = RESOURCE_TYPES.AUDIO;
              }
              
              resources.push({
                url: absoluteUrl,
                type: type,
                source: SOURCE_TYPES.ATTRIBUTE,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(absoluteUrl) || 'data-attribute-resource',
                quality: this._estimateQualityFromAttribute(attr.name, value)
              });
            } catch (e) {
            }
          }
        }
      });
    } catch (e) {
      console.warn('检查所有data-*属性错误:', e);
    }
  }
  
  /**
   * 检查懒加载库常用属性
   * @param {Element} element - 元素对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _checkLazyLoadAttributes(element, resources) {
    try {
      const lazyAttributes = [
        'data-lazy',
        'data-original',
        'data-src', 'data-srcset', 'data-background-image',
        'data-src', 'data-loader',
        'data-src',
        'data-echo',
        'data-src', 'data-srcset',
        'data-srcset', 'data-sizes', 'data-src', 'data-bg'
      ];
      
      this._checkCommonAttributes(element, lazyAttributes, resources);
      
      if (element.tagName === 'NOSCRIPT') {
        const content = element.textContent || element.innerHTML;
        if (content) {
          const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
          let match;
          
          while ((match = imgRegex.exec(content)) !== null) {
            const url = match[1];
            if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
              try {
                const absoluteUrl = new URL(url, window.location.href).href;
                
                resources.push({
                  url: absoluteUrl,
                  type: RESOURCE_TYPES.IMAGE,
                  source: SOURCE_TYPES.ATTRIBUTE,
                  timestamp: Date.now(),
                  filename: URLUtils.getFileName(absoluteUrl) || 'noscript-image',
                  quality: 'unknown'
                });
              } catch (e) {
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('检查懒加载属性错误:', e);
    }
  }
  
  /**
   * 检查图片集属性
   * @param {Element} element - 元素对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _checkImageSetAttributes(element, resources) {
    try {
      if (element.hasAttribute('srcset')) {
        const srcset = element.getAttribute('srcset');
        if (srcset) {
          const srcsetUrls = this._parseSrcset(srcset);
          
          srcsetUrls.forEach(item => {
            try {
              const absoluteUrl = new URL(item.url, window.location.href).href;
              
              resources.push({
                url: absoluteUrl,
                type: RESOURCE_TYPES.IMAGE,
                width: item.width || 0,
                source: SOURCE_TYPES.ATTRIBUTE,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(absoluteUrl) || 'srcset-image',
                quality: item.width > 1000 ? 'HD' : (item.width > 500 ? 'SD' : 'LD')
              });
            } catch (e) {
            }
          });
        }
      }
      
      const jsonAttributes = [
        'data-images', 'data-gallery', 'data-pictures', 'data-slides',
        'data-sources', 'data-media', 'data-photos', 'data-items'
      ];
      
      jsonAttributes.forEach(attr => {
        if (element.hasAttribute(attr)) {
          const value = element.getAttribute(attr);
          if (value && value.startsWith('[') && value.endsWith(']')) {
            try {
              const jsonData = JSON.parse(value);
              
              if (Array.isArray(jsonData)) {
                jsonData.forEach(item => {
                  let url = null;
                  
                  if (typeof item === 'string') {
                    url = item;
                  } else if (typeof item === 'object') {
                    const urlFields = ['url', 'src', 'source', 'path', 'href', 'link', 'image', 'img'];
                    
                    for (const field of urlFields) {
                      if (item[field] && typeof item[field] === 'string') {
                        url = item[field];
                        break;
                      }
                    }
                  }
                  
                  if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
                    try {
                      const absoluteUrl = new URL(url, window.location.href).href;
                      
                      resources.push({
                        url: absoluteUrl,
                        type: RESOURCE_TYPES.IMAGE,
                        source: SOURCE_TYPES.ATTRIBUTE,
                        timestamp: Date.now(),
                        filename: URLUtils.getFileName(absoluteUrl) || 'json-image',
                        quality: 'unknown'
                      });
                    } catch (e) {
                    }
                  }
                });
              }
            } catch (e) {
            }
          }
        }
      });
    } catch (e) {
      console.warn('检查图片集属性错误:', e);
    }
  }
  
  /**
   * 解析srcset属性
   * @param {string} srcset - srcset属性值
   * @returns {Array} - 解析后的URL数组
   * @private
   */
  static _parseSrcset(srcset) {
    const result = [];
    
    try {
      const parts = srcset.split(',');
      
      parts.forEach(part => {
        const [url, descriptor] = part.trim().split(/\s+/);
        
        if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
          let width = 0;
          
          if (descriptor) {
            if (descriptor.endsWith('w')) {
              width = parseInt(descriptor.slice(0, -1));
            } else if (descriptor.endsWith('x')) {
              const density = parseFloat(descriptor.slice(0, -1));
              width = Math.round(1000 * density);
            }
          }
          
          result.push({
            url: url,
            width: width
          });
        }
      });
    } catch (e) {
      console.error('解析srcset错误:', e);
    }
    
    return result;
  }
  
  /**
   * 判断字符串是否看起来像URL
   * @param {string} str - 要检查的字符串
   * @returns {boolean} - 是否看起来像URL
   * @private
   */
  static _looksLikeUrl(str) {
    try {
      if (str.match(/^(https?|ftp|file):\/\//i)) {
        return true;
      }
      
      if (str.startsWith('/') || str.startsWith('./') || str.startsWith('../')) {
        return true;
      }
      
      if (str.match(/^[a-z0-9][-a-z0-9.]+\.[a-z]{2,}(\/.*)?$/i)) {
        return true;
      }
      
      if (str.match(/\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mp3|wav)(\?.*)?$/i)) {
        return true;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * 从属性名和值估计资源质量
   * @param {string} attrName - 属性名
   * @param {string} value - 属性值
   * @returns {string} - 质量级别
   * @private
   */
  static _estimateQualityFromAttribute(attrName, value) {
    try {
      if (attrName.includes('hd') || 
          attrName.includes('high') || 
          attrName.includes('large') || 
          attrName.includes('full') || 
          attrName.includes('original')) {
        return 'HD';
      }
      
      if (attrName.includes('sd') || 
          attrName.includes('medium') || 
          attrName.includes('normal')) {
        return 'SD';
      }
      
      if (attrName.includes('ld') || 
          attrName.includes('low') || 
          attrName.includes('small') || 
          attrName.includes('thumb') || 
          attrName.includes('thumbnail')) {
        return 'LD';
      }
      
      const lowerValue = value.toLowerCase();
      
      if (lowerValue.includes('high') || 
          lowerValue.includes('hd') || 
          lowerValue.includes('large') || 
          lowerValue.includes('original') || 
          lowerValue.includes('full')) {
        return 'HD';
      }
      
      if (lowerValue.includes('medium') || 
          lowerValue.includes('sd') || 
          lowerValue.includes('normal')) {
        return 'SD';
      }
      
      if (lowerValue.includes('small') || 
          lowerValue.includes('thumb') || 
          lowerValue.includes('thumbnail') || 
          lowerValue.includes('preview') || 
          lowerValue.includes('low')) {
        return 'LD';
      }
      
      return 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }
  
  /**
   * 检测所有自定义属性资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static detectAllAttributeResources(document) {
    try {
      return this.extractResources(document);
    } catch (e) {
      console.error('自定义属性资源检测错误:', e);
      return [];
    }
  }
}

export default AttributeDetector;
