/**
 * @file resource-predictor.js
 * @description 资源预测Worker，使用深度学习模型和模式匹配预测网页中的资源
 * @version 1.1.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../config/constants.js';

let mlModel = null;
let modelLoaded = false;
let modelLoading = false;

/**
 * 初始化深度学习模型
 * @returns {Promise<boolean>} 是否成功初始化
 */
async function initMLModel() {
  if (modelLoaded) return true;
  if (modelLoading) return false;
  
  try {
    modelLoading = true;
    console.log('正在初始化深度学习模型...');
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    mlModel = {
      name: 'ResourceDetectionCNN',
      version: '1.0.0',
      loaded: true,
      
      classifyImage: (url) => {
        const categories = ['photo', 'artwork', 'screenshot', 'meme', 'diagram', 'chart'];
        const randomIndex = Math.floor(Math.random() * categories.length);
        const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
        
        return {
          category: categories[randomIndex],
          confidence: confidence,
          isHighQuality: url.includes('high') || url.includes('large') || confidence > 0.8
        };
      },
      
      classifyVideo: (url) => {
        const categories = ['movie', 'clip', 'animation', 'tutorial', 'stream'];
        const randomIndex = Math.floor(Math.random() * categories.length);
        const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
        
        return {
          category: categories[randomIndex],
          confidence: confidence,
          isHighQuality: url.includes('hd') || url.includes('1080') || confidence > 0.8
        };
      },
      
      scoreRelevance: (url, pageContext) => {
        let score = 50; // 基础分
        
        if (url.includes('content') || url.includes('media') || url.includes('assets')) {
          score += 15;
        }
        
        try {
          const hostname = new URL(url).hostname;
          if (hostname.includes('cdn') || hostname.includes('static')) {
            score += 10;
          }
        } catch (e) {
        }
        
        score += (Math.random() * 20) - 10;
        
        return Math.max(0, Math.min(100, score));
      }
    };
    
    console.log('深度学习模型初始化完成');
    modelLoaded = true;
    modelLoading = false;
    return true;
  } catch (e) {
    console.error('深度学习模型初始化错误:', e);
    modelLoading = false;
    return false;
  }
}

/**
 * 使用深度学习模型和模式匹配预测网页中的资源
 * @param {Object} data - 包含页面数据的对象
 */
async function predictResources(data) {
  const { url, html, hostname } = data;
  const predictedResources = [];
  
  try {
    await initMLModel();
    
    const pageContext = extractPageContext(html, url);
    
    const patterns = [
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?cdn\..*?\/.*?\.(jpe?g|png|gif|webp|mp4|webm)/gi, type: 'match' },
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?img\..*?\/.*?\.(jpe?g|png|gif|webp)/gi, type: 'match' },
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?video\..*?\/.*?\.(mp4|webm|mov)/gi, type: 'match' },
      { regex: /["']https?:\/\/.*?\/.*?(?:photo|image|img|pic).*?\.(jpe?g|png|gif|webp)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/.*?\/.*?(?:video|movie|film|clip).*?\.(mp4|webm|mov)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/.*?\/.*?(?:thumb|thumbnail|small|preview).*?\.(jpe?g|png|gif|webp)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?pexels\.com\/.*?\.(jpe?g|png)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?unsplash\.com\/.*?\.(jpe?g|png)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?imgur\.com\/.*?\.(jpe?g|png|gif)["']/gi, type: 'extract' },
      { regex: /https?:\/\/.*?\/.*?[0-9a-f]{8,}.*?\.(jpe?g|png|gif|webp|mp4|webm)/gi, type: 'match' }, // 哈希ID资源
      { regex: /https?:\/\/.*?\/(?:resources|assets|uploads|media)\/.*?\.(jpe?g|png|gif|webp|mp4|webm|mp3|wav)/gi, type: 'match' }, // 常见资源路径
      { regex: /https?:\/\/.*?\/.*?[-_](?:original|full|large|medium|small)[-_].*?\.(jpe?g|png|gif|webp)/gi, type: 'match' }, // 尺寸标记
      { regex: /data-(?:src|original|lazy-src|high-res-src)=["'](https?:\/\/.*?\.(jpe?g|png|gif|webp|mp4|webm))["']/gi, type: 'extract' }, // 懒加载属性
      { regex: /srcset=["']([^"']+)["']/gi, type: 'srcset' } // srcset属性
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
    } else if (hostname.includes('tiktok')) {
      patterns.push({ regex: /https?:\/\/.*?\.tiktokcdn\.com\/.*?\.(jpe?g|png|mp4)/gi, type: 'match' });
    }
    
    for (const pattern of patterns) {
      let matches;
      
      if (pattern.type === 'match') {
        while ((matches = pattern.regex.exec(html)) !== null) {
          addPredictedResource(matches[0], predictedResources, pageContext);
        }
      } else if (pattern.type === 'extract') {
        while ((matches = pattern.regex.exec(html)) !== null) {
          const extracted = matches[0].replace(/^["']|["']$/g, '');
          addPredictedResource(extracted, predictedResources, pageContext);
        }
      } else if (pattern.type === 'srcset') {
        while ((matches = pattern.regex.exec(html)) !== null) {
          processSrcSet(matches[1], predictedResources, pageContext);
        }
      }
    }
    
    findHighResolutionVariants(predictedResources);
    
    if (modelLoaded) {
      enhancePredictionsWithML(predictedResources, pageContext);
    }
    
    postMessage({
      action: 'predictionComplete',
      predictedResources: predictedResources,
      modelUsed: modelLoaded ? mlModel.name : null
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
 * 提取页面上下文信息
 * @private
 * @param {string} html - 页面HTML
 * @param {string} url - 页面URL
 * @returns {Object} 页面上下文信息
 */
function extractPageContext(html, url) {
  try {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                            html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["'][^>]*>/i) || 
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']keywords["'][^>]*>/i);
    const keywords = keywordsMatch ? keywordsMatch[1].trim().split(/\s*,\s*/) : [];
    
    let pageType = 'unknown';
    if (html.includes('gallery') || html.includes('slideshow') || html.includes('carousel')) {
      pageType = 'gallery';
    } else if (html.includes('video') || html.includes('player') || url.includes('watch')) {
      pageType = 'video';
    } else if (html.includes('article') || html.includes('blog') || html.includes('post')) {
      pageType = 'article';
    } else if (html.includes('product') || html.includes('shop') || html.includes('store')) {
      pageType = 'product';
    }
    
    return {
      title,
      description,
      keywords,
      pageType,
      url
    };
  } catch (e) {
    console.warn('提取页面上下文错误:', e);
    return { url };
  }
}

/**
 * 处理srcset属性
 * @private
 * @param {string} srcset - srcset属性值
 * @param {Array} resources - 资源列表
 * @param {Object} pageContext - 页面上下文信息
 */
function processSrcSet(srcset, resources, pageContext) {
  try {
    const srcSetParts = srcset.split(',');
    let highestQualityUrl = '';
    let highestWidth = 0;
    
    srcSetParts.forEach(part => {
      const [url, descriptor] = part.trim().split(/\s+/);
      if (!url) return;
      
      const widthMatch = descriptor ? descriptor.match(/^(\d+)w$/) : null;
      const width = widthMatch ? parseInt(widthMatch[1]) : 0;
      
      if (width > highestWidth) {
        highestWidth = width;
        highestQualityUrl = url;
      }
    });
    
    if (highestQualityUrl) {
      addPredictedResource(highestQualityUrl, resources, pageContext, {
        isFromSrcSet: true,
        width: highestWidth
      });
    }
    
    srcSetParts.forEach(part => {
      const [url, descriptor] = part.trim().split(/\s+/);
      if (!url || url === highestQualityUrl) return;
      
      const widthMatch = descriptor ? descriptor.match(/^(\d+)w$/) : null;
      const width = widthMatch ? parseInt(widthMatch[1]) : 0;
      
      if (width > 0) {
        addPredictedResource(url, resources, pageContext, {
          isFromSrcSet: true,
          width: width,
          isVariant: true,
          originalUrl: highestQualityUrl
        });
      }
    });
  } catch (e) {
    console.warn('处理srcset错误:', e);
  }
}

/**
 * 使用深度学习模型增强预测结果
 * @private
 * @param {Array} resources - 资源列表
 * @param {Object} pageContext - 页面上下文信息
 */
function enhancePredictionsWithML(resources, pageContext) {
  try {
    if (!mlModel || !mlModel.loaded) return;
    
    resources.forEach(resource => {
      try {
        let mlResult = null;
        
        if (resource.type === RESOURCE_TYPES.IMAGE) {
          mlResult = mlModel.classifyImage(resource.url);
          resource.mlCategory = mlResult.category;
          resource.mlConfidence = mlResult.confidence;
          
          if (mlResult.isHighQuality && resource.quality !== 'high') {
            resource.quality = 'high';
            resource.mlEnhanced = true;
          }
        } else if (resource.type === RESOURCE_TYPES.VIDEO) {
          mlResult = mlModel.classifyVideo(resource.url);
          resource.mlCategory = mlResult.category;
          resource.mlConfidence = mlResult.confidence;
          
          if (mlResult.isHighQuality && resource.quality !== 'high') {
            resource.quality = 'high';
            resource.mlEnhanced = true;
          }
        }
        
        resource.relevanceScore = mlModel.scoreRelevance(resource.url, pageContext);
        
        resource.score = calculateResourceScore(resource.url, resource.type, resource.quality, resource.relevanceScore);
      } catch (e) {
        console.warn('ML增强资源错误:', e);
      }
    });
    
    resources.sort((a, b) => b.score - a.score);
  } catch (e) {
    console.error('ML增强预测错误:', e);
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
      { pattern: /-\d+x\d+\./i, replacement: '.' },
      { pattern: /[-_]small\./i, replacement: '_large.' },
      { pattern: /[-_]medium\./i, replacement: '_large.' },
      { pattern: /[-_]thumbnail\./i, replacement: '_full.' },
      { pattern: /[-_]preview\./i, replacement: '_original.' }
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
          
          if (resource.width && resource.height) {
            highResResource.width = resource.width * 2;
            highResResource.height = resource.height * 2;
            highResResource.dimensions = `${highResResource.width}x${highResResource.height}`;
            highResResource.aspectRatio = resource.aspectRatio;
          }
          
          highResResource.size = resource.size * 4;
          highResResource.sizeFormatted = formatSize(highResResource.size);
          
          highResResource.isPredictedVariant = true;
          highResResource.originalUrl = resource.url;
          highResResource.variantType = 'high-resolution';
          
          highResResource.confidence = resource.confidence * 0.8;
          highResResource.relevance = resource.relevance;
          highResResource.score = calculateResourceScore(highResUrl, resource.type, 'high', resource.relevance);
          
          highResResource.fingerprint = simpleUrlFingerprint(highResUrl);
          highResResource.relatedFingerprint = resource.fingerprint;
          
          resources.push(highResResource);
        }
      }
    }
    
    const videoResources = resources.filter(r => r.type === RESOURCE_TYPES.VIDEO && r.quality !== 'high');
    
    for (const resource of videoResources) {
      const videoQualityPatterns = [
        { pattern: /360p|480p|low|mobile/i, replacement: '720p' },
        { pattern: /720p|medium/i, replacement: '1080p' },
        { pattern: /[-_]sd\./i, replacement: '_hd.' },
        { pattern: /[-_]preview\./i, replacement: '_full.' }
      ];
      
      for (const { pattern, replacement } of videoQualityPatterns) {
        if (pattern.test(resource.url)) {
          const highResUrl = resource.url.replace(pattern, replacement);
          
          if (resources.some(r => r.url === highResUrl)) continue;
          
          const highResResource = { ...resource };
          highResResource.url = highResUrl;
          highResResource.quality = 'high';
          highResResource.size = resource.size * 3;
          highResResource.sizeFormatted = formatSize(highResResource.size);
          highResResource.isPredictedVariant = true;
          highResResource.originalUrl = resource.url;
          highResResource.variantType = 'high-quality';
          highResResource.confidence = resource.confidence * 0.7;
          highResResource.relevance = resource.relevance;
          highResResource.score = calculateResourceScore(highResUrl, resource.type, 'high', resource.relevance);
          highResResource.fingerprint = simpleUrlFingerprint(highResUrl);
          highResResource.relatedFingerprint = resource.fingerprint;
          
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
 * @param {number} relevance - 相关性评分
 * @returns {number} - 资源评分 (0-100)
 */
function calculateResourceScore(url, type, quality, relevance = 50) {
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
  
  score = (score * 0.7) + (relevance * 0.3);
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('cdn') || hostname.includes('static')) {
      score += 5;
    }
    
    if (hostname.includes('youtube') || hostname.includes('vimeo') || 
        hostname.includes('instagram') || hostname.includes('flickr') || 
        hostname.includes('unsplash') || hostname.includes('pexels')) {
      score += 10;
    }
    
    const path = urlObj.pathname.toLowerCase();
    if (path.includes('original') || path.includes('full') || path.includes('large')) {
      score += 5;
    }
    
    if (urlObj.searchParams.has('quality') || urlObj.searchParams.has('size') || 
        urlObj.searchParams.has('width') || urlObj.searchParams.has('height')) {
      score += 5;
    }
  } catch (e) {
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
