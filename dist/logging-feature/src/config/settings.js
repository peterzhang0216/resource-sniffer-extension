/**
 * @file settings.js
 * @description 资源嗅探器扩展的默认设置配置
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { STORAGE_KEYS } from './constants.js';

/**
 * 默认下载设置
 * @type {Object}
 */
export const DEFAULT_DOWNLOAD_SETTINGS = {
  /** 最大并发下载数 */
  maxConcurrentDownloads: 2,
  /** 下载速度限制 (KB/s) */
  downloadSpeedLimit: 0,
  /** 是否按网站分类存储 */
  categorizeByWebsite: true,
  /** 是否按资源类型分类存储 */
  categorizeByType: true,
  /** 默认下载路径 */
  defaultPath: 'downloads/resource-sniffer'
};

/**
 * 默认文件名格式配置
 * @type {Object}
 */
export const FILENAME_FORMATS = {
  /** 原始文件名 */
  ORIGINAL: 'original',
  /** 类型-时间戳 */
  TYPE_TIMESTAMP: 'type-timestamp',
  /** 网站-类型-序号 */
  SITE_TYPE_INDEX: 'site-type-index',
  /** 自定义格式 */
  CUSTOM: 'custom'
};

/**
 * 默认排序方式
 * @type {Object}
 */
export const SORT_METHODS = {
  /** 大小降序 */
  SIZE_DESC: 'size-desc',
  /** 大小升序 */
  SIZE_ASC: 'size-asc',
  /** 时间降序 */
  TIME_DESC: 'time-desc',
  /** 时间升序 */
  TIME_ASC: 'time-asc',
  /** 质量降序 */
  QUALITY_DESC: 'quality-desc',
  /** 质量升序 */
  QUALITY_ASC: 'quality-asc'
};

export default {
  DEFAULT_DOWNLOAD_SETTINGS,
  FILENAME_FORMATS,
  SORT_METHODS,
  STORAGE_KEYS
};
