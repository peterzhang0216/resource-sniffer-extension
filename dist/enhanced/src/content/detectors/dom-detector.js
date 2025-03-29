/**
 * @file dom-detector.js
 * @description DOM资源检测器，用于从DOM元素中提取图片、视频和音频资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../../config/constants.js';
import URLUtils from '../../utils/url-utils.js';

/**
 * DOM资源检测器
 * @class DOMDetector
 */
class DOMDetector {
  /**
   * 从DOM元素中提取资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static extractResources(document) {
    const resources = [];
    
    try {
      this._extractImageResources(document, resources);
      
      this._extractVideoResources(document, resources);
      
      this._extractAudioResources(document, resources);
      
      this._extractLinkResources(document, resources);
      
      return resources;
    } catch (e) {
      console.error('DOM资源提取错误:', e);
      return resources;
    }
  }
  
  /**
   * 提取图片资源
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractImageResources(document, resources) {
    try {
      document.querySelectorAll('img[src]').forEach(img => {
        if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
          resources.push({
            url: img.src,
            type: RESOURCE_TYPES.IMAGE,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now(),
            quality: this._estimateImageQuality(img),
            filename: URLUtils.getFileName(img.src) || 'image'
          });
        }
      });
      
      document.querySelectorAll('img[srcset]').forEach(img => {
        if (img.srcset) {
          const srcsetUrls = this._parseSrcset(img.srcset);
          
          if (srcsetUrls.length > 0) {
            srcsetUrls.sort((a, b) => b.width - a.width);
            const highestQuality = srcsetUrls[0];
            
            const absoluteUrl = new URL(highestQuality.url, window.location.href).href;
            
            resources.push({
              url: absoluteUrl,
              type: RESOURCE_TYPES.IMAGE,
              width: highestQuality.width,
              height: img.naturalHeight || img.height,
              source: SOURCE_TYPES.DOM,
              timestamp: Date.now(),
              quality: 'HD', // 假设最高分辨率为HD
              filename: URLUtils.getFileName(absoluteUrl) || 'image-hd'
            });
          }
        }
      });
      
      document.querySelectorAll('picture > source[srcset]').forEach(source => {
        if (source.srcset) {
          const srcsetUrls = this._parseSrcset(source.srcset);
          
          if (srcsetUrls.length > 0) {
            srcsetUrls.sort((a, b) => b.width - a.width);
            const highestQuality = srcsetUrls[0];
            
            const absoluteUrl = new URL(highestQuality.url, window.location.href).href;
            
            resources.push({
              url: absoluteUrl,
              type: RESOURCE_TYPES.IMAGE,
              width: highestQuality.width,
              contentType: source.type || '',
              source: SOURCE_TYPES.DOM,
              timestamp: Date.now(),
              quality: 'HD', // 假设最高分辨率为HD
              filename: URLUtils.getFileName(absoluteUrl) || 'picture-image'
            });
          }
        }
      });
    } catch (e) {
      console.error('提取图片资源错误:', e);
    }
  }
  
  /**
   * 提取视频资源
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractVideoResources(document, resources) {
    try {
      document.querySelectorAll('video[src]').forEach(video => {
        if (video.src && !video.src.startsWith('data:') && !video.src.startsWith('blob:')) {
          resources.push({
            url: video.src,
            type: RESOURCE_TYPES.VIDEO,
            width: video.videoWidth || video.width,
            height: video.videoHeight || video.height,
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now(),
            quality: this._estimateVideoQuality(video),
            filename: URLUtils.getFileName(video.src) || 'video'
          });
        }
      });
      
      document.querySelectorAll('video > source[src]').forEach(source => {
        if (source.src && !source.src.startsWith('data:') && !source.src.startsWith('blob:')) {
          const video = source.parentElement;
          resources.push({
            url: source.src,
            type: RESOURCE_TYPES.VIDEO,
            contentType: source.type || '',
            width: video ? (video.videoWidth || video.width) : 0,
            height: video ? (video.videoHeight || video.height) : 0,
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now(),
            quality: video ? this._estimateVideoQuality(video) : 'unknown',
            filename: URLUtils.getFileName(source.src) || 'video-source'
          });
        }
      });
      
      document.querySelectorAll('video[poster]').forEach(video => {
        if (video.poster && !video.poster.startsWith('data:') && !video.poster.startsWith('blob:')) {
          resources.push({
            url: video.poster,
            type: RESOURCE_TYPES.IMAGE,
            width: video.width,
            height: video.height,
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now(),
            quality: 'SD', // 假设海报为标清
            filename: URLUtils.getFileName(video.poster) || 'video-poster'
          });
        }
      });
      
      document.querySelectorAll('iframe').forEach(iframe => {
        if (iframe.src && !iframe.src.startsWith('data:') && !iframe.src.startsWith('blob:')) {
          const src = iframe.src.toLowerCase();
          if (src.includes('youtube.com/embed/') || 
              src.includes('player.vimeo.com/video/') || 
              src.includes('dailymotion.com/embed/')) {
            resources.push({
              url: iframe.src,
              type: RESOURCE_TYPES.VIDEO,
              width: iframe.width,
              height: iframe.height,
              source: SOURCE_TYPES.DOM,
              timestamp: Date.now(),
              quality: 'HD', // 假设嵌入视频为高清
              filename: 'embedded-video',
              isEmbedded: true
            });
          }
        }
      });
    } catch (e) {
      console.error('提取视频资源错误:', e);
    }
  }
  
  /**
   * 提取音频资源
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractAudioResources(document, resources) {
    try {
      document.querySelectorAll('audio[src]').forEach(audio => {
        if (audio.src && !audio.src.startsWith('data:') && !audio.src.startsWith('blob:')) {
          resources.push({
            url: audio.src,
            type: RESOURCE_TYPES.AUDIO,
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now(),
            filename: URLUtils.getFileName(audio.src) || 'audio'
          });
        }
      });
      
      document.querySelectorAll('audio > source[src]').forEach(source => {
        if (source.src && !source.src.startsWith('data:') && !source.src.startsWith('blob:')) {
          resources.push({
            url: source.src,
            type: RESOURCE_TYPES.AUDIO,
            contentType: source.type || '',
            source: SOURCE_TYPES.DOM,
            timestamp: Date.now(),
            filename: URLUtils.getFileName(source.src) || 'audio-source'
          });
        }
      });
    } catch (e) {
      console.error('提取音频资源错误:', e);
    }
  }
  
  /**
   * 提取链接中的媒体文件
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _extractLinkResources(document, resources) {
    try {
      document.querySelectorAll('a[href]').forEach(link => {
        if (link.href && !link.href.startsWith('data:') && !link.href.startsWith('blob:') && !link.href.startsWith('javascript:')) {
          const href = link.href.toLowerCase();
          
          if (href.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/)) {
            resources.push({
              url: link.href,
              type: RESOURCE_TYPES.IMAGE,
              source: SOURCE_TYPES.DOM,
              timestamp: Date.now(),
              quality: 'unknown',
              filename: URLUtils.getFileName(link.href) || 'linked-image'
            });
          } 
          else if (href.match(/\.(mp4|webm|ogg|mov|avi|mkv|flv)(\?.*)?$/)) {
            resources.push({
              url: link.href,
              type: RESOURCE_TYPES.VIDEO,
              source: SOURCE_TYPES.DOM,
              timestamp: Date.now(),
              quality: 'unknown',
              filename: URLUtils.getFileName(link.href) || 'linked-video'
            });
          } 
          else if (href.match(/\.(mp3|wav|ogg|flac|aac|m4a)(\?.*)?$/)) {
            resources.push({
              url: link.href,
              type: RESOURCE_TYPES.AUDIO,
              source: SOURCE_TYPES.DOM,
              timestamp: Date.now(),
              filename: URLUtils.getFileName(link.href) || 'linked-audio'
            });
          }
        }
      });
    } catch (e) {
      console.error('提取链接资源错误:', e);
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
   * 估计图片质量
   * @param {HTMLImageElement} img - 图片元素
   * @returns {string} - 质量级别
   * @private
   */
  static _estimateImageQuality(img) {
    try {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      
      if (!width || !height) return 'unknown';
      
      const pixels = width * height;
      
      if (pixels >= 2073600) return 'HD'; // 1920x1080以上
      if (pixels >= 921600) return 'HD';  // 1280x720以上
      if (pixels >= 307200) return 'SD';  // 640x480以上
      return 'LD';
    } catch (e) {
      console.error('估计图片质量错误:', e);
      return 'unknown';
    }
  }
  
  /**
   * 估计视频质量
   * @param {HTMLVideoElement} video - 视频元素
   * @returns {string} - 质量级别
   * @private
   */
  static _estimateVideoQuality(video) {
    try {
      const width = video.videoWidth || video.width;
      const height = video.videoHeight || video.height;
      
      if (!width || !height) return 'unknown';
      
      const pixels = width * height;
      
      if (pixels >= 2073600) return 'HD'; // 1920x1080以上
      if (pixels >= 921600) return 'HD';  // 1280x720以上
      if (pixels >= 307200) return 'SD';  // 640x480以上
      return 'LD';
    } catch (e) {
      console.error('估计视频质量错误:', e);
      return 'unknown';
    }
  }
}

export default DOMDetector;
