/**
 * @file fingerprint-service.js
 * @description 资源指纹服务，用于资源去重和相似度比较
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 资源指纹服务
 * @class FingerprintService
 */
class FingerprintService {
  /**
   * 创建资源指纹服务实例
   */
  constructor() {
    this.fingerprints = new Map();
    this.similarityThreshold = 0.85; // 相似度阈值
  }
  
  /**
   * 计算资源指纹
   * @param {Object} resource - 资源对象
   * @returns {string} 资源指纹
   */
  calculateFingerprint(resource) {
    try {
      if (!resource || !resource.url) {
        return null;
      }
      
      const urlFingerprint = this.fingerprintUrl(resource.url);
      
      if (resource.contentHash) {
        return `${urlFingerprint}:${resource.contentHash}`;
      }
      
      const typeSignature = resource.type || 'unknown';
      const sizeSignature = resource.size ? resource.size.toString(16) : '0';
      const dimensionSignature = resource.width && resource.height ? 
        `${resource.width}x${resource.height}` : '';
      
      return `${urlFingerprint}:${typeSignature}:${sizeSignature}:${dimensionSignature}`;
    } catch (e) {
      console.error('计算资源指纹错误:', e);
      return null;
    }
  }
  
  /**
   * 计算URL指纹
   * @private
   * @param {string} url - 资源URL
   * @returns {string} URL指纹
   */
  fingerprintUrl(url) {
    try {
      const urlObj = new URL(url);
      
      const hostname = urlObj.hostname.toLowerCase();
      
      let path = urlObj.pathname;
      
      const cleanParams = new URLSearchParams();
      urlObj.searchParams.forEach((value, key) => {
        if (!key.match(/^(sid|session|timestamp|time|t|rand|r|nonce|_|v)$/i)) {
          cleanParams.append(key, value);
        }
      });
      
      const normalizedUrl = `${hostname}${path}${cleanParams.toString() ? '?' + cleanParams.toString() : ''}`;
      
      return this.simpleHash(normalizedUrl);
    } catch (e) {
      console.warn('URL指纹计算错误:', e);
      return this.simpleHash(url);
    }
  }
  
  /**
   * 计算简单哈希
   * @private
   * @param {string} str - 输入字符串
   * @returns {string} 哈希值
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(16);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16);
  }
  
  /**
   * 添加资源指纹
   * @param {Object} resource - 资源对象
   * @returns {string} 资源指纹
   */
  addResourceFingerprint(resource) {
    const fingerprint = this.calculateFingerprint(resource);
    
    if (fingerprint) {
      this.fingerprints.set(fingerprint, {
        resource: resource,
        timestamp: Date.now()
      });
    }
    
    return fingerprint;
  }
  
  /**
   * 检查资源是否重复
   * @param {Object} resource - 资源对象
   * @returns {Object|null} 重复资源信息或null
   */
  checkDuplicate(resource) {
    const fingerprint = this.calculateFingerprint(resource);
    
    if (!fingerprint) {
      return null;
    }
    
    if (this.fingerprints.has(fingerprint)) {
      const existing = this.fingerprints.get(fingerprint);
      return {
        isDuplicate: true,
        similarity: 1.0,
        originalResource: existing.resource,
        fingerprint: fingerprint
      };
    }
    
    const similarResource = this.findSimilarResource(resource);
    if (similarResource) {
      return {
        isDuplicate: false,
        isSimilar: true,
        similarity: similarResource.similarity,
        originalResource: similarResource.resource,
        fingerprint: fingerprint
      };
    }
    
    return null;
  }
  
  /**
   * 查找相似资源
   * @private
   * @param {Object} resource - 资源对象
   * @returns {Object|null} 相似资源信息或null
   */
  findSimilarResource(resource) {
    try {
      if (!resource || !resource.url) {
        return null;
      }
      
      const urlObj = new URL(resource.url);
      const hostname = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname;
      
      let highestSimilarity = 0;
      let mostSimilarResource = null;
      
      this.fingerprints.forEach((entry, fingerprint) => {
        const existingResource = entry.resource;
        
        if (existingResource.type !== resource.type) {
          return;
        }
        
        try {
          const existingUrl = new URL(existingResource.url);
          const existingHostname = existingUrl.hostname.toLowerCase();
          const existingPath = existingUrl.pathname;
          
          let similarity = 0;
          
          if (hostname === existingHostname) {
            similarity += 0.4;
            
            const pathSimilarity = this.calculateStringSimilarity(path, existingPath);
            similarity += pathSimilarity * 0.4;
          }
          
          if (resource.width && resource.height && 
              existingResource.width && existingResource.height) {
            const areaSimilarity = Math.min(
              (resource.width * resource.height) / (existingResource.width * existingResource.height),
              (existingResource.width * existingResource.height) / (resource.width * resource.height)
            );
            similarity += areaSimilarity * 0.2;
          }
          
          if (similarity > highestSimilarity && similarity >= this.similarityThreshold) {
            highestSimilarity = similarity;
            mostSimilarResource = existingResource;
          }
        } catch (e) {
        }
      });
      
      if (mostSimilarResource) {
        return {
          resource: mostSimilarResource,
          similarity: highestSimilarity
        };
      }
      
      return null;
    } catch (e) {
      console.warn('查找相似资源错误:', e);
      return null;
    }
  }
  
  /**
   * 计算字符串相似度 (Levenshtein距离的归一化版本)
   * @private
   * @param {string} str1 - 第一个字符串
   * @param {string} str2 - 第二个字符串
   * @returns {number} 相似度 (0-1)
   */
  calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    
    let commonPrefixLength = 0;
    const minLength = Math.min(len1, len2);
    
    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        commonPrefixLength++;
      } else {
        break;
      }
    }
    
    let commonSuffixLength = 0;
    for (let i = 1; i <= minLength - commonPrefixLength; i++) {
      if (str1[len1 - i] === str2[len2 - i]) {
        commonSuffixLength++;
      } else {
        break;
      }
    }
    
    const commonLength = commonPrefixLength + commonSuffixLength;
    return (2 * commonLength) / (len1 + len2);
  }
  
  /**
   * 获取资源指纹统计
   * @returns {Object} 指纹统计信息
   */
  getStats() {
    return {
      totalFingerprints: this.fingerprints.size,
      timestamp: Date.now()
    };
  }
  
  /**
   * 清除过期指纹
   * @param {number} maxAge - 最大年龄(毫秒)
   */
  clearExpiredFingerprints(maxAge = 3600000) { // 默认1小时
    const now = Date.now();
    
    this.fingerprints.forEach((entry, fingerprint) => {
      if (now - entry.timestamp > maxAge) {
        this.fingerprints.delete(fingerprint);
      }
    });
  }
  
  /**
   * 重置指纹库
   */
  reset() {
    this.fingerprints.clear();
  }
}

const fingerprintService = new FingerprintService();

export default fingerprintService;
