/**
 * @file ml-service.js
 * @description 机器学习服务，提供资源内容分析和智能检测功能
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, QUALITY_LEVELS } from '../config/constants.js';

/**
 * 机器学习服务
 * @class MLService
 */
class MLService {
  /**
   * 创建机器学习服务实例
   */
  constructor() {
    this.models = {};
    this.modelStatus = {
      imageClassifier: 'unloaded',
      qualityEstimator: 'unloaded',
      contentAnalyzer: 'unloaded'
    };
    this.cache = new Map();
    this.initService();
  }

  /**
   * 初始化服务
   * @private
   */
  async initService() {
    try {
      this.hasWebNN = typeof navigator.ml !== 'undefined';
      this.hasWebGL = this.checkWebGLSupport();
      
      if (this.hasWebGL) {
        this.preloadLightModels();
      }
      
      console.log('ML服务初始化完成', {
        webNN: this.hasWebNN,
        webGL: this.hasWebGL
      });
    } catch (e) {
      console.error('ML服务初始化错误:', e);
    }
  }
  
  /**
   * 检查WebGL支持
   * @private
   * @returns {boolean} 是否支持WebGL
   */
  checkWebGLSupport() {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && 
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }
  
  /**
   * 预加载轻量级模型
   * @private
   */
  async preloadLightModels() {
    try {
      this.modelStatus.imageClassifier = 'loading';
      
      setTimeout(() => {
        this.models.imageClassifier = {
          name: 'MobileNet-Light',
          loaded: true,
          predict: this.simulateImageClassification.bind(this)
        };
        this.modelStatus.imageClassifier = 'loaded';
        console.log('轻量级图像分类模型加载完成');
      }, 1000);
    } catch (e) {
      console.error('预加载模型错误:', e);
      this.modelStatus.imageClassifier = 'error';
    }
  }
  
  /**
   * 模拟图像分类
   * @private
   * @param {string} imageUrl - 图像URL
   * @returns {Promise<Object>} 分类结果
   */
  async simulateImageClassification(imageUrl) {
    const categories = ['photo', 'artwork', 'screenshot', 'meme', 'diagram', 'chart'];
    const randomIndex = Math.floor(Math.random() * categories.length);
    const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
    
    return {
      category: categories[randomIndex],
      confidence: confidence,
      timestamp: Date.now()
    };
  }
  
  /**
   * 分析图像内容
   * @param {string} imageUrl - 图像URL
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeImage(imageUrl) {
    try {
      if (this.cache.has(imageUrl)) {
        return this.cache.get(imageUrl);
      }
      
      if (this.modelStatus.imageClassifier !== 'loaded') {
        return {
          success: false,
          error: '图像分类模型未加载',
          fallbackAnalysis: this.performHeuristicImageAnalysis(imageUrl)
        };
      }
      
      const classificationResult = await this.models.imageClassifier.predict(imageUrl);
      
      const enhancedResult = {
        ...classificationResult,
        estimatedQuality: this.estimateImageQuality(imageUrl),
        contentType: this.inferContentType(imageUrl, classificationResult),
        success: true
      };
      
      this.cache.set(imageUrl, enhancedResult);
      
      return enhancedResult;
    } catch (e) {
      console.error('图像分析错误:', e);
      return {
        success: false,
        error: e.message,
        fallbackAnalysis: this.performHeuristicImageAnalysis(imageUrl)
      };
    }
  }
  
  /**
   * 执行启发式图像分析
   * @private
   * @param {string} imageUrl - 图像URL
   * @returns {Object} 分析结果
   */
  performHeuristicImageAnalysis(imageUrl) {
    const isHighRes = /large|original|full|hd|high/i.test(imageUrl);
    const isLowRes = /thumb|small|preview|tiny|icon/i.test(imageUrl);
    const isPossibleScreenshot = /screen|capture|shot/i.test(imageUrl);
    const isPossiblePhoto = /photo|image|picture|img/i.test(imageUrl);
    
    return {
      estimatedQuality: isHighRes ? QUALITY_LEVELS.HIGH : 
                        (isLowRes ? QUALITY_LEVELS.LOW : QUALITY_LEVELS.MEDIUM),
      contentType: isPossibleScreenshot ? 'screenshot' : 
                  (isPossiblePhoto ? 'photo' : 'image'),
      confidence: 0.6,
      isHeuristic: true
    };
  }
  
  /**
   * 估计图像质量
   * @private
   * @param {string} imageUrl - 图像URL
   * @returns {string} 质量级别
   */
  estimateImageQuality(imageUrl) {
    if (/original|full|large|hd|high/i.test(imageUrl)) {
      return QUALITY_LEVELS.HIGH;
    } else if (/medium|mid|normal/i.test(imageUrl)) {
      return QUALITY_LEVELS.MEDIUM;
    } else if (/small|thumb|preview|tiny|icon/i.test(imageUrl)) {
      return QUALITY_LEVELS.LOW;
    }
    
    const resolutionMatch = imageUrl.match(/(\d+)x(\d+)/i);
    if (resolutionMatch) {
      const width = parseInt(resolutionMatch[1]);
      const height = parseInt(resolutionMatch[2]);
      const pixels = width * height;
      
      if (pixels >= 1000000) { // 1MP以上
        return QUALITY_LEVELS.HIGH;
      } else if (pixels >= 250000) { // 0.25MP以上
        return QUALITY_LEVELS.MEDIUM;
      } else {
        return QUALITY_LEVELS.LOW;
      }
    }
    
    return QUALITY_LEVELS.MEDIUM; // 默认中等质量
  }
  
  /**
   * 推断内容类型
   * @private
   * @param {string} url - 资源URL
   * @param {Object} classificationResult - 分类结果
   * @returns {string} 内容类型
   */
  inferContentType(url, classificationResult) {
    if (classificationResult && classificationResult.category) {
      return classificationResult.category;
    }
    
    if (/photo|picture|image|img/i.test(url)) {
      return 'photo';
    } else if (/icon|logo|avatar/i.test(url)) {
      return 'icon';
    } else if (/banner|header|cover/i.test(url)) {
      return 'banner';
    } else if (/thumb|preview/i.test(url)) {
      return 'thumbnail';
    }
    
    return 'unknown';
  }
  
  /**
   * 分析视频内容
   * @param {string} videoUrl - 视频URL
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeVideo(videoUrl) {
    try {
      if (this.cache.has(videoUrl)) {
        return this.cache.get(videoUrl);
      }
      
      const result = this.performHeuristicVideoAnalysis(videoUrl);
      
      this.cache.set(videoUrl, result);
      
      return result;
    } catch (e) {
      console.error('视频分析错误:', e);
      return {
        success: false,
        error: e.message,
        fallbackAnalysis: this.performHeuristicVideoAnalysis(videoUrl)
      };
    }
  }
  
  /**
   * 执行启发式视频分析
   * @private
   * @param {string} videoUrl - 视频URL
   * @returns {Object} 分析结果
   */
  performHeuristicVideoAnalysis(videoUrl) {
    const isHighRes = /hd|high|1080|720|4k|8k/i.test(videoUrl);
    const isLowRes = /low|mobile|360|240/i.test(videoUrl);
    const isPossibleMovie = /movie|film|episode/i.test(videoUrl);
    const isPossibleClip = /clip|short|preview/i.test(videoUrl);
    
    const isHLS = /\.m3u8/i.test(videoUrl);
    const isDASH = /\.mpd/i.test(videoUrl);
    const isStreaming = isHLS || isDASH;
    
    return {
      estimatedQuality: isHighRes ? QUALITY_LEVELS.HIGH : 
                        (isLowRes ? QUALITY_LEVELS.LOW : QUALITY_LEVELS.MEDIUM),
      contentType: isPossibleMovie ? 'movie' : 
                  (isPossibleClip ? 'clip' : 'video'),
      isStreaming: isStreaming,
      streamingType: isHLS ? 'HLS' : (isDASH ? 'DASH' : null),
      confidence: 0.7,
      isHeuristic: true,
      success: true
    };
  }
  
  /**
   * 生成资源缩略图
   * @param {string} url - 资源URL
   * @param {string} type - 资源类型
   * @returns {Promise<string>} 缩略图数据URL
   */
  async generateThumbnail(url, type) {
    try {
      if (type === RESOURCE_TYPES.IMAGE) {
        return await this.generateImageThumbnail(url);
      } else if (type === RESOURCE_TYPES.VIDEO) {
        return await this.generateVideoThumbnail(url);
      }
      
      return null;
    } catch (e) {
      console.error('生成缩略图错误:', e);
      return null;
    }
  }
  
  /**
   * 生成图像缩略图
   * @private
   * @param {string} imageUrl - 图像URL
   * @returns {Promise<string>} 缩略图数据URL
   */
  async generateImageThumbnail(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const maxSize = 150;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = Math.round(height * (maxSize / width));
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round(width * (maxSize / height));
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx.drawImage(img, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      
      img.onerror = (e) => {
        reject(new Error('图像加载失败'));
      };
      
      img.src = imageUrl;
    });
  }
  
  /**
   * 生成视频缩略图
   * @private
   * @param {string} videoUrl - 视频URL
   * @returns {Promise<string>} 缩略图数据URL
   */
  async generateVideoThumbnail(videoUrl) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      
      video.autoplay = false;
      video.muted = true;
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 4);
      };
      
      video.onloadeddata = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const maxSize = 150;
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          if (width > height) {
            if (width > maxSize) {
              height = Math.round(height * (maxSize / width));
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round(width * (maxSize / height));
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx.drawImage(video, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          video.pause();
          video.src = '';
          video.load();
          
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      
      video.onerror = () => {
        reject(new Error('视频加载失败'));
      };
      
      const timeout = setTimeout(() => {
        video.pause();
        video.src = '';
        video.load();
        reject(new Error('视频缩略图生成超时'));
      }, 10000);
      
      video.onloadeddata = function() {
        clearTimeout(timeout);
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const maxSize = 150;
          let width = video.videoWidth;
          let height = video.videoHeight;
          
          if (width > height) {
            if (width > maxSize) {
              height = Math.round(height * (maxSize / width));
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round(width * (maxSize / height));
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          ctx.drawImage(video, 0, 0, width, height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          video.pause();
          video.src = '';
          video.load();
          
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      
      video.src = videoUrl;
      video.load();
    });
  }
  
  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
  }
}

const mlService = new MLService();

export default mlService;
