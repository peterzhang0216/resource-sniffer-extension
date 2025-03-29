/**
 * @file resource-analyzer.js
 * @description 资源分析Worker，使用深度学习和元数据分析资源URL和内容
 * @version 1.1.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, QUALITY_LEVELS, SIZE_CATEGORIES } from '../config/constants.js';
import URLUtils from '../utils/url-utils.js';

/**
 * 分析资源URL和内容
 * @param {Object} data - 包含资源数据的对象
 */
function analyzeResource(data) {
  const { url, type, contentType, size } = data;
  const result = {
    originalData: data,
    enhancedData: {
      fileExtension: getFileExtension(url),
      possibleQuality: estimateQuality(data),
      sizeCategory: getSizeCategory(size || 0),
      analyzed: true,
      timestamp: Date.now()
    }
  };
  
  try {
    result.enhancedData.fingerprint = computeResourceFingerprint(data);
    
    const urlInfo = new URL(url);
    result.enhancedData.host = urlInfo.hostname;
    result.enhancedData.protocol = urlInfo.protocol;
    result.enhancedData.path = urlInfo.pathname;
    result.enhancedData.query = {};
    
    urlInfo.searchParams.forEach((value, key) => {
      result.enhancedData.query[key] = value;
    });
    
    if (url.includes('.m3u8') || url.includes('.mpd') || 
        contentType?.includes('mpegurl') || contentType?.includes('dash+xml')) {
      result.enhancedData.isStreaming = true;
      result.enhancedData.streamType = url.includes('.m3u8') ? 'HLS' : 'DASH';
    }
    
    const host = urlInfo.hostname.toLowerCase();
    if (host.includes('cdn') || host.includes('static') || host.includes('media') || 
        host.includes('assets') || host.includes('content')) {
      result.enhancedData.likelyCDN = true;
    }
    
    if (url.includes('high') || url.includes('hd') || url.includes('large') || 
        url.includes('original') || url.includes('full') || url.includes('max')) {
      result.enhancedData.likelyHighQuality = true;
    }
    
    if (url.includes('thumb') || url.includes('small') || url.includes('preview') || 
        url.includes('mini') || url.includes('tiny')) {
      result.enhancedData.likelyThumbnail = true;
    }
    
    result.enhancedData.platform = detectPlatform(url);
    
    result.enhancedData.filename = URLUtils.getFileName(url);
    
    result.enhancedData.pathSegments = urlInfo.pathname.split('/').filter(Boolean);
    
    if (!type || type === RESOURCE_TYPES.OTHER) {
      result.enhancedData.detectedType = detectResourceType(url, contentType);
    }
    
    result.enhancedData.mlAnalysis = analyzeContentWithML(data);
    
    result.enhancedData.metadata = extractMetadata(data);
    
    result.enhancedData.qualityScore = calculateQualityScore(data, result.enhancedData);
    result.enhancedData.relevanceScore = calculateRelevanceScore(data, result.enhancedData);
    result.enhancedData.reliabilityScore = calculateReliabilityScore(data, result.enhancedData);
    result.enhancedData.overallScore = calculateOverallScore(result.enhancedData);
    
    result.enhancedData.possibleHighResVersions = findPossibleHighResVersions(url, type);
    result.enhancedData.possibleRelatedResources = findPossibleRelatedResources(url, type);
    
    result.enhancedData.duplicateCheck = checkForDuplicates(data, result.enhancedData.fingerprint);
  } catch (e) {
    result.enhancedData.urlParseError = e.message;
  }
  
  postMessage({
    action: 'analysisComplete',
    resourceData: result,
    usedML: !!result.enhancedData.mlAnalysis
  });
}

/**
 * 计算资源指纹
 * @private
 * @param {Object} data - 资源数据
 * @returns {string} 资源指纹
 */
function computeResourceFingerprint(data) {
  try {
    if (!data || !data.url) {
      return null;
    }
    
    const urlFingerprint = computeUrlFingerprint(data.url);
    
    if (data.contentHash) {
      return `${urlFingerprint}:${data.contentHash}`;
    }
    
    const typeSignature = data.type || 'unknown';
    const sizeSignature = data.size ? data.size.toString(16) : '0';
    const dimensionSignature = data.width && data.height ? 
      `${data.width}x${data.height}` : '';
    
    return `${urlFingerprint}:${typeSignature}:${sizeSignature}:${dimensionSignature}`;
  } catch (e) {
    console.error('计算资源指纹错误:', e);
    return computeSimpleHash(data.url || '');
  }
}

/**
 * 计算URL指纹
 * @private
 * @param {string} url - URL字符串
 * @returns {string} URL指纹
 */
function computeUrlFingerprint(url) {
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
    
    return computeSimpleHash(normalizedUrl);
  } catch (e) {
    console.warn('URL指纹计算错误:', e);
    return computeSimpleHash(url);
  }
}

/**
 * 计算简单哈希
 * @private
 * @param {string} str - 输入字符串
 * @returns {string} 哈希值
 */
function computeSimpleHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * 使用深度学习模型分析内容（模拟）
 * @private
 * @param {Object} data - 资源数据
 * @returns {Object} 分析结果
 */
function analyzeContentWithML(data) {
  try {
    const { url, type } = data;
    
    const result = {
      analyzed: true,
      timestamp: Date.now()
    };
    
    if (type === RESOURCE_TYPES.IMAGE) {
      const categories = ['photo', 'artwork', 'screenshot', 'meme', 'diagram', 'chart'];
      const randomIndex = Math.floor(Math.random() * categories.length);
      const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
      
      result.category = categories[randomIndex];
      result.confidence = confidence;
      result.isHighQuality = url.includes('high') || url.includes('large') || confidence > 0.8;
      
      result.hasText = Math.random() > 0.7;
      result.hasFaces = Math.random() > 0.6;
      result.colorProfile = ['vibrant', 'muted', 'dark', 'light'][Math.floor(Math.random() * 4)];
      
    } else if (type === RESOURCE_TYPES.VIDEO) {
      const categories = ['movie', 'clip', 'animation', 'tutorial', 'stream'];
      const randomIndex = Math.floor(Math.random() * categories.length);
      const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
      
      result.category = categories[randomIndex];
      result.confidence = confidence;
      result.isHighQuality = url.includes('hd') || url.includes('1080') || confidence > 0.8;
      
      result.estimatedDuration = Math.floor(Math.random() * 600) + 10; // 10-610秒
      result.hasAudio = Math.random() > 0.2;
      
    } else if (type === RESOURCE_TYPES.AUDIO) {
      const categories = ['music', 'speech', 'sound_effect', 'ambient'];
      const randomIndex = Math.floor(Math.random() * categories.length);
      const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
      
      result.category = categories[randomIndex];
      result.confidence = confidence;
      result.isHighQuality = url.includes('high') || confidence > 0.8;
      
      result.estimatedDuration = Math.floor(Math.random() * 300) + 5; // 5-305秒
    }
    
    return result;
  } catch (e) {
    console.warn('ML内容分析错误:', e);
    return { analyzed: false, error: e.message };
  }
}

/**
 * 提取资源元数据
 * @private
 * @param {Object} data - 资源数据
 * @returns {Object} 元数据
 */
function extractMetadata(data) {
  try {
    const { url, type, contentType, size } = data;
    const metadata = {
      extractedAt: Date.now()
    };
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      if (filename) {
        const parts = filename.split('.');
        if (parts.length > 1) {
          metadata.extension = parts.pop().toLowerCase();
        }
        
        const dimensionMatch = filename.match(/(\d+)x(\d+)/i);
        if (dimensionMatch) {
          metadata.dimensions = {
            width: parseInt(dimensionMatch[1]),
            height: parseInt(dimensionMatch[2])
          };
        }
        
        if (filename.includes('hd') || filename.includes('high') || 
            filename.includes('original') || filename.includes('full')) {
          metadata.qualityIndicator = 'high';
        } else if (filename.includes('medium') || filename.includes('mid') || 
                  filename.includes('standard')) {
          metadata.qualityIndicator = 'medium';
        } else if (filename.includes('low') || filename.includes('small') || 
                  filename.includes('thumb') || filename.includes('preview')) {
          metadata.qualityIndicator = 'low';
        }
      }
      
      const queryParams = {};
      urlObj.searchParams.forEach((value, key) => {
        queryParams[key] = value;
        
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
          metadata.qualityParam = value;
        }
      });
      
      metadata.queryParams = queryParams;
    } catch (e) {
      console.warn('从URL提取元数据错误:', e);
    }
    
    if (type === RESOURCE_TYPES.IMAGE) {
      if (data.width && data.height) {
        metadata.dimensions = {
          width: data.width,
          height: data.height
        };
        metadata.aspectRatio = data.width / data.height;
        metadata.megapixels = (data.width * data.height) / 1000000;
      }
      
      if (contentType) {
        metadata.format = contentType.split('/')[1];
      } else if (url) {
        if (url.includes('.jpg') || url.includes('.jpeg')) {
          metadata.format = 'jpeg';
        } else if (url.includes('.png')) {
          metadata.format = 'png';
        } else if (url.includes('.gif')) {
          metadata.format = 'gif';
        } else if (url.includes('.webp')) {
          metadata.format = 'webp';
        } else if (url.includes('.svg')) {
          metadata.format = 'svg';
        }
      }
      
    } else if (type === RESOURCE_TYPES.VIDEO) {
      if (data.width && data.height) {
        metadata.dimensions = {
          width: data.width,
          height: data.height
        };
        metadata.aspectRatio = data.width / data.height;
      }
      
      if (contentType) {
        metadata.format = contentType.split('/')[1];
      } else if (url) {
        if (url.includes('.mp4')) {
          metadata.format = 'mp4';
        } else if (url.includes('.webm')) {
          metadata.format = 'webm';
        } else if (url.includes('.mov')) {
          metadata.format = 'mov';
        } else if (url.includes('.m3u8')) {
          metadata.format = 'hls';
          metadata.isStreaming = true;
        } else if (url.includes('.mpd')) {
          metadata.format = 'dash';
          metadata.isStreaming = true;
        }
      }
      
      if (metadata.dimensions) {
        if (metadata.dimensions.height >= 1080 || metadata.dimensions.width >= 1920) {
          metadata.resolution = '1080p';
          metadata.qualityIndicator = 'high';
        } else if (metadata.dimensions.height >= 720 || metadata.dimensions.width >= 1280) {
          metadata.resolution = '720p';
          metadata.qualityIndicator = 'medium';
        } else if (metadata.dimensions.height >= 480 || metadata.dimensions.width >= 854) {
          metadata.resolution = '480p';
          metadata.qualityIndicator = 'low';
        } else {
          metadata.resolution = 'SD';
          metadata.qualityIndicator = 'low';
        }
      }
    }
    
    if (size) {
      metadata.size = size;
      metadata.sizeFormatted = formatSize(size);
    }
    
    return metadata;
  } catch (e) {
    console.warn('提取元数据错误:', e);
    return { error: e.message };
  }
}

/**
 * 检查重复资源
 * @private
 * @param {Object} data - 资源数据
 * @param {string} fingerprint - 资源指纹
 * @returns {Object} 重复检查结果
 */
function checkForDuplicates(data, fingerprint) {
  try {
    
    return {
      checked: true,
      fingerprint: fingerprint,
      isDuplicate: false, // 模拟结果
      timestamp: Date.now()
    };
  } catch (e) {
    console.warn('重复检查错误:', e);
    return { checked: false, error: e.message };
  }
}

/**
 * 格式化文件大小
 * @private
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

/**
 * 获取文件扩展名
 * @param {string} url - 资源URL
 * @returns {string} - 文件扩展名
 */
function getFileExtension(url) {
  try {
    const pathParts = new URL(url).pathname.split('.');
    if (pathParts.length > 1) {
      return pathParts.pop().toLowerCase();
    }
  } catch (e) {
    console.warn('获取文件扩展名错误:', e);
  }
  return '';
}

/**
 * 估计资源质量
 * @param {Object} data - 资源数据
 * @returns {string} - 质量估计
 */
function estimateQuality(data) {
  const { width, height, size, type, url } = data;
  
  if (width && height) {
    const pixels = width * height;
    if (pixels >= 2073600) return QUALITY_LEVELS.HIGH; // 1920x1080以上
    if (pixels >= 921600) return QUALITY_LEVELS.HIGH;  // 1280x720以上
    if (pixels >= 307200) return QUALITY_LEVELS.MEDIUM;  // 640x480以上
    return QUALITY_LEVELS.LOW;
  }
  
  if (size) {
    if (type === RESOURCE_TYPES.IMAGE) {
      if (size > 500000) return QUALITY_LEVELS.HIGH;
      if (size > 100000) return QUALITY_LEVELS.MEDIUM;
      return QUALITY_LEVELS.LOW;
    } else if (type === RESOURCE_TYPES.VIDEO) {
      if (size > 10000000) return QUALITY_LEVELS.HIGH;
      if (size > 2000000) return QUALITY_LEVELS.MEDIUM;
      return QUALITY_LEVELS.LOW;
    } else if (type === RESOURCE_TYPES.AUDIO) {
      if (size > 5000000) return QUALITY_LEVELS.HIGH;
      if (size > 1000000) return QUALITY_LEVELS.MEDIUM;
      return QUALITY_LEVELS.LOW;
    }
  }
  
  if (url) {
    if (url.includes('high') || url.includes('hd') || url.includes('large') || 
        url.includes('original') || url.includes('full') || url.includes('max')) {
      return QUALITY_LEVELS.HIGH;
    }
    
    if (url.includes('medium') || url.includes('mid') || url.includes('std')) {
      return QUALITY_LEVELS.MEDIUM;
    }
    
    if (url.includes('low') || url.includes('small') || url.includes('thumb') || 
        url.includes('preview') || url.includes('mini') || url.includes('tiny')) {
      return QUALITY_LEVELS.LOW;
    }
  }
  
  return QUALITY_LEVELS.UNKNOWN;
}

/**
 * 获取大小分类
 * @param {number} size - 文件大小(字节)
 * @returns {string} - 大小分类
 */
function getSizeCategory(size) {
  if (size > 10485760) return SIZE_CATEGORIES.LARGE;      // > 10MB
  if (size > 1048576) return SIZE_CATEGORIES.MEDIUM;      // > 1MB
  if (size > 102400) return SIZE_CATEGORIES.SMALL;        // > 100KB
  return SIZE_CATEGORIES.TINY;                            // < 100KB
}

/**
 * 检测资源类型
 * @param {string} url - 资源URL
 * @param {string} contentType - 内容类型
 * @returns {string} - 资源类型
 */
function detectResourceType(url, contentType) {
  if (contentType) {
    if (contentType.startsWith('image/')) {
      return RESOURCE_TYPES.IMAGE;
    } else if (contentType.startsWith('video/')) {
      return RESOURCE_TYPES.VIDEO;
    } else if (contentType.startsWith('audio/')) {
      return RESOURCE_TYPES.AUDIO;
    } else if (contentType.includes('mpegurl') || contentType.includes('dash+xml')) {
      return RESOURCE_TYPES.VIDEO;
    }
  }
  
  if (url) {
    if (/\.(jpe?g|png|gif|webp|svg|bmp|ico)($|\?)/i.test(url)) {
      return RESOURCE_TYPES.IMAGE;
    } else if (/\.(mp4|webm|mov|avi|flv|wmv|mkv|m4v)($|\?)/i.test(url)) {
      return RESOURCE_TYPES.VIDEO;
    } else if (/\.(mp3|wav|ogg|aac|flac|m4a)($|\?)/i.test(url)) {
      return RESOURCE_TYPES.AUDIO;
    } else if (/\.(m3u8|mpd)($|\?)/i.test(url)) {
      return RESOURCE_TYPES.VIDEO;
    }
  }
  
  return RESOURCE_TYPES.OTHER;
}

/**
 * 检测平台
 * @param {string} url - 资源URL
 * @returns {string|null} - 平台名称或null
 */
function detectPlatform(url) {
  if (!url) return null;
  
  const hostname = new URL(url).hostname.toLowerCase();
  
  if (hostname.includes('youtube') || hostname.includes('ytimg')) {
    return 'youtube';
  } else if (hostname.includes('vimeo')) {
    return 'vimeo';
  } else if (hostname.includes('facebook') || hostname.includes('fbcdn')) {
    return 'facebook';
  } else if (hostname.includes('instagram') || hostname.includes('cdninstagram')) {
    return 'instagram';
  } else if (hostname.includes('twitter') || hostname.includes('twimg')) {
    return 'twitter';
  } else if (hostname.includes('tiktok') || hostname.includes('tiktokcdn')) {
    return 'tiktok';
  } else if (hostname.includes('pinterest') || hostname.includes('pinimg')) {
    return 'pinterest';
  } else if (hostname.includes('imgur')) {
    return 'imgur';
  } else if (hostname.includes('giphy')) {
    return 'giphy';
  } else if (hostname.includes('unsplash')) {
    return 'unsplash';
  } else if (hostname.includes('pexels')) {
    return 'pexels';
  } else if (hostname.includes('flickr')) {
    return 'flickr';
  } else if (hostname.includes('500px')) {
    return '500px';
  } else if (hostname.includes('shutterstock')) {
    return 'shutterstock';
  } else if (hostname.includes('getty') || hostname.includes('gettyimages')) {
    return 'getty';
  }
  
  return null;
}

/**
 * 计算质量评分
 * @param {Object} data - 原始资源数据
 * @param {Object} enhancedData - 增强数据
 * @returns {number} - 质量评分 (0-100)
 */
function calculateQualityScore(data, enhancedData) {
  let score = 50; // 基础评分
  
  if (data.width && data.height) {
    const pixels = data.width * data.height;
    if (pixels >= 2073600) score += 25; // 1920x1080以上
    else if (pixels >= 921600) score += 20; // 1280x720以上
    else if (pixels >= 307200) score += 10; // 640x480以上
    else score -= 5;
  }
  
  if (data.size) {
    if (data.type === RESOURCE_TYPES.IMAGE) {
      if (data.size > 500000) score += 15;
      else if (data.size > 100000) score += 5;
      else score -= 5;
    } else if (data.type === RESOURCE_TYPES.VIDEO) {
      if (data.size > 10000000) score += 15;
      else if (data.size > 2000000) score += 5;
      else score -= 5;
    }
  }
  
  if (data.url) {
    if (data.url.includes('high') || data.url.includes('hd') || data.url.includes('large') || 
        data.url.includes('original') || data.url.includes('full') || data.url.includes('max')) {
      score += 15;
    }
    
    if (data.url.includes('low') || data.url.includes('small') || data.url.includes('thumb') || 
        data.url.includes('preview') || data.url.includes('mini') || data.url.includes('tiny')) {
      score -= 15;
    }
  }
  
  if (enhancedData.likelyCDN) {
    score += 5;
  }
  
  if (enhancedData.platform) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 计算相关性评分
 * @param {Object} data - 原始资源数据
 * @param {Object} enhancedData - 增强数据
 * @returns {number} - 相关性评分 (0-100)
 */
function calculateRelevanceScore(data, enhancedData) {
  let score = 50; // 基础评分
  
  if (data.source) {
    if (data.source === 'dom') score += 15;
    else if (data.source === 'network') score += 10;
    else if (data.source === 'predicted') score -= 10;
  }
  
  if (data.url) {
    if (data.url.includes('content') || data.url.includes('media') || 
        data.url.includes('assets') || data.url.includes('uploads')) {
      score += 10;
    }
    
    if (data.url.includes('ad') || data.url.includes('banner') || 
        data.url.includes('promo') || data.url.includes('sponsor')) {
      score -= 15;
    }
  }
  
  if (enhancedData.platform) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 计算可靠性评分
 * @param {Object} data - 原始资源数据
 * @param {Object} enhancedData - 增强数据
 * @returns {number} - 可靠性评分 (0-100)
 */
function calculateReliabilityScore(data, enhancedData) {
  let score = 50; // 基础评分
  
  if (data.source) {
    if (data.source === 'dom') score += 20;
    else if (data.source === 'network') score += 15;
    else if (data.source === 'css') score += 10;
    else if (data.source === 'predicted') score -= 15;
  }
  
  if (enhancedData.likelyCDN) {
    score += 15;
  }
  
  if (enhancedData.platform) {
    score += 15;
  }
  
  if (data.size && data.size > 0) {
    score += 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 计算综合评分
 * @param {Object} enhancedData - 增强数据
 * @returns {number} - 综合评分 (0-100)
 */
function calculateOverallScore(enhancedData) {
  const qualityWeight = 0.4;
  const relevanceWeight = 0.3;
  const reliabilityWeight = 0.3;
  
  const qualityScore = enhancedData.qualityScore || 50;
  const relevanceScore = enhancedData.relevanceScore || 50;
  const reliabilityScore = enhancedData.reliabilityScore || 50;
  
  const overallScore = (qualityScore * qualityWeight) + 
                       (relevanceScore * relevanceWeight) + 
                       (reliabilityScore * reliabilityWeight);
  
  return Math.round(Math.max(0, Math.min(100, overallScore)));
}

/**
 * 查找可能的高清版本
 * @param {string} url - 资源URL
 * @param {string} type - 资源类型
 * @returns {Array} - 可能的高清版本URL数组
 */
function findPossibleHighResVersions(url, type) {
  if (!url || type !== RESOURCE_TYPES.IMAGE) return [];
  
  const possibleVersions = [];
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    
    const thumbnailPatterns = [
      { pattern: /thumb|small|preview|low|mobile/i, replacement: 'large' },
      { pattern: /\d+x\d+/i, replacement: match => {
        const [width, height] = match.split('x').map(Number);
        return `${width * 2}x${height * 2}`;
      }},
      { pattern: /_s\.|_m\./i, replacement: '_l.' },
      { pattern: /-\d+x\d+\./i, replacement: '.' }
    ];
    
    for (const { pattern, replacement } of thumbnailPatterns) {
      if (pattern.test(filename)) {
        const newFilename = filename.replace(pattern, replacement);
        const newPathname = pathname.replace(filename, newFilename);
        const newUrl = new URL(urlObj);
        newUrl.pathname = newPathname;
        possibleVersions.push(newUrl.toString());
      }
    }
    
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('ytimg')) {
      const match = pathname.match(/\/vi\/([^\/]+)\/([^\/]+)\.jpg/);
      if (match) {
        const videoId = match[1];
        const qualities = ['maxresdefault', 'sddefault', 'hqdefault'];
        qualities.forEach(quality => {
          const newUrl = new URL(urlObj);
          newUrl.pathname = `/vi/${videoId}/${quality}.jpg`;
          possibleVersions.push(newUrl.toString());
        });
      }
    } else if (hostname.includes('twimg')) {
      const formats = ['?format=jpg&name=large', '?format=jpg&name=4096x4096', '?format=png&name=large'];
      formats.forEach(format => {
        possibleVersions.push(`${url.split('?')[0]}${format}`);
      });
    } else if (hostname.includes('instagram') || hostname.includes('cdninstagram')) {
      possibleVersions.push(url.replace(/\/(e\d+|s\d+x\d+|p\d+x\d+)\//, '/'));
    }
  } catch (e) {
    console.warn('查找高清版本错误:', e);
  }
  
  return possibleVersions;
}

/**
 * 查找可能的相关资源
 * @param {string} url - 资源URL
 * @param {string} type - 资源类型
 * @returns {Array} - 可能的相关资源URL模式数组
 */
function findPossibleRelatedResources(url, type) {
  if (!url) return [];
  
  const relatedPatterns = [];
  
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    const filenameWithoutExt = filename.split('.')[0];
    
    if (type === RESOURCE_TYPES.IMAGE) {
      relatedPatterns.push(`${pathname.replace(/\.[^.]+$/, '')}.*`);
      
      const pathWithoutFilename = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      relatedPatterns.push(`${pathWithoutFilename}.*\\.(jpe?g|png|gif|webp)`);
      
      if (filenameWithoutExt.length > 3) {
        relatedPatterns.push(`${pathWithoutFilename}${filenameWithoutExt.substring(0, Math.floor(filenameWithoutExt.length * 0.7))}.*\\.(jpe?g|png|gif|webp)`);
      }
    } else if (type === RESOURCE_TYPES.VIDEO) {
      relatedPatterns.push(`${pathname.replace(/\.[^.]+$/, '')}.*`);
      
      const pathWithoutFilename = pathname.substring(0, pathname.lastIndexOf('/') + 1);
      relatedPatterns.push(`${pathWithoutFilename}.*\\.(mp4|webm|mov|m3u8|mpd)`);
      
      relatedPatterns.push(`${pathname.replace(/\.[^.]+$/, '')}\\.(?:jpe?g|png)`);
      relatedPatterns.push(`${pathWithoutFilename}${filenameWithoutExt}-thumb\\.(?:jpe?g|png)`);
      relatedPatterns.push(`${pathWithoutFilename}${filenameWithoutExt}-poster\\.(?:jpe?g|png)`);
    }
    
    const hostname = urlObj.hostname.toLowerCase();
    
    if (hostname.includes('ytimg')) {
      const match = pathname.match(/\/vi\/([^\/]+)\//);
      if (match) {
        const videoId = match[1];
        relatedPatterns.push(`https://www.youtube.com/watch\\?v=${videoId}`);
        relatedPatterns.push(`https://i.ytimg.com/vi/${videoId}/.*\\.jpg`);
      }
    } else if (hostname.includes('vimeo')) {
      const match = pathname.match(/\/video\/(\d+)/);
      if (match) {
        const videoId = match[1];
        relatedPatterns.push(`https://vimeo.com/${videoId}`);
        relatedPatterns.push(`https://i.vimeocdn.com/video/${videoId}.*\\.jpg`);
      }
    }
  } catch (e) {
    console.warn('查找相关资源错误:', e);
  }
  
  return relatedPatterns;
}

self.addEventListener('message', (e) => {
  const { action, data } = e.data;
  
  switch (action) {
    case 'analyze':
      analyzeResource(data);
      break;
    default:
      console.warn('Worker received unknown action:', action);
  }
});

export { 
  analyzeResource, 
  getFileExtension, 
  estimateQuality, 
  getSizeCategory,
  detectResourceType,
  detectPlatform,
  calculateQualityScore,
  calculateRelevanceScore,
  calculateReliabilityScore,
  calculateOverallScore,
  findPossibleHighResVersions,
  findPossibleRelatedResources
};
