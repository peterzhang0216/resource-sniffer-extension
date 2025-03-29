/**
 * @file css-detector.js
 * @description CSS资源检测器，用于从样式表中提取背景图像和其他CSS资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../../config/constants.js';
import URLUtils from '../../utils/url-utils.js';

/**
 * CSS资源检测器
 * @class CSSDetector
 */
class CSSDetector {
  /**
   * 从CSS样式表中提取资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static extractResources(document) {
    const resources = [];
    
    try {
      const styleSheets = Array.from(document.styleSheets);
      
      styleSheets.forEach(styleSheet => {
        try {
          if (!styleSheet.cssRules) return;
          
          const cssRules = Array.from(styleSheet.cssRules);
          
          cssRules.forEach(rule => {
            if (rule instanceof CSSStyleRule) {
              this._extractImagesFromStyleRule(rule, resources);
            }
            else if (rule instanceof CSSImportRule) {
              if (rule.href && !rule.href.startsWith('data:') && !rule.href.startsWith('blob:')) {
                resources.push({
                  url: rule.href,
                  type: RESOURCE_TYPES.OTHER,
                  source: SOURCE_TYPES.CSS,
                  timestamp: Date.now(),
                  filename: URLUtils.getFileName(rule.href) || 'imported-css'
                });
              }
            }
            else if (rule instanceof CSSFontFaceRule) {
              this._extractFontFromFontFaceRule(rule, resources);
            }
            else if (rule instanceof CSSMediaRule) {
              const mediaRules = Array.from(rule.cssRules);
              mediaRules.forEach(mediaRule => {
                if (mediaRule instanceof CSSStyleRule) {
                  this._extractImagesFromStyleRule(mediaRule, resources);
                }
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
    
    return resources;
  }
  
  /**
   * 从样式规则中提取图像资源
   * @param {CSSStyleRule} rule - CSS样式规则
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractImagesFromStyleRule(rule, resources) {
    try {
      const style = rule.style;
      
      if (style.backgroundImage) {
        this._extractUrlsFromCSSProperty(style.backgroundImage, rule, resources, RESOURCE_TYPES.IMAGE);
      }
      
      if (style.background) {
        this._extractUrlsFromCSSProperty(style.background, rule, resources, RESOURCE_TYPES.IMAGE);
      }
      
      if (style.borderImage) {
        this._extractUrlsFromCSSProperty(style.borderImage, rule, resources, RESOURCE_TYPES.IMAGE);
      }
      
      if (style.listStyleImage) {
        this._extractUrlsFromCSSProperty(style.listStyleImage, rule, resources, RESOURCE_TYPES.IMAGE);
      }
      
      if (style.content) {
        this._extractUrlsFromCSSProperty(style.content, rule, resources, RESOURCE_TYPES.IMAGE);
      }
      
      if (style.cursor) {
        this._extractUrlsFromCSSProperty(style.cursor, rule, resources, RESOURCE_TYPES.IMAGE);
      }
      
      if (style.mask || style.webkitMask) {
        const maskProperty = style.mask || style.webkitMask;
        this._extractUrlsFromCSSProperty(maskProperty, rule, resources, RESOURCE_TYPES.IMAGE);
      }
      
      if (style.filter) {
        this._extractUrlsFromCSSProperty(style.filter, rule, resources, RESOURCE_TYPES.IMAGE);
      }
    } catch (e) {
      console.warn('从样式规则提取图像错误:', e);
    }
  }
  
  /**
   * 从字体规则中提取字体资源
   * @param {CSSFontFaceRule} rule - CSS字体规则
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractFontFromFontFaceRule(rule, resources) {
    try {
      const style = rule.style;
      
      if (style.src) {
        const urlMatches = style.src.match(/url\(['"]?([^'"]+)['"]?\)/g);
        if (urlMatches) {
          urlMatches.forEach(urlMatch => {
            const url = urlMatch.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1');
            if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
              let format = 'unknown';
              if (url.endsWith('.woff2')) format = 'woff2';
              else if (url.endsWith('.woff')) format = 'woff';
              else if (url.endsWith('.ttf')) format = 'truetype';
              else if (url.endsWith('.otf')) format = 'opentype';
              else if (url.endsWith('.eot')) format = 'embedded-opentype';
              else if (url.endsWith('.svg')) format = 'svg';
              
              const baseUrl = rule.parentStyleSheet?.href || window.location.href;
              const absoluteUrl = new URL(url, baseUrl).href;
              
              resources.push({
                url: absoluteUrl,
                type: RESOURCE_TYPES.OTHER,
                contentType: 'font/' + format,
                source: SOURCE_TYPES.CSS,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(absoluteUrl) || 'font-' + format
              });
            }
          });
        }
      }
    } catch (e) {
      console.warn('从字体规则提取字体错误:', e);
    }
  }
  
  /**
   * 从CSS属性中提取URL
   * @param {string} cssProperty - CSS属性值
   * @param {CSSRule} rule - CSS规则
   * @param {Array} resources - 资源数组
   * @param {string} type - 资源类型
   * @private
   */
  static _extractUrlsFromCSSProperty(cssProperty, rule, resources, type) {
    try {
      const urlMatches = cssProperty.match(/url\(['"]?([^'"]+)['"]?\)/g);
      if (urlMatches) {
        urlMatches.forEach(urlMatch => {
          const url = urlMatch.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1');
          if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
            const baseUrl = rule.parentStyleSheet?.href || window.location.href;
            const absoluteUrl = new URL(url, baseUrl).href;
            
            resources.push({
              url: absoluteUrl,
              type: type,
              source: SOURCE_TYPES.CSS,
              timestamp: Date.now(),
              filename: URLUtils.getFileName(absoluteUrl) || 'css-resource'
            });
          }
        });
      }
    } catch (e) {
      console.warn('从CSS属性提取URL错误:', e);
    }
  }
  
  /**
   * 从内联样式中提取资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static extractInlineStyleResources(document) {
    const resources = [];
    
    try {
      const elementsWithStyle = document.querySelectorAll('[style]');
      
      elementsWithStyle.forEach(element => {
        const style = element.style;
        
        if (style.backgroundImage) {
          this._extractUrlsFromInlineStyle(style.backgroundImage, resources, RESOURCE_TYPES.IMAGE);
        }
        
        if (style.background) {
          this._extractUrlsFromInlineStyle(style.background, resources, RESOURCE_TYPES.IMAGE);
        }
        
        if (style.borderImage) {
          this._extractUrlsFromInlineStyle(style.borderImage, resources, RESOURCE_TYPES.IMAGE);
        }
        
        if (style.listStyleImage) {
          this._extractUrlsFromInlineStyle(style.listStyleImage, resources, RESOURCE_TYPES.IMAGE);
        }
        
        if (style.content) {
          this._extractUrlsFromInlineStyle(style.content, resources, RESOURCE_TYPES.IMAGE);
        }
      });
    } catch (e) {
      console.error('内联样式资源检测错误:', e);
    }
    
    return resources;
  }
  
  /**
   * 从内联样式中提取URL
   * @param {string} styleValue - 样式属性值
   * @param {Array} resources - 资源数组
   * @param {string} type - 资源类型
   * @private
   */
  static _extractUrlsFromInlineStyle(styleValue, resources, type) {
    try {
      const urlMatches = styleValue.match(/url\(['"]?([^'"]+)['"]?\)/g);
      if (urlMatches) {
        urlMatches.forEach(urlMatch => {
          const url = urlMatch.replace(/url\(['"]?([^'"]+)['"]?\)/, '$1');
          if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
            const absoluteUrl = new URL(url, window.location.href).href;
            
            resources.push({
              url: absoluteUrl,
              type: type,
              source: SOURCE_TYPES.CSS,
              timestamp: Date.now(),
              filename: URLUtils.getFileName(absoluteUrl) || 'inline-css-resource'
            });
          }
        });
      }
    } catch (e) {
      console.warn('从内联样式提取URL错误:', e);
    }
  }
  
  /**
   * 从所有样式资源中提取资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static detectAllCSSResources(document) {
    try {
      const styleSheetResources = this.extractResources(document);
      
      const inlineStyleResources = this.extractInlineStyleResources(document);
      
      return [...styleSheetResources, ...inlineStyleResources];
    } catch (e) {
      console.error('CSS资源检测错误:', e);
      return [];
    }
  }
}

export default CSSDetector;
