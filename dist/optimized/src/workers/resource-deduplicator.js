/**
 * @file resource-deduplicator.js
 * @description 资源去重Worker，使用指纹和相似度分析去除重复资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES } from '../config/constants.js';

const fingerprintCache = new Map();
const SIMILARITY_THRESHOLD = 0.85;

/**
 * 去除重复资源
 * @param {Object} data - 包含资源列表的对象
 */
function deduplicateResources(data) {
  const { resources } = data;
  
  try {
    if (!resources || !Array.isArray(resources) || resources.length === 0) {
      postMessage({
        action: 'deduplicationComplete',
        resources: [],
        stats: { total: 0, duplicates: 0, similar: 0, unique: 0 }
      });
      return;
    }
    
    console.log(`开始去重处理 ${resources.length} 个资源...`);
    
    const stats = {
      total: resources.length,
      duplicates: 0,
      similar: 0,
      unique: 0,
      byType: {}
    };
    
    const resourcesByType = {};
    resources.forEach(resource => {
      const type = resource.type || 'unknown';
      resourcesByType[type] = resourcesByType[type] || [];
      resourcesByType[type].push(resource);
      
      stats.byType[type] = stats.byType[type] || { total: 0, duplicates: 0, similar: 0, unique: 0 };
      stats.byType[type].total++;
    });
    
    const uniqueResources = [];
    const duplicateResources = [];
    const similarResources = [];
    
    Object.keys(resourcesByType).forEach(type => {
      const typeResources = resourcesByType[type];
      const { unique, duplicates, similar } = deduplicateResourceGroup(typeResources);
      
      uniqueResources.push(...unique);
      duplicateResources.push(...duplicates);
      similarResources.push(...similar);
      
      stats.byType[type].unique = unique.length;
      stats.byType[type].duplicates = duplicates.length;
      stats.byType[type].similar = similar.length;
    });
    
    stats.unique = uniqueResources.length;
    stats.duplicates = duplicateResources.length;
    stats.similar = similarResources.length;
    
    console.log(`去重完成: 唯一资源 ${stats.unique}, 重复资源 ${stats.duplicates}, 相似资源 ${stats.similar}`);
    
    postMessage({
      action: 'deduplicationComplete',
      resources: uniqueResources,
      duplicates: duplicateResources,
      similar: similarResources,
      stats: stats
    });
  } catch (e) {
    console.error('资源去重错误:', e);
    postMessage({
      action: 'deduplicationComplete',
      resources: resources || [],
      error: e.message,
      stats: { total: resources ? resources.length : 0, error: true }
    });
  }
}

/**
 * 对资源组进行去重
 * @private
 * @param {Array} resources - 资源数组
 * @returns {Object} 去重结果
 */
function deduplicateResourceGroup(resources) {
  const unique = [];
  const duplicates = [];
  const similar = [];
  
  const fingerprintMap = new Map();
  
  resources.forEach(resource => {
    const fingerprint = resource.fingerprint || computeResourceFingerprint(resource);
    
    if (fingerprintMap.has(fingerprint)) {
      const existingResource = fingerprintMap.get(fingerprint);
      
      resource.isDuplicate = true;
      resource.duplicateOf = existingResource.url;
      resource.duplicateFingerprint = fingerprint;
      
      if (getResourceQualityScore(resource) > getResourceQualityScore(existingResource)) {
        fingerprintMap.set(fingerprint, resource);
        
        const index = unique.indexOf(existingResource);
        if (index !== -1) {
          unique.splice(index, 1);
        }
        duplicates.push(existingResource);
        unique.push(resource);
      } else {
        duplicates.push(resource);
      }
    } else {
      fingerprintMap.set(fingerprint, resource);
      resource.fingerprint = fingerprint;
      unique.push(resource);
    }
  });
  
  if (unique.length > 1) {
    const similarityGroups = findSimilarResources(unique);
    
    similarityGroups.forEach(group => {
      if (group.resources.length <= 1) return;
      
      let bestResource = group.resources[0];
      let bestScore = getResourceQualityScore(bestResource);
      
      for (let i = 1; i < group.resources.length; i++) {
        const resource = group.resources[i];
        const score = getResourceQualityScore(resource);
        
        if (score > bestScore) {
          resource.isSimilar = true;
          resource.similarTo = bestResource.url;
          resource.similarity = group.similarities[i];
          similar.push(bestResource);
          
          bestResource = resource;
          bestScore = score;
        } else {
          resource.isSimilar = true;
          resource.similarTo = bestResource.url;
          resource.similarity = group.similarities[i];
          similar.push(resource);
        }
      }
      
      group.resources.forEach(resource => {
        if (resource !== bestResource) {
          const index = unique.indexOf(resource);
          if (index !== -1) {
            unique.splice(index, 1);
          }
        }
      });
    });
  }
  
  return { unique, duplicates, similar };
}

/**
 * 查找相似资源
 * @private
 * @param {Array} resources - 资源数组
 * @returns {Array} 相似资源组
 */
function findSimilarResources(resources) {
  const similarityGroups = [];
  
  const urlPatternGroups = groupByUrlPattern(resources);
  
  Object.values(urlPatternGroups).forEach(group => {
    if (group.length <= 1) return;
    
    for (let i = 0; i < group.length; i++) {
      const resource1 = group[i];
      
      for (let j = i + 1; j < group.length; j++) {
        const resource2 = group[j];
        
        const similarity = calculateResourceSimilarity(resource1, resource2);
        
        if (similarity >= SIMILARITY_THRESHOLD) {
          let foundGroup = false;
          
          for (const existingGroup of similarityGroups) {
            if (existingGroup.resources.includes(resource1) || existingGroup.resources.includes(resource2)) {
              if (!existingGroup.resources.includes(resource1)) {
                existingGroup.resources.push(resource1);
                existingGroup.similarities.push(similarity);
              }
              if (!existingGroup.resources.includes(resource2)) {
                existingGroup.resources.push(resource2);
                existingGroup.similarities.push(similarity);
              }
              foundGroup = true;
              break;
            }
          }
          
          if (!foundGroup) {
            similarityGroups.push({
              resources: [resource1, resource2],
              similarities: [similarity, similarity]
            });
          }
        }
      }
    }
  });
  
  return similarityGroups;
}

/**
 * 按URL模式分组资源
 * @private
 * @param {Array} resources - 资源数组
 * @returns {Object} 分组结果
 */
function groupByUrlPattern(resources) {
  const groups = {};
  
  resources.forEach(resource => {
    try {
      if (!resource.url) return;
      
      const urlObj = new URL(resource.url);
      const hostname = urlObj.hostname;
      const pathPattern = extractPathPattern(urlObj.pathname);
      
      const groupKey = `${hostname}:${pathPattern}`;
      
      groups[groupKey] = groups[groupKey] || [];
      groups[groupKey].push(resource);
    } catch (e) {
    }
  });
  
  return groups;
}

/**
 * 提取路径模式
 * @private
 * @param {string} path - URL路径
 * @returns {string} 路径模式
 */
function extractPathPattern(path) {
  return path
    .replace(/\/\d+\//, '/N/') // 替换数字目录
    .replace(/\/[0-9a-f]{8,}\//, '/ID/') // 替换ID目录
    .replace(/[-_]\d+x\d+/, '') // 移除尺寸后缀
    .replace(/[-_](?:small|medium|large|thumb|preview)/, '') // 移除尺寸描述
    .replace(/\.\w+$/, '.EXT'); // 替换扩展名
}

/**
 * 计算资源相似度
 * @private
 * @param {Object} resource1 - 第一个资源
 * @param {Object} resource2 - 第二个资源
 * @returns {number} 相似度 (0-1)
 */
function calculateResourceSimilarity(resource1, resource2) {
  try {
    if (resource1.type !== resource2.type) {
      return 0;
    }
    
    const urlSimilarity = calculateUrlSimilarity(resource1.url, resource2.url);
    
    let dimensionSimilarity = 1;
    if (resource1.width && resource1.height && resource2.width && resource2.height) {
      const area1 = resource1.width * resource1.height;
      const area2 = resource2.width * resource2.height;
      dimensionSimilarity = Math.min(area1 / area2, area2 / area1);
    }
    
    const filenameSimilarity = calculateStringSimilarity(
      getFilenameFromUrl(resource1.url),
      getFilenameFromUrl(resource2.url)
    );
    
    return (urlSimilarity * 0.5) + (dimensionSimilarity * 0.3) + (filenameSimilarity * 0.2);
  } catch (e) {
    console.warn('计算资源相似度错误:', e);
    return 0;
  }
}

/**
 * 计算URL相似度
 * @private
 * @param {string} url1 - 第一个URL
 * @param {string} url2 - 第二个URL
 * @returns {number} 相似度 (0-1)
 */
function calculateUrlSimilarity(url1, url2) {
  try {
    const urlObj1 = new URL(url1);
    const urlObj2 = new URL(url2);
    
    if (urlObj1.hostname !== urlObj2.hostname) {
      return 0.1;
    }
    
    const pathSimilarity = calculateStringSimilarity(urlObj1.pathname, urlObj2.pathname);
    
    return pathSimilarity;
  } catch (e) {
    return calculateStringSimilarity(url1, url2);
  }
}

/**
 * 计算字符串相似度 (Levenshtein距离的归一化版本)
 * @private
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} 相似度 (0-1)
 */
function calculateStringSimilarity(str1, str2) {
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
 * 从URL获取文件名
 * @private
 * @param {string} url - URL字符串
 * @returns {string} 文件名
 */
function getFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop();
    return filename || '';
  } catch (e) {
    const parts = url.split('/');
    return parts[parts.length - 1] || '';
  }
}

/**
 * 计算资源指纹
 * @private
 * @param {Object} resource - 资源对象
 * @returns {string} 资源指纹
 */
function computeResourceFingerprint(resource) {
  try {
    if (!resource || !resource.url) {
      return null;
    }
    
    const urlFingerprint = computeUrlFingerprint(resource.url);
    
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
    return computeSimpleHash(resource.url || '');
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
 * 获取资源质量评分
 * @private
 * @param {Object} resource - 资源对象
 * @returns {number} 质量评分
 */
function getResourceQualityScore(resource) {
  let score = 50;
  
  if (resource.quality === 'high') {
    score += 30;
  } else if (resource.quality === 'medium') {
    score += 15;
  } else if (resource.quality === 'low') {
    score -= 10;
  }
  
  if (resource.width && resource.height) {
    const pixels = resource.width * resource.height;
    if (pixels > 1000000) { // 1MP以上
      score += 20;
    } else if (pixels > 250000) { // 0.25MP以上
      score += 10;
    }
  }
  
  if (resource.size) {
    if (resource.type === RESOURCE_TYPES.IMAGE) {
      if (resource.size > 500000) { // 500KB以上
        score += 10;
      }
    } else if (resource.type === RESOURCE_TYPES.VIDEO) {
      if (resource.size > 5000000) { // 5MB以上
        score += 10;
      }
    }
  }
  
  if (resource.source === 'dom') {
    score += 10; // DOM中的资源通常更相关
  }
  
  if (resource.confidence) {
    score += resource.confidence * 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

self.onmessage = function(e) {
  const data = e.data;
  
  if (data.action === 'deduplicate') {
    deduplicateResources(data);
  }
};
