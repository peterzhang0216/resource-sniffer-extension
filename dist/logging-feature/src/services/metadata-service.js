/**
 * @file metadata-service.js
 * @description 元数据分析服务，提取和分析资源的元数据信息
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, QUALITY_LEVELS } from '../config/constants.js';
import cacheService from './cache-service.js';

/**
 * 元数据分析服务
 * @class MetadataService
 */
class MetadataService {
  /**
   * 创建元数据分析服务实例
   */
  constructor() {
    this.metadataCache = cacheService.getCache('metadata', 500);
    this.fetchQueue = [];
    this.isProcessingQueue = false;
    this.concurrentFetches = 3;
  }
  
  /**
   * 分析资源元数据
   * @param {Object} resource - 资源对象
   * @returns {Promise<Object>} 增强的资源对象
   */
  async analyzeMetadata(resource) {
    try {
      if (!resource || !resource.url) {
        return resource;
      }
      
      const cacheKey = `metadata_${resource.url}`;
      const cachedMetadata = this.metadataCache.get(cacheKey);
      if (cachedMetadata) {
        return {
          ...resource,
          metadata: cachedMetadata,
          hasMetadata: true
        };
      }
      
      let metadata = {};
      
      if (resource.type === RESOURCE_TYPES.IMAGE) {
        metadata = await this.analyzeImageMetadata(resource);
      } else if (resource.type === RESOURCE_TYPES.VIDEO) {
        metadata = await this.analyzeVideoMetadata(resource);
      } else if (resource.type === RESOURCE_TYPES.AUDIO) {
        metadata = await this.analyzeAudioMetadata(resource);
      } else {
        metadata = this.analyzeGenericMetadata(resource);
      }
      
      this.metadataCache.put(cacheKey, metadata);
      
      return {
        ...resource,
        metadata: metadata,
        hasMetadata: true
      };
    } catch (e) {
      console.error('分析元数据错误:', e);
      return resource;
    }
  }
  
  /**
   * 分析图像元数据
   * @private
   * @param {Object} resource - 资源对象
   * @returns {Promise<Object>} 元数据对象
   */
  async analyzeImageMetadata(resource) {
    try {
      const metadata = {
        dimensions: null,
        format: null,
        colorDepth: null,
        hasAlpha: null,
        estimatedQuality: null,
        aspectRatio: null,
        orientation: null,
        timestamp: Date.now()
      };
      
      this.extractInfoFromUrl(resource.url, metadata);
      
      if (resource.width && resource.height) {
        metadata.dimensions = {
          width: resource.width,
          height: resource.height
        };
        metadata.aspectRatio = resource.width / resource.height;
        metadata.orientation = resource.width >= resource.height ? 'landscape' : 'portrait';
      } else {
        const dimensions = await this.fetchImageDimensions(resource.url);
        if (dimensions) {
          metadata.dimensions = dimensions;
          metadata.aspectRatio = dimensions.width / dimensions.height;
          metadata.orientation = dimensions.width >= dimensions.height ? 'landscape' : 'portrait';
        }
      }
      
      metadata.estimatedQuality = this.estimateImageQuality(resource, metadata);
      
      return metadata;
    } catch (e) {
      console.warn('分析图像元数据错误:', e);
      return {
        error: e.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 分析视频元数据
   * @private
   * @param {Object} resource - 资源对象
   * @returns {Promise<Object>} 元数据对象
   */
  async analyzeVideoMetadata(resource) {
    try {
      const metadata = {
        dimensions: null,
        format: null,
        duration: null,
        hasAudio: null,
        bitrate: null,
        framerate: null,
        estimatedQuality: null,
        isStreaming: false,
        streamingType: null,
        timestamp: Date.now()
      };
      
      this.extractInfoFromUrl(resource.url, metadata);
      
      if (resource.url.includes('.m3u8')) {
        metadata.isStreaming = true;
        metadata.streamingType = 'HLS';
      } else if (resource.url.includes('.mpd')) {
        metadata.isStreaming = true;
        metadata.streamingType = 'DASH';
      }
      
      if (resource.width && resource.height) {
        metadata.dimensions = {
          width: resource.width,
          height: resource.height
        };
      }
      
      metadata.estimatedQuality = this.estimateVideoQuality(resource, metadata);
      
      return metadata;
    } catch (e) {
      console.warn('分析视频元数据错误:', e);
      return {
        error: e.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 分析音频元数据
   * @private
   * @param {Object} resource - 资源对象
   * @returns {Promise<Object>} 元数据对象
   */
  async analyzeAudioMetadata(resource) {
    try {
      const metadata = {
        format: null,
        duration: null,
        bitrate: null,
        sampleRate: null,
        channels: null,
        estimatedQuality: null,
        timestamp: Date.now()
      };
      
      this.extractInfoFromUrl(resource.url, metadata);
      
      metadata.estimatedQuality = this.estimateAudioQuality(resource, metadata);
      
      return metadata;
    } catch (e) {
      console.warn('分析音频元数据错误:', e);
      return {
        error: e.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 分析通用资源元数据
   * @private
   * @param {Object} resource - 资源对象
   * @returns {Object} 元数据对象
   */
  analyzeGenericMetadata(resource) {
    try {
      const metadata = {
        format: null,
        estimatedSize: null,
        timestamp: Date.now()
      };
      
      this.extractInfoFromUrl(resource.url, metadata);
      
      return metadata;
    } catch (e) {
      console.warn('分析通用元数据错误:', e);
      return {
        error: e.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 从URL提取信息
   * @private
   * @param {string} url - 资源URL
   * @param {Object} metadata - 元数据对象
   */
  extractInfoFromUrl(url, metadata) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      if (filename) {
        const parts = filename.split('.');
        if (parts.length > 1) {
          const extension = parts.pop().toLowerCase();
          metadata.format = extension;
        }
        
        const dimensionMatch = filename.match(/(\d+)x(\d+)/i);
        if (dimensionMatch && !metadata.dimensions) {
          metadata.dimensions = {
            width: parseInt(dimensionMatch[1]),
            height: parseInt(dimensionMatch[2])
          };
        }
        
        if (filename.includes('hd') || filename.includes('high') || 
            filename.includes('original') || filename.includes('full')) {
          metadata.estimatedQuality = QUALITY_LEVELS.HIGH;
        } else if (filename.includes('medium') || filename.includes('mid') || 
                  filename.includes('standard')) {
          metadata.estimatedQuality = QUALITY_LEVELS.MEDIUM;
        } else if (filename.includes('low') || filename.includes('small') || 
                  filename.includes('thumb') || filename.includes('preview')) {
          metadata.estimatedQuality = QUALITY_LEVELS.LOW;
        }
      }
      
      urlObj.searchParams.forEach((value, key) => {
        if (key.toLowerCase().includes('width') || key.toLowerCase() === 'w') {
          const width = parseInt(value);
          if (width > 0) {
            metadata.dimensions = metadata.dimensions || {};
            metadata.dimensions.width = width;
          }
        } else if (key.toLowerCase().includes('height') || key.toLowerCase() === 'h') {
          const height = parseInt(value);
          if (height > 0) {
            metadata.dimensions = metadata.dimensions || {};
            metadata.dimensions.height = height;
          }
        } else if (key.toLowerCase().includes('quality')) {
          if (value.toLowerCase().includes('high') || value.toLowerCase().includes('hd')) {
            metadata.estimatedQuality = QUALITY_LEVELS.HIGH;
          } else if (value.toLowerCase().includes('medium') || value.toLowerCase().includes('mid')) {
            metadata.estimatedQuality = QUALITY_LEVELS.MEDIUM;
          } else if (value.toLowerCase().includes('low')) {
            metadata.estimatedQuality = QUALITY_LEVELS.LOW;
          }
        }
      });
    } catch (e) {
      console.warn('从URL提取信息错误:', e);
    }
  }
  
  /**
   * 获取图像尺寸
   * @private
   * @param {string} url - 图像URL
   * @returns {Promise<Object|null>} 尺寸对象或null
   */
  async fetchImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = () => {
        resolve(null);
      };
      
      const timeout = setTimeout(() => {
        resolve(null);
      }, 5000);
      
      img.onload = function() {
        clearTimeout(timeout);
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      
      img.onerror = function() {
        clearTimeout(timeout);
        resolve(null);
      };
      
      img.src = url;
    });
  }
  
  /**
   * 估计图像质量
   * @private
   * @param {Object} resource - 资源对象
   * @param {Object} metadata - 元数据对象
   * @returns {string} 质量级别
   */
  estimateImageQuality(resource, metadata) {
    if (resource.quality) {
      return resource.quality;
    }
    
    if (metadata.estimatedQuality) {
      return metadata.estimatedQuality;
    }
    
    if (metadata.dimensions) {
      const { width, height } = metadata.dimensions;
      const pixels = width * height;
      
      if (pixels >= 1000000) { // 1MP以上
        return QUALITY_LEVELS.HIGH;
      } else if (pixels >= 250000) { // 0.25MP以上
        return QUALITY_LEVELS.MEDIUM;
      } else {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    if (resource.url) {
      if (resource.url.includes('high') || resource.url.includes('hd') || 
          resource.url.includes('large') || resource.url.includes('original')) {
        return QUALITY_LEVELS.HIGH;
      } else if (resource.url.includes('medium') || resource.url.includes('mid')) {
        return QUALITY_LEVELS.MEDIUM;
      } else if (resource.url.includes('small') || resource.url.includes('thumb') || 
                resource.url.includes('preview')) {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    if (resource.size) {
      if (resource.size > 500000) { // 500KB以上
        return QUALITY_LEVELS.HIGH;
      } else if (resource.size > 100000) { // 100KB以上
        return QUALITY_LEVELS.MEDIUM;
      } else {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    return QUALITY_LEVELS.MEDIUM; // 默认中等质量
  }
  
  /**
   * 估计视频质量
   * @private
   * @param {Object} resource - 资源对象
   * @param {Object} metadata - 元数据对象
   * @returns {string} 质量级别
   */
  estimateVideoQuality(resource, metadata) {
    if (resource.quality) {
      return resource.quality;
    }
    
    if (metadata.estimatedQuality) {
      return metadata.estimatedQuality;
    }
    
    if (metadata.dimensions) {
      const { width, height } = metadata.dimensions;
      
      if (width >= 1920 || height >= 1080) { // 1080p以上
        return QUALITY_LEVELS.HIGH;
      } else if (width >= 1280 || height >= 720) { // 720p以上
        return QUALITY_LEVELS.MEDIUM;
      } else {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    if (resource.url) {
      if (resource.url.includes('1080') || resource.url.includes('hd') || 
          resource.url.includes('high') || resource.url.includes('original')) {
        return QUALITY_LEVELS.HIGH;
      } else if (resource.url.includes('720') || resource.url.includes('medium')) {
        return QUALITY_LEVELS.MEDIUM;
      } else if (resource.url.includes('480') || resource.url.includes('360') || 
                resource.url.includes('low') || resource.url.includes('mobile')) {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    if (resource.size) {
      if (resource.size > 10000000) { // 10MB以上
        return QUALITY_LEVELS.HIGH;
      } else if (resource.size > 2000000) { // 2MB以上
        return QUALITY_LEVELS.MEDIUM;
      } else {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    return QUALITY_LEVELS.MEDIUM; // 默认中等质量
  }
  
  /**
   * 估计音频质量
   * @private
   * @param {Object} resource - 资源对象
   * @param {Object} metadata - 元数据对象
   * @returns {string} 质量级别
   */
  estimateAudioQuality(resource, metadata) {
    if (resource.quality) {
      return resource.quality;
    }
    
    if (metadata.estimatedQuality) {
      return metadata.estimatedQuality;
    }
    
    if (resource.url) {
      if (resource.url.includes('high') || resource.url.includes('hd') || 
          resource.url.includes('flac') || resource.url.includes('original')) {
        return QUALITY_LEVELS.HIGH;
      } else if (resource.url.includes('medium') || resource.url.includes('mid') || 
                resource.url.includes('mp3')) {
        return QUALITY_LEVELS.MEDIUM;
      } else if (resource.url.includes('low') || resource.url.includes('mobile')) {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    if (resource.size) {
      if (resource.size > 5000000) { // 5MB以上
        return QUALITY_LEVELS.HIGH;
      } else if (resource.size > 1000000) { // 1MB以上
        return QUALITY_LEVELS.MEDIUM;
      } else {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    return QUALITY_LEVELS.MEDIUM; // 默认中等质量
  }
  
  /**
   * 批量分析资源元数据
   * @param {Array} resources - 资源数组
   * @returns {Promise<Array>} 增强的资源数组
   */
  async batchAnalyzeMetadata(resources) {
    try {
      if (!resources || !Array.isArray(resources) || resources.length === 0) {
        return resources;
      }
      
      const enhancedResources = [];
      
      const imageResources = resources.filter(r => r.type === RESOURCE_TYPES.IMAGE);
      const videoResources = resources.filter(r => r.type === RESOURCE_TYPES.VIDEO);
      const audioResources = resources.filter(r => r.type === RESOURCE_TYPES.AUDIO);
      const otherResources = resources.filter(r => 
        r.type !== RESOURCE_TYPES.IMAGE && 
        r.type !== RESOURCE_TYPES.VIDEO && 
        r.type !== RESOURCE_TYPES.AUDIO
      );
      
      const [enhancedImages, enhancedVideos, enhancedAudios, enhancedOthers] = await Promise.all([
        Promise.all(imageResources.map(r => this.analyzeMetadata(r))),
        Promise.all(videoResources.map(r => this.analyzeMetadata(r))),
        Promise.all(audioResources.map(r => this.analyzeMetadata(r))),
        Promise.all(otherResources.map(r => this.analyzeMetadata(r)))
      ]);
      
      enhancedResources.push(...enhancedImages, ...enhancedVideos, ...enhancedAudios, ...enhancedOthers);
      
      return enhancedResources;
    } catch (e) {
      console.error('批量分析元数据错误:', e);
      return resources;
    }
  }
  
  /**
   * 清除元数据缓存
   */
  clearCache() {
    this.metadataCache.clear();
  }
}

const metadataService = new MetadataService();

export default metadataService;
