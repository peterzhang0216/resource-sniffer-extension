/**
 * @file resource-predictor.js
 * @description 资源预测Worker，使用模式匹配预测网页中的资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../config/constants.js';

/**
 * 使用简单模式匹配预测网页中的资源
 * @param {Object} data - 包含页面数据的对象
 */
function predictResources(data) {
  const { url, html, hostname } = data;
  const predictedResources = [];
  
  try {
    const patterns = [
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?cdn\..*?\/.*?\.(jpe?g|png|gif|webp|mp4|webm)/gi, type: 'match' },
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?img\..*?\/.*?\.(jpe?g|png|gif|webp)/gi, type: 'match' },
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?video\..*?\/.*?\.(mp4|webm|mov)/gi, type: 'match' },
      { regex: /["']https?:\/\/.*?\/.*?(?:photo|image|img|pic).*?\.(jpe?g|png|gif|webp)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/.*?\/.*?(?:video|movie|film|clip).*?\.(mp4|webm|mov)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/.*?\/.*?(?:thumb|thumbnail|small|preview).*?\.(jpe?g|png|gif|webp)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?pexels\.com\/.*?\.(jpe?g|png)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?unsplash\.com\/.*?\.(jpe?g|png)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?imgur\.com\/.*?\.(jpe?g|png|gif)["']/gi, type: 'extract' }
    ];
    
    if (hostname.includes('youtube')) {
      patterns.push({ regex: /https?:\/\/i\.ytimg\.com\/vi\/.*?\/(hqdefault|mqdefault|sddefault|maxresdefault)\.jpg/gi, type: 'match' });
    } else if (hostname.includes('vimeo')) {
      patterns.push({ regex: /https?:\/\/i\.vimeocdn\.com\/video\/.*?\.(jpe?g|png)/gi, type: 'match' });
    } else if (hostname.includes('facebook')) {
      patterns.push({ regex: /https?:\/\/scontent.*?\.fbcdn\.net\/.*?\.(jpe?g|png|gif)/gi, type: 'match' });
    } else if (hostname.includes('instagram')) {
      patterns.push({ regex: /https?:\/\/scontent.*?\.cdninstagram\.com\/.*?\.(jpe?g|png|mp4)/gi, type: 'match' });
    } else if (hostname.includes('twitter') || hostname.includes('x.com')) {
      patterns.push({ regex: /https?:\/\/pbs\.twimg\.com\/media\/.*?\.(jpe?g|png|gif)/gi, type: 'match' });
    }
    
    for (const pattern of patterns) {
      let matches;
      
      if (pattern.type === 'match') {
        while ((matches = pattern.regex.exec(html)) !== null) {
          addPredictedResource(matches[0], predictedResources);
        }
      } else if (pattern.type === 'extract') {
        while ((matches = pattern.regex.exec(html)) !== null) {
          const extracted = matches[0].replace(/^["']|["']$/g, '');
          addPredictedResource(extracted, predictedResources);
        }
      }
    }
    
    findHighResolutionVariants(predictedResources);
    
    postMessage({
      action: 'predictionComplete',
      predictedResources: predictedResources
    });
  } catch (e) {
    console.error('资源预测错误:', e);
    postMessage({
      action: 'predictionComplete',
      predictedResources: [],
      error: e.message
    });
  }
}

/**
 * 添加预测资源到列表
 * @param {string} url - 资源URL
 * @param {Array} resources - 资源列表
 */
function addPredictedResource(url, resources) {
  try {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    
    if (resources.some(r => r.url === url)) return;
    
    const filename = url.split('/').pop().split('?')[0] || 'predicted-resource';
    
    let type = RESOURCE_TYPES.IMAGE;
    let contentType = 'image/jpeg';
    
    if (/\.(mp4|webm|mov|avi|flv|wmv)($|\?)/i.test(url)) {
      type = RESOURCE_TYPES.VIDEO;
      contentType = 'video/mp4';
    } else if (/\.(mp3|wav|ogg|aac|flac)($|\?)/i.test(url)) {
      type = RESOURCE_TYPES.AUDIO;
      contentType = 'audio/mpeg';
    } else if (/\.gif($|\?)/i.test(url)) {
      contentType = 'image/gif';
    } else if (/\.png($|\?)/i.test(url)) {
      contentType = 'image/png';
    } else if (/\.webp($|\?)/i.test(url)) {
      contentType = 'image/webp';
    }
    
    let quality = 'medium';
    if (url.includes('high') || url.includes('hd') || url.includes('large') || url.includes('original')) {
      quality = 'high';
    } else if (url.includes('low') || url.includes('small') || url.includes('thumb') || url.includes('preview')) {
      quality = 'low';
    }
    
    let sizeEstimate = 0;
    if (type === RESOURCE_TYPES.IMAGE) {
      sizeEstimate = quality === 'high' ? 500000 : (quality === 'medium' ? 200000 : 50000);
    } else if (type === RESOURCE_TYPES.VIDEO) {
      sizeEstimate = quality === 'high' ? 10000000 : (quality === 'medium' ? 5000000 : 1000000);
    } else if (type === RESOURCE_TYPES.AUDIO) {
      sizeEstimate = quality === 'high' ? 5000000 : (quality === 'medium' ? 2000000 : 500000);
    }
    
    resources.push({
      url: url,
      type: type,
      contentType: contentType,
      size: sizeEstimate,
      sizeFormatted: formatSize(sizeEstimate),
      filename: filename,
      timestamp: Date.now(),
      source: SOURCE_TYPES.PREDICTED,
      quality: quality,
      isPredicted: true,
      confidence: calculateConfidence(url, type, quality),
      score: calculateResourceScore(url, type, quality)
    });
  } catch (e) {
    console.warn('添加预测资源错误:', e);
  }
}

/**
 * 查找可能的高清版本
 * @param {Array} resources - 资源列表
 */
function findHighResolutionVariants(resources) {
  try {
    const thumbnailPatterns = [
      { pattern: /thumb|small|preview|low|mobile/i, replacement: 'large' },
      { pattern: /\d+x\d+/i, replacement: match => {
        const [width, height] = match.split('x').map(Number);
        return `${width * 2}x${height * 2}`;
      }},
      { pattern: /_s\.|_m\./i, replacement: '_l.' },
      { pattern: /-\d+x\d+\./i, replacement: '.' }
    ];
    
    const imageResources = resources.filter(r => r.type === RESOURCE_TYPES.IMAGE);
    
    for (const resource of imageResources) {
      if (resource.quality === 'high') continue;
      
      for (const { pattern, replacement } of thumbnailPatterns) {
        if (pattern.test(resource.url)) {
          const highResUrl = resource.url.replace(pattern, replacement);
          
          if (resources.some(r => r.url === highResUrl)) continue;
          
          const highResResource = { ...resource };
          highResResource.url = highResUrl;
          highResResource.quality = 'high';
          highResResource.size = resource.size * 4;
          highResResource.sizeFormatted = formatSize(highResResource.size);
          highResResource.isPredictedVariant = true;
          highResResource.originalUrl = resource.url;
          highResResource.confidence = resource.confidence * 0.8;
          highResResource.score = calculateResourceScore(highResUrl, resource.type, 'high');
          
          resources.push(highResResource);
        }
      }
    }
  } catch (e) {
    console.warn('查找高清版本错误:', e);
  }
}

/**
 * 计算资源置信度
 * @param {string} url - 资源URL
 * @param {string} type - 资源类型
 * @param {string} quality - 资源质量
 * @returns {number} - 置信度 (0-1)
 */
function calculateConfidence(url, type, quality) {
  let confidence = 0.7; // 基础置信度
  
  if (url.includes('cdn') || url.includes('static') || url.includes('assets')) {
    confidence += 0.1;
  }
  
  if (url.includes('original') || url.includes('full') || url.includes('hd')) {
    confidence += 0.1;
  }
  
  if (type === RESOURCE_TYPES.IMAGE) {
    confidence += 0.05;
  } else if (type === RESOURCE_TYPES.VIDEO) {
    confidence += 0.02;
  }
  
  if (quality === 'high') {
    confidence += 0.05;
  } else if (quality === 'low') {
    confidence -= 0.05;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * 计算资源评分
 * @param {string} url - 资源URL
 * @param {string} type - 资源类型
 * @param {string} quality - 资源质量
 * @returns {number} - 资源评分 (0-100)
 */
function calculateResourceScore(url, type, quality) {
  let score = 50; // 基础评分
  
  if (url.includes('cdn') || url.includes('static') || url.includes('assets')) {
    score += 10;
  }
  
  if (url.includes('original') || url.includes('full') || url.includes('hd')) {
    score += 15;
  }
  
  if (type === RESOURCE_TYPES.IMAGE) {
    score += 5;
  } else if (type === RESOURCE_TYPES.VIDEO) {
    score += 10;
  }
  
  if (quality === 'high') {
    score += 15;
  } else if (quality === 'medium') {
    score += 5;
  } else if (quality === 'low') {
    score -= 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 格式化大小
 * @param {number} bytes - 字节数
 * @returns {string} - 格式化后的大小
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
}

self.addEventListener('message', (e) => {
  const { action, url, hostname, html } = e.data;
  
  switch (action) {
    case 'predict':
      predictResources({ url, hostname, html });
      break;
    default:
      console.warn('Worker received unknown action:', action);
  }
});

export { predictResources, addPredictedResource, findHighResolutionVariants };
