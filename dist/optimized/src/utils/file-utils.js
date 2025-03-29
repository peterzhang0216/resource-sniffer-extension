/**
 * @file file-utils.js
 * @description 文件处理工具类
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { SIZE_CATEGORIES } from '../config/constants.js';
import URLUtils from './url-utils.js';

/**
 * 文件工具类
 * @class FileUtils
 */
class FileUtils {
  /**
   * 格式化文件大小
   * @param {number} bytes - 文件大小（字节）
   * @param {number} [decimals=2] - 小数位数
   * @returns {string} 格式化后的文件大小
   */
  static formatFileSize(bytes, decimals = 2) {
    if (bytes === 0 || isNaN(bytes)) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  }

  /**
   * 获取文件大小分类
   * @param {number} bytes - 文件大小（字节）
   * @returns {string} 大小分类
   */
  static getSizeCategory(bytes) {
    if (bytes > 10485760) return SIZE_CATEGORIES.LARGE;      // > 10MB
    if (bytes > 1048576) return SIZE_CATEGORIES.MEDIUM;      // > 1MB
    if (bytes > 102400) return SIZE_CATEGORIES.SMALL;        // > 100KB
    return SIZE_CATEGORIES.TINY;                             // < 100KB
  }

  /**
   * 生成智能文件名
   * @param {Object} resource - 资源对象
   * @param {Object} options - 选项
   * @param {string} options.format - 文件名格式
   * @param {string} options.siteName - 网站名称
   * @param {string} options.downloadPath - 下载路径
   * @returns {string} 格式化的文件名
   */
  static generateSmartFilename(resource, options = {}) {
    if (!resource || !resource.url) return 'unknown';
    
    const {
      format = '{site}_{type}_{timestamp}',
      siteName = 'site',
      downloadPath = ''
    } = options;
    
    const url = resource.url;
    const timestamp = Date.now();
    const fileExtension = URLUtils.getFileExtension(url) || 'unknown';
    const fileBaseName = URLUtils.getBaseFileName(url) || 'resource';
    
    let qualityIndicator = '';
    if (resource.quality) {
      qualityIndicator = resource.quality === 'HD' ? '_hd' : 
                         resource.quality === 'SD' ? '_sd' : '';
    }
    
    let scoreIndicator = '';
    if (resource.score) {
      scoreIndicator = resource.score > 80 ? '_high' : 
                       resource.score > 50 ? '_med' : '_low';
    }
    
    let filename = format
      .replace('{site}', siteName)
      .replace('{type}', resource.type || 'unknown')
      .replace('{index}', Math.floor(Math.random() * 1000))
      .replace('{timestamp}', timestamp)
      .replace('{basename}', fileBaseName)
      .replace('{ext}', fileExtension)
      .replace('{quality}', qualityIndicator)
      .replace('{score}', scoreIndicator);
    
    if (!filename.includes('.')) {
      filename += `.${fileExtension}`;
    }
    
    if (downloadPath) {
      filename = `${downloadPath}/${filename}`;
    }
    
    return filename;
  }

  /**
   * 从MIME类型中提取文件扩展名
   * @param {string} mimeType - MIME类型
   * @returns {string} 文件扩展名
   */
  static getExtensionFromMimeType(mimeType) {
    if (!mimeType) return '';
    
    const mimeToExt = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
      'image/bmp': 'bmp',
      'image/x-icon': 'ico',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'video/ogg': 'ogv',
      'video/quicktime': 'mov',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
    };
    
    return mimeToExt[mimeType] || '';
  }

  /**
   * 检查文件名是否安全（不包含非法字符）
   * @param {string} filename - 文件名
   * @returns {string} 安全的文件名
   */
  static sanitizeFilename(filename) {
    if (!filename) return 'unknown';
    
    return filename
      .replace(/[/\\?%*:|"<>]/g, '_') // 替换Windows和Unix系统中的非法字符
      .replace(/\s+/g, '_');          // 替换空格为下划线
  }

  /**
   * 生成唯一文件名（避免重复）
   * @param {string} filename - 原始文件名
   * @returns {string} 唯一文件名
   */
  static generateUniqueFilename(filename) {
    if (!filename) return 'unknown';
    
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return `${filename}_${timestamp}_${random}`;
    }
    
    const name = filename.substring(0, lastDotIndex);
    const extension = filename.substring(lastDotIndex);
    
    return `${name}_${timestamp}_${random}${extension}`;
  }
}

export default FileUtils;
