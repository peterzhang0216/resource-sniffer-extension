/**
 * @file streaming-detector.js
 * @description 流媒体资源检测器，用于检测和提取视频流和音频流资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../../config/constants.js';
import URLUtils from '../../utils/url-utils.js';

/**
 * 流媒体资源检测器
 * @class StreamingDetector
 */
class StreamingDetector {
  /**
   * 检测流媒体资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static detectResources(document) {
    const resources = [];
    
    try {
      this._detectHLSStreams(document, resources);
      
      this._detectDASHStreams(document, resources);
      
      this._detectMSEStreams(document, resources);
      
      this._detectStreamingPlayers(document, resources);
      
      return resources;
    } catch (e) {
      console.error('流媒体资源检测错误:', e);
      return resources;
    }
  }
  
  /**
   * 检测HLS流
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _detectHLSStreams(document, resources) {
    try {
      document.querySelectorAll('video > source[src]').forEach(source => {
        const src = source.getAttribute('src');
        if (src && (src.includes('.m3u8') || source.type === 'application/x-mpegURL' || source.type === 'application/vnd.apple.mpegurl')) {
          resources.push({
            url: new URL(src, window.location.href).href,
            type: RESOURCE_TYPES.VIDEO,
            contentType: 'application/x-mpegURL',
            source: SOURCE_TYPES.STREAMING,
            timestamp: Date.now(),
            filename: URLUtils.getFileName(src) || 'hls-stream',
            quality: 'HD', // 假设HLS流为高清
            isStream: true,
            streamType: 'hls'
          });
        }
      });
      
      document.querySelectorAll('video[src]').forEach(video => {
        const src = video.getAttribute('src');
        if (src && src.includes('.m3u8')) {
          resources.push({
            url: new URL(src, window.location.href).href,
            type: RESOURCE_TYPES.VIDEO,
            contentType: 'application/x-mpegURL',
            width: video.videoWidth || video.width,
            height: video.videoHeight || video.height,
            source: SOURCE_TYPES.STREAMING,
            timestamp: Date.now(),
            filename: URLUtils.getFileName(src) || 'hls-stream',
            quality: this._estimateVideoQuality(video),
            isStream: true,
            streamType: 'hls'
          });
        }
      });
      
      const scriptTags = document.querySelectorAll('script');
      scriptTags.forEach(script => {
        if (script.textContent) {
          const m3u8Matches = script.textContent.match(/(["'])(https?:\/\/[^"']+\.m3u8(\?[^"']+)?)\1/g);
          if (m3u8Matches) {
            m3u8Matches.forEach(match => {
              const url = match.replace(/^["']|["']$/g, '');
              resources.push({
                url: url,
                type: RESOURCE_TYPES.VIDEO,
                contentType: 'application/x-mpegURL',
                source: SOURCE_TYPES.STREAMING,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(url) || 'hls-stream-script',
                quality: 'HD', // 假设HLS流为高清
                isStream: true,
                streamType: 'hls'
              });
            });
          }
        }
      });
    } catch (e) {
      console.warn('HLS流检测错误:', e);
    }
  }
  
  /**
   * 检测DASH流
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _detectDASHStreams(document, resources) {
    try {
      document.querySelectorAll('video > source[src]').forEach(source => {
        const src = source.getAttribute('src');
        if (src && (src.includes('.mpd') || source.type === 'application/dash+xml')) {
          resources.push({
            url: new URL(src, window.location.href).href,
            type: RESOURCE_TYPES.VIDEO,
            contentType: 'application/dash+xml',
            source: SOURCE_TYPES.STREAMING,
            timestamp: Date.now(),
            filename: URLUtils.getFileName(src) || 'dash-stream',
            quality: 'HD', // 假设DASH流为高清
            isStream: true,
            streamType: 'dash'
          });
        }
      });
      
      document.querySelectorAll('video[src]').forEach(video => {
        const src = video.getAttribute('src');
        if (src && src.includes('.mpd')) {
          resources.push({
            url: new URL(src, window.location.href).href,
            type: RESOURCE_TYPES.VIDEO,
            contentType: 'application/dash+xml',
            width: video.videoWidth || video.width,
            height: video.videoHeight || video.height,
            source: SOURCE_TYPES.STREAMING,
            timestamp: Date.now(),
            filename: URLUtils.getFileName(src) || 'dash-stream',
            quality: this._estimateVideoQuality(video),
            isStream: true,
            streamType: 'dash'
          });
        }
      });
      
      const scriptTags = document.querySelectorAll('script');
      scriptTags.forEach(script => {
        if (script.textContent) {
          const mpdMatches = script.textContent.match(/(["'])(https?:\/\/[^"']+\.mpd(\?[^"']+)?)\1/g);
          if (mpdMatches) {
            mpdMatches.forEach(match => {
              const url = match.replace(/^["']|["']$/g, '');
              resources.push({
                url: url,
                type: RESOURCE_TYPES.VIDEO,
                contentType: 'application/dash+xml',
                source: SOURCE_TYPES.STREAMING,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(url) || 'dash-stream-script',
                quality: 'HD', // 假设DASH流为高清
                isStream: true,
                streamType: 'dash'
              });
            });
          }
        }
      });
    } catch (e) {
      console.warn('DASH流检测错误:', e);
    }
  }
  
  /**
   * 检测MSE流
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _detectMSEStreams(document, resources) {
    try {
      
      const scriptTags = document.querySelectorAll('script');
      scriptTags.forEach(script => {
        if (script.textContent) {
          const usesMSE = script.textContent.includes('MediaSource') || 
                          script.textContent.includes('SourceBuffer') || 
                          script.textContent.includes('appendBuffer');
          
          if (usesMSE) {
            const urlMatches = script.textContent.match(/(["'])(https?:\/\/[^"']+\.(mp4|webm|m4s|ts|aac|mp3)(\?[^"']+)?)\1/g);
            if (urlMatches) {
              urlMatches.forEach(match => {
                const url = match.replace(/^["']|["']$/g, '');
                const extension = url.split('.').pop().split('?')[0].toLowerCase();
                
                let type = RESOURCE_TYPES.OTHER;
                let contentType = 'application/octet-stream';
                
                if (['mp4', 'webm', 'm4s', 'ts'].includes(extension)) {
                  type = RESOURCE_TYPES.VIDEO;
                  contentType = extension === 'mp4' ? 'video/mp4' : 
                                extension === 'webm' ? 'video/webm' : 
                                extension === 'm4s' ? 'video/mp4' : 
                                'video/mp2t';
                } else if (['aac', 'mp3'].includes(extension)) {
                  type = RESOURCE_TYPES.AUDIO;
                  contentType = extension === 'aac' ? 'audio/aac' : 'audio/mpeg';
                }
                
                resources.push({
                  url: url,
                  type: type,
                  contentType: contentType,
                  source: SOURCE_TYPES.STREAMING,
                  timestamp: Date.now(),
                  filename: URLUtils.getFileName(url) || 'mse-segment',
                  quality: 'unknown',
                  isStream: true,
                  streamType: 'mse',
                  isSegment: true
                });
              });
            }
          }
        }
      });
    } catch (e) {
      console.warn('MSE流检测错误:', e);
    }
  }
  
  /**
   * 检测常见流媒体播放器
   * @param {Document} document - 文档对象
   * @param {Array} resources - 资源数组
   * @private
   */
  static _detectStreamingPlayers(document, resources) {
    try {
      const playerSelectors = [
        '.jwplayer',
        '.video-js',
        '.plyr',
        '.mejs__container',
        '.flowplayer',
        '.clappr-player',
        '[data-shaka-player]',
        '[data-dashjs-player]',
        '[data-hls-player]'
      ];
      
      const players = document.querySelectorAll(playerSelectors.join(','));
      
      players.forEach(player => {
        const videoElement = player.querySelector('video');
        if (videoElement) {
          if (videoElement.src && !videoElement.src.startsWith('blob:')) {
            resources.push({
              url: new URL(videoElement.src, window.location.href).href,
              type: RESOURCE_TYPES.VIDEO,
              width: videoElement.videoWidth || videoElement.width,
              height: videoElement.videoHeight || videoElement.height,
              source: SOURCE_TYPES.STREAMING,
              timestamp: Date.now(),
              filename: URLUtils.getFileName(videoElement.src) || 'player-video',
              quality: this._estimateVideoQuality(videoElement),
              isStream: true,
              streamType: 'player',
              playerType: this._identifyPlayerType(player)
            });
          }
          
          const sources = videoElement.querySelectorAll('source');
          sources.forEach(source => {
            if (source.src && !source.src.startsWith('blob:')) {
              resources.push({
                url: new URL(source.src, window.location.href).href,
                type: RESOURCE_TYPES.VIDEO,
                contentType: source.type || '',
                source: SOURCE_TYPES.STREAMING,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(source.src) || 'player-source',
                quality: 'unknown',
                isStream: true,
                streamType: 'player',
                playerType: this._identifyPlayerType(player)
              });
            }
          });
        }
        
        const dataAttributes = [
          'data-src', 'data-source', 'data-url', 'data-file',
          'data-stream', 'data-hls', 'data-dash', 'data-video'
        ];
        
        dataAttributes.forEach(attr => {
          if (player.hasAttribute(attr)) {
            const value = player.getAttribute(attr);
            if (value && !value.startsWith('blob:')) {
              resources.push({
                url: new URL(value, window.location.href).href,
                type: RESOURCE_TYPES.VIDEO,
                source: SOURCE_TYPES.STREAMING,
                timestamp: Date.now(),
                filename: URLUtils.getFileName(value) || 'player-data-source',
                quality: 'unknown',
                isStream: true,
                streamType: 'player',
                playerType: this._identifyPlayerType(player)
              });
            }
          }
        });
      });
    } catch (e) {
      console.warn('流媒体播放器检测错误:', e);
    }
  }
  
  /**
   * 识别播放器类型
   * @param {Element} playerElement - 播放器元素
   * @returns {string} - 播放器类型
   * @private
   */
  static _identifyPlayerType(playerElement) {
    try {
      const classList = Array.from(playerElement.classList);
      const id = playerElement.id;
      
      if (classList.includes('jwplayer') || id?.includes('jwplayer')) {
        return 'jwplayer';
      }
      
      if (classList.includes('video-js') || id?.includes('video-js')) {
        return 'videojs';
      }
      
      if (classList.includes('plyr') || id?.includes('plyr')) {
        return 'plyr';
      }
      
      if (classList.includes('mejs__container') || id?.includes('mejs')) {
        return 'mediaelement';
      }
      
      if (classList.includes('flowplayer') || id?.includes('flowplayer')) {
        return 'flowplayer';
      }
      
      if (classList.includes('clappr-player') || id?.includes('clappr')) {
        return 'clappr';
      }
      
      if (playerElement.hasAttribute('data-shaka-player')) {
        return 'shaka';
      }
      
      if (playerElement.hasAttribute('data-dashjs-player')) {
        return 'dashjs';
      }
      
      if (playerElement.hasAttribute('data-hls-player')) {
        return 'hlsjs';
      }
      
      return 'unknown';
    } catch (e) {
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
  
  /**
   * 监听网络请求以检测流媒体片段
   * @param {Function} callback - 回调函数，接收检测到的资源
   * @returns {Function} - 停止监听的函数
   */
  static monitorNetworkRequests(callback) {
    try {
      if (window.PerformanceObserver) {
        const observer = new PerformanceObserver(list => {
          list.getEntries().forEach(entry => {
            const url = entry.name;
            if (url && typeof url === 'string') {
              const lowerUrl = url.toLowerCase();
              
              if (lowerUrl.includes('.ts') || 
                  lowerUrl.includes('.m4s') || 
                  lowerUrl.includes('.mp4') || 
                  lowerUrl.includes('.aac') || 
                  lowerUrl.includes('.m3u8') || 
                  lowerUrl.includes('.mpd') || 
                  lowerUrl.match(/\/segment\//) || 
                  lowerUrl.match(/\/fragments\//) || 
                  lowerUrl.match(/\/chunks\//)) {
                
                let type = RESOURCE_TYPES.OTHER;
                let streamType = 'unknown';
                
                if (lowerUrl.includes('.m3u8')) {
                  type = RESOURCE_TYPES.VIDEO;
                  streamType = 'hls';
                } else if (lowerUrl.includes('.mpd')) {
                  type = RESOURCE_TYPES.VIDEO;
                  streamType = 'dash';
                } else if (lowerUrl.includes('.ts') || lowerUrl.includes('.m4s')) {
                  type = RESOURCE_TYPES.VIDEO;
                  streamType = lowerUrl.includes('.ts') ? 'hls' : 'dash';
                } else if (lowerUrl.includes('.mp4')) {
                  type = RESOURCE_TYPES.VIDEO;
                  streamType = 'mp4';
                } else if (lowerUrl.includes('.aac')) {
                  type = RESOURCE_TYPES.AUDIO;
                  streamType = 'audio';
                }
                
                const resource = {
                  url: url,
                  type: type,
                  source: SOURCE_TYPES.STREAMING,
                  timestamp: Date.now(),
                  filename: URLUtils.getFileName(url) || 'stream-segment',
                  quality: 'unknown',
                  isStream: true,
                  streamType: streamType,
                  isSegment: true,
                  size: entry.transferSize || 0,
                  duration: entry.duration || 0
                };
                
                callback(resource);
              }
            }
          });
        });
        
        observer.observe({ entryTypes: ['resource'] });
        
        return () => observer.disconnect();
      }
    } catch (e) {
      console.warn('监听网络请求错误:', e);
    }
    
    return () => {};
  }
  
  /**
   * 检测所有流媒体资源
   * @param {Document} document - 文档对象
   * @returns {Array} - 检测到的资源数组
   */
  static detectAllStreamingResources(document) {
    try {
      return this.detectResources(document);
    } catch (e) {
      console.error('流媒体资源检测错误:', e);
      return [];
    }
  }
}

export default StreamingDetector;
