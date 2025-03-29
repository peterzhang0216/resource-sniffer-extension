/**
 * @file resource-utils.js
 * @description 资源处理工具类，提供资源评分、分组和分析功能
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, QUALITY_LEVELS } from '../config/constants.js';
import URLUtils from './url-utils.js';
import FileUtils from './file-utils.js';

/**
 * 资源工具类
 * @class ResourceUtils
 */
class ResourceUtils {
  /**
   * 计算资源质量评分
   * @param {Object} resource - 资源对象
   * @returns {Object} - 评分和评分详情
   */
  static calculateResourceScore(resource) {
    if (!resource) return { score: 0, details: {} };
    
    const details = {};
    let totalScore = 0;
    let maxScore = 0;
    
    if (resource.width && resource.height) {
      const pixels = resource.width * resource.height;
      let resolutionScore = 0;
      
      if (pixels >= 2073600) { // 1920x1080及以上
        resolutionScore = 30;
      } else if (pixels >= 921600) { // 1280x720及以上
        resolutionScore = 25;
      } else if (pixels >= 307200) { // 640x480及以上
        resolutionScore = 15;
      } else {
        resolutionScore = 5;
      }
      
      details.resolution = { 
        score: resolutionScore, 
        value: `${resource.width}x${resource.height}` 
      };
      totalScore += resolutionScore;
      maxScore += 30;
    }
    
    if (resource.size) {
      let sizeScore = 0;
      
      if (resource.type === RESOURCE_TYPES.IMAGE) {
        if (resource.size > 500000) {
          sizeScore = 20; // 大图片通常质量更高
        } else if (resource.size > 100000) {
          sizeScore = 15;
        } else if (resource.size > 30000) {
          sizeScore = 10;
        } else {
          sizeScore = 5;
        }
      } else if (resource.type === RESOURCE_TYPES.VIDEO) {
        if (resource.size > 10000000) {
          sizeScore = 20; // 大视频通常质量更高
        } else if (resource.size > 5000000) {
          sizeScore = 15;
        } else if (resource.size > 1000000) {
          sizeScore = 10;
        } else {
          sizeScore = 5;
        }
      }
      
      details.size = {
        score: sizeScore,
        value: FileUtils.formatFileSize(resource.size)
      };
      totalScore += sizeScore;
      maxScore += 20;
    }
    
    if (resource.source) {
      let sourceScore = 0;
      
      if (resource.source === 'original') {
        sourceScore = 15; // 原始资源
      } else if (resource.source === 'css' || resource.source === 'shadow-dom') {
        sourceScore = 10; // CSS或Shadow DOM中的资源
      } else if (resource.source === 'custom-attribute') {
        sourceScore = 8; // 自定义属性中的资源
      } else if (resource.source === 'predicted') {
        sourceScore = 5; // 预测的资源
      }
      
      details.source = {
        score: sourceScore,
        value: resource.source
      };
      totalScore += sourceScore;
      maxScore += 15;
    }
    
    const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    return {
      score: finalScore,
      details: details,
      totalScore: totalScore,
      maxScore: maxScore
    };
  }

  /**
   * 检测文件类型
   * @param {ArrayBuffer} buffer - 文件的二进制数据
   * @returns {string} - 文件MIME类型
   */
  static detectFileType(buffer) {
    const uint8Arr = new Uint8Array(buffer);
    
    if (uint8Arr[0] === 0xFF && uint8Arr[1] === 0xD8 && uint8Arr[2] === 0xFF) {
      return 'image/jpeg';
    }
    
    if (uint8Arr[0] === 0x89 && uint8Arr[1] === 0x50 && uint8Arr[2] === 0x4E && uint8Arr[3] === 0x47) {
      return 'image/png';
    }
    
    if (uint8Arr[0] === 0x47 && uint8Arr[1] === 0x49 && uint8Arr[2] === 0x46 && uint8Arr[3] === 0x38) {
      return 'image/gif';
    }
    
    if (uint8Arr[0] === 0x52 && uint8Arr[1] === 0x49 && uint8Arr[2] === 0x46 && uint8Arr[3] === 0x46 &&
        uint8Arr[8] === 0x57 && uint8Arr[9] === 0x45 && uint8Arr[10] === 0x42 && uint8Arr[11] === 0x50) {
      return 'image/webp';
    }
    
    if (uint8Arr[4] === 0x66 && uint8Arr[5] === 0x74 && uint8Arr[6] === 0x79 && uint8Arr[7] === 0x70) {
      return 'video/mp4';
    }
    
    if (uint8Arr[0] === 0x1A && uint8Arr[1] === 0x45 && uint8Arr[2] === 0xDF && uint8Arr[3] === 0xA3) {
      return 'video/webm';
    }
    
    return 'application/octet-stream';
  }

  /**
   * 将资源分组为相似组
   * @param {Array} resources - 资源列表
   * @returns {Object} - 按指纹分组后的资源
   */
  static groupSimilarResources(resources) {
    const resourceGroups = {};
    
    resources.forEach(resource => {
      if (!resource.url) return;
      
      let fingerprint = URLUtils.computeUrlFingerprint(resource.url);
      
      if (!resourceGroups[fingerprint]) {
        resourceGroups[fingerprint] = [];
      }
      
      resourceGroups[fingerprint].push(resource);
    });
    
    resources.forEach(resource => {
      if (!resource.url) return;
      
      let fingerprint = URLUtils.computeUrlFingerprint(resource.url);
      
      resource.similarCount = resourceGroups[fingerprint] ? 
        resourceGroups[fingerprint].length - 1 : 0;
    });
    
    return resourceGroups;
  }
  
  /**
   * 估计资源质量级别
   * @param {Object} resource - 资源对象
   * @returns {string} - 质量级别
   */
  static estimateQualityLevel(resource) {
    if (!resource) return QUALITY_LEVELS.UNKNOWN;
    
    const { width, height, size, type } = resource;
    
    if (width && height) {
      const pixels = width * height;
      if (pixels >= 2073600) return QUALITY_LEVELS.HD; // 1920x1080以上
      if (pixels >= 921600) return QUALITY_LEVELS.HD;  // 1280x720以上
      if (pixels >= 307200) return QUALITY_LEVELS.SD;  // 640x480以上
      return QUALITY_LEVELS.LD;
    }
    
    if (size) {
      if (type === RESOURCE_TYPES.IMAGE) {
        if (size > 500000) return QUALITY_LEVELS.HD;
        if (size > 100000) return QUALITY_LEVELS.SD;
        return QUALITY_LEVELS.LD;
      } else if (type === RESOURCE_TYPES.VIDEO) {
        if (size > 10000000) return QUALITY_LEVELS.HD;
        if (size > 2000000) return QUALITY_LEVELS.SD;
        return QUALITY_LEVELS.LD;
      }
    }
    
    return QUALITY_LEVELS.UNKNOWN;
  }
}

export default ResourceUtils;
