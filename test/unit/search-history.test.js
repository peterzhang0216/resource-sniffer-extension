/**
 * @file search-history.test.js
 * @description 搜索历史功能单元测试
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

const mockStorage = {
  get: jest.fn(),
  set: jest.fn()
};

global.chrome.storage.local = mockStorage;

const SearchHistory = require('../../src/components/log-tab').SearchHistory;

describe('SearchHistory', () => {
  let searchHistory;
  let mockCallback;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorage.get.mockImplementation((key, callback) => {
      callback({
        'search_history': [
          { term: 'error', timestamp: Date.now() - 3600000, count: 5 },
          { term: 'warning', timestamp: Date.now() - 7200000, count: 3 },
          { term: 'resource', timestamp: Date.now() - 10800000, count: 2 }
        ]
      });
    });
    
    mockCallback = jest.fn();
    searchHistory = new SearchHistory(mockCallback);
  });
  
  test('应该正确初始化搜索历史', async () => {
    await searchHistory.init();
    
    expect(mockStorage.get).toHaveBeenCalled();
    expect(searchHistory.history.length).toBe(3);
    expect(searchHistory.history[0].term).toBe('error');
    expect(searchHistory.history[0].count).toBe(5);
  });
  
  test('应该正确添加新的搜索词', async () => {
    await searchHistory.init();
    
    await searchHistory.addTerm('network');
    
    expect(mockStorage.set).toHaveBeenCalled();
    
    expect(mockCallback).toHaveBeenCalled();
    
    expect(searchHistory.history.length).toBe(4);
    expect(searchHistory.history.some(item => item.term === 'network')).toBe(true);
  });
  
  test('应该更新已存在搜索词的计数和时间戳', async () => {
    await searchHistory.init();
    
    const originalCount = searchHistory.history.find(item => item.term === 'error').count;
    const originalTimestamp = searchHistory.history.find(item => item.term === 'error').timestamp;
    
    await searchHistory.addTerm('error');
    
    const newCount = searchHistory.history.find(item => item.term === 'error').count;
    expect(newCount).toBe(originalCount + 1);
    
    const newTimestamp = searchHistory.history.find(item => item.term === 'error').timestamp;
    expect(newTimestamp).toBeGreaterThan(originalTimestamp);
  });
  
  test('应该正确删除搜索词', async () => {
    await searchHistory.init();
    
    await searchHistory.removeTerm('warning');
    
    expect(mockStorage.set).toHaveBeenCalled();
    
    expect(mockCallback).toHaveBeenCalled();
    
    expect(searchHistory.history.length).toBe(2);
    expect(searchHistory.history.some(item => item.term === 'warning')).toBe(false);
  });
  
  test('应该正确清空搜索历史', async () => {
    await searchHistory.init();
    
    await searchHistory.clearHistory();
    
    expect(mockStorage.set).toHaveBeenCalled();
    
    expect(mockCallback).toHaveBeenCalled();
    
    expect(searchHistory.history.length).toBe(0);
  });
  
  test('应该按使用频率排序搜索历史', async () => {
    await searchHistory.init();
    
    const sortedHistory = searchHistory.getSortedHistory('frequency');
    
    expect(sortedHistory[0].term).toBe('error');
    expect(sortedHistory[1].term).toBe('warning');
    expect(sortedHistory[2].term).toBe('resource');
  });
  
  test('应该按最近使用时间排序搜索历史', async () => {
    await searchHistory.init();
    
    const sortedHistory = searchHistory.getSortedHistory('recent');
    
    expect(sortedHistory[0].term).toBe('error');
    expect(sortedHistory[1].term).toBe('warning');
    expect(sortedHistory[2].term).toBe('resource');
  });
  
  test('应该限制历史记录的最大数量', async () => {
    await searchHistory.init();
    
    searchHistory.maxHistorySize = 3;
    
    await searchHistory.addTerm('network');
    await searchHistory.addTerm('download');
    
    expect(searchHistory.history.length).toBe(3);
    
    expect(searchHistory.history.some(item => item.term === 'resource')).toBe(false);
  });
});
