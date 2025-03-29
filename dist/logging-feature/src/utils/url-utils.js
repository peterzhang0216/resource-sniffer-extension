/**
 * @file url-utils.js
 * @description URL处理和分析工具
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { EXTENSION_TO_TYPE, RESOURCE_TYPES } from '../config/constants.js';

/**
 * URL工具类
 * @class URLUtils
 */
class URLUtils {
  /**
   * 从URL中提取文件扩展名
   * @param {string} url - 资源URL
   * @returns {string} 文件扩展名（小写）
   */
  static getFileExtension(url) {
    try {
      if (!url || typeof url !== 'string') return '';
      
      const urlWithoutParams = url.split('?')[0].split('#')[0];
      
      const pathParts = new URL(urlWithoutParams).pathname.split('.');
      if (pathParts.length > 1) {
        return pathParts.pop().toLowerCase();
      }
    } catch (e) {
      console.warn('获取文件扩展名失败:', e);
    }
    return '';
  }

  /**
   * 从URL中提取文件名
   * @param {string} url - 资源URL
   * @returns {string} 文件名
   */
  static getFileName(url) {
    try {
      if (!url || typeof url !== 'string') return '';
      
      const urlWithoutParams = url.split('?')[0].split('#')[0];
      
      const pathParts = new URL(urlWithoutParams).pathname.split('/');
      return pathParts.pop() || 'unknown';
    } catch (e) {
      console.warn('获取文件名失败:', e);
      return 'unknown';
    }
  }

  /**
   * 从URL中提取基本文件名（不含扩展名）
   * @param {string} url - 资源URL
   * @returns {string} 基本文件名
   */
  static getBaseFileName(url) {
    const fileName = this.getFileName(url);
    const parts = fileName.split('.');
    
    if (parts.length <= 1) return fileName;
    
    parts.pop();
    return parts.join('.');
  }

  /**
   * 根据URL推断资源类型
   * @param {string} url - 资源URL
   * @param {string} [contentType=''] - 内容类型（MIME类型）
   * @returns {string} 资源类型
   */
  static inferResourceType(url, contentType = '') {
    if (contentType) {
      if (contentType.startsWith('image/')) return RESOURCE_TYPES.IMAGE;
      if (contentType.startsWith('video/')) return RESOURCE_TYPES.VIDEO;
      if (contentType.startsWith('audio/')) return RESOURCE_TYPES.AUDIO;
      if (contentType.startsWith('application/pdf') || 
          contentType.includes('document') || 
          contentType.includes('spreadsheet') || 
          contentType.includes('presentation')) {
        return RESOURCE_TYPES.DOCUMENT;
      }
    }
    
    const extension = this.getFileExtension(url);
    if (extension && EXTENSION_TO_TYPE[extension]) {
      return EXTENSION_TO_TYPE[extension];
    }
    
    const urlLower = url.toLowerCase();
    if (urlLower.includes('/image/') || urlLower.includes('/img/') || urlLower.includes('/photo/')) {
      return RESOURCE_TYPES.IMAGE;
    }
    if (urlLower.includes('/video/') || urlLower.includes('/media/')) {
      return RESOURCE_TYPES.VIDEO;
    }
    if (urlLower.includes('/audio/') || urlLower.includes('/sound/')) {
      return RESOURCE_TYPES.AUDIO;
    }
    if (urlLower.includes('/doc/') || urlLower.includes('/pdf/')) {
      return RESOURCE_TYPES.DOCUMENT;
    }
    
    return RESOURCE_TYPES.OTHER;
  }

  /**
   * 计算URL指纹（用于相似度比较）
   * @param {string} url - 资源URL
   * @returns {string} URL指纹
   */
  static computeUrlFingerprint(url) {
    try {
      if (!url || typeof url !== 'string') return '';
      
      const urlObj = new URL(url);
      
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;
      
      const normalizedPath = pathname
        .replace(/\/+/g, '/') // 合并多个斜杠
        .replace(/\d+/g, 'N') // 将数字替换为N
        .replace(/[a-f0-9]{8,}/gi, 'HASH'); // 将可能的哈希值替换为HASH
      
      return `${hostname}${normalizedPath}`;
    } catch (e) {
      console.warn('计算URL指纹失败:', e);
      return url;
    }
  }

  /**
   * 计算两个URL的相似度（0-1之间的值）
   * @param {string} url1 - 第一个URL
   * @param {string} url2 - 第二个URL
   * @returns {number} 相似度分数（0-1）
   */
  static computeUrlSimilarity(url1, url2) {
    try {
      if (!url1 || !url2 || typeof url1 !== 'string' || typeof url2 !== 'string') {
        return 0;
      }
      
      if (url1 === url2) return 1;
      
      const urlObj1 = new URL(url1);
      const urlObj2 = new URL(url2);
      
      if (urlObj1.hostname !== urlObj2.hostname) {
        return 0.1;
      }
      
      const path1 = urlObj1.pathname;
      const path2 = urlObj2.pathname;
      const query1 = urlObj1.search;
      const query2 = urlObj2.search;
      
      const pathSimilarity = this.calculateJaccardSimilarity(
        path1.split('/').filter(Boolean),
        path2.split('/').filter(Boolean)
      );
      
      const querySimilarity = query1 && query2 ? 
        this.calculateJaccardSimilarity(
          Array.from(new URLSearchParams(query1).keys()),
          Array.from(new URLSearchParams(query2).keys())
        ) : (query1 === query2 ? 1 : 0);
      
      return pathSimilarity * 0.7 + querySimilarity * 0.3;
    } catch (e) {
      console.warn('计算URL相似度失败:', e);
      return 0;
    }
  }

  /**
   * 计算Jaccard相似度（集合相似度）
   * @param {Array} set1 - 第一个集合
   * @param {Array} set2 - 第二个集合
   * @returns {number} Jaccard相似度（0-1）
   * @private
   */
  static calculateJaccardSimilarity(set1, set2) {
    if (!set1.length && !set2.length) return 1;
    if (!set1.length || !set2.length) return 0;
    
    const set1Set = new Set(set1);
    const set2Set = new Set(set2);
    
    const intersection = new Set([...set1Set].filter(x => set2Set.has(x)));
    
    const union = new Set([...set1Set, ...set2Set]);
    
    return intersection.size / union.size;
  }

  /**
   * 检查URL是否有效
   * @param {string} url - 要检查的URL
   * @returns {boolean} 是否为有效URL
   */
  static isValidUrl(url) {
    try {
      if (!url || typeof url !== 'string') return false;
      
      if (url.startsWith('data:') || url.startsWith('blob:')) return false;
      
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 规范化URL（移除不必要的参数等）
   * @param {string} url - 原始URL
   * @returns {string} 规范化后的URL
   */
  static normalizeUrl(url) {
    try {
      if (!url || typeof url !== 'string') return url;
      
      const urlObj = new URL(url);
      
      const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
      paramsToRemove.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      return urlObj.toString();
    } catch (e) {
      console.warn('规范化URL失败:', e);
      return url;
    }
  }
}

export default URLUtils;
