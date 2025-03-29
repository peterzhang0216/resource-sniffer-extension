/**
 * @file shadow-detector.js
 * @description Shadow DOM资源检测器，用于从Shadow DOM中提取媒体资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../../config/constants.js';
import URLUtils from '../../utils/url-utils.js';
import DOMDetector from './dom-detector.js';
import CSSDetector from './css-detector.js';

/**
 * Shadow DOM资源检测器
 * @class ShadowDetector
 */
class ShadowDetector {
  /**
   * 从Shadow DOM中提取资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static extractResources(document) {
    const resources = [];
    
    try {
      const allElements = document.querySelectorAll('*');
      
      allElements.forEach(element => {
        if (element.shadowRoot) {
          this._extractResourcesFromShadowRoot(element.shadowRoot, resources);
        }
      });
      
      return resources;
    } catch (e) {
      console.error('Shadow DOM资源检测错误:', e);
      return resources;
    }
  }
  
  /**
   * 从Shadow Root中提取资源
   * @param {ShadowRoot} shadowRoot - Shadow Root对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractResourcesFromShadowRoot(shadowRoot, resources) {
    try {
      const domResources = DOMDetector.extractResources(shadowRoot);
      
      const cssResources = CSSDetector.detectAllCSSResources(shadowRoot);
      
      [...domResources, ...cssResources].forEach(resource => {
        resource.source = SOURCE_TYPES.SHADOW_DOM;
        resources.push(resource);
      });
      
      const nestedElements = shadowRoot.querySelectorAll('*');
      nestedElements.forEach(element => {
        if (element.shadowRoot) {
          this._extractResourcesFromShadowRoot(element.shadowRoot, resources);
        }
      });
    } catch (e) {
      console.error('从Shadow Root提取资源错误:', e);
    }
  }
  
  /**
   * 检测自定义元素中的Shadow DOM
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static detectCustomElementResources(document) {
    const resources = [];
    
    try {
      const customElements = Array.from(document.querySelectorAll('*')).filter(el => {
        return el.tagName.includes('-') || // Web组件通常使用连字符命名
               el.hasAttribute('is') ||    // 扩展原生元素
               el.__proto__.__proto__.constructor.name !== 'HTMLElement'; // 自定义元素类
      });
      
      customElements.forEach(element => {
        if (element.shadowRoot) {
          this._extractResourcesFromShadowRoot(element.shadowRoot, resources);
        }
        
        this._extractCustomElementAttributes(element, resources);
      });
    } catch (e) {
      console.error('自定义元素资源检测错误:', e);
    }
    
    return resources;
  }
  
  /**
   * 提取自定义元素属性中的资源
   * @param {Element} element - 元素对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractCustomElementAttributes(element, resources) {
    try {
      const mediaAttributes = [
        'src', 'data-src', 'href', 'poster', 'background',
        'data-background', 'data-image', 'data-video',
        'data-poster', 'data-thumbnail', 'data-original'
      ];
      
      const attributes = element.attributes;
      
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];
        
        if (mediaAttributes.includes(attr.name) || 
            attr.name.includes('src') || 
            attr.name.includes('image') || 
            attr.name.includes('video') || 
            attr.name.includes('poster') || 
            attr.name.includes('thumbnail')) {
          
          const value = attr.value;
          
          if (value && !value.startsWith('data:') && !value.startsWith('blob:') && !value.startsWith('javascript:')) {
            let type = RESOURCE_TYPES.OTHER;
            
            if (attr.name.includes('image') || 
                value.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i)) {
              type = RESOURCE_TYPES.IMAGE;
            } else if (attr.name.includes('video') || 
                       value.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv)(\?.*)?$/i)) {
              type = RESOURCE_TYPES.VIDEO;
            } else if (attr.name.includes('audio') || 
                       value.match(/\.(mp3|wav|ogg|flac|aac|m4a)(\?.*)?$/i)) {
              type = RESOURCE_TYPES.AUDIO;
            }
            
            const absoluteUrl = new URL(value, window.location.href).href;
            
            resources.push({
              url: absoluteUrl,
              type: type,
              source: SOURCE_TYPES.SHADOW_DOM,
              timestamp: Date.now(),
              filename: URLUtils.getFileName(absoluteUrl) || 'custom-element-resource',
              quality: 'unknown'
            });
          }
        }
      }
    } catch (e) {
      console.warn('提取自定义元素属性错误:', e);
    }
  }
  
  /**
   * 检测所有Shadow DOM相关资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static detectAllShadowResources(document) {
    try {
      const shadowResources = this.extractResources(document);
      
      const customElementResources = this.detectCustomElementResources(document);
      
      return [...shadowResources, ...customElementResources];
    } catch (e) {
      console.error('Shadow DOM资源检测错误:', e);
      return [];
    }
  }
}

export default ShadowDetector;
