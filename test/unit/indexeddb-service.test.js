/**
 * @file indexeddb-service.test.js
 * @description IndexedDB服务单元测试
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn()
};

const mockIDBRequest = {
  onerror: null,
  onsuccess: null,
  onupgradeneeded: null,
  result: {
    createObjectStore: jest.fn().mockReturnValue({
      createIndex: jest.fn()
    }),
    transaction: jest.fn().mockReturnValue({
      objectStore: jest.fn().mockReturnValue({
        put: jest.fn().mockReturnValue({
          onsuccess: null,
          onerror: null
        }),
        index: jest.fn().mockReturnValue({
          openCursor: jest.fn().mockReturnValue({
            onsuccess: null,
            onerror: null
          })
        }),
        get: jest.fn().mockReturnValue({
          onsuccess: null,
          onerror: null
        }),
        delete: jest.fn().mockReturnValue({
          onsuccess: null,
          onerror: null
        })
      })
    })
  }
};

global.indexedDB = mockIndexedDB;
mockIndexedDB.open.mockReturnValue(mockIDBRequest);

jest.mock('../../src/utils/compression-utils', () => ({
  compress: jest.fn().mockResolvedValue('compressed-data'),
  decompress: jest.fn().mockResolvedValue('{"id":"1","data":"test"}'),
  isCompressionSupported: jest.fn().mockReturnValue(true)
}));

const IndexedDBService = require('../../src/services/indexeddb-service');
const { compress, decompress } = require('../../src/utils/compression-utils');

describe('IndexedDBService', () => {
  let indexedDBService;

  beforeEach(() => {
    jest.clearAllMocks();
    indexedDBService = new IndexedDBService('test_db', 1);
  });

  test('应该正确初始化数据库', () => {
    const initPromise = indexedDBService._initDatabase();
    
    expect(mockIndexedDB.open).toHaveBeenCalledWith(
      'test_db',
      1
    );
    
    mockIDBRequest.onupgradeneeded({ target: mockIDBRequest });
    
    mockIDBRequest.onsuccess({ target: mockIDBRequest });
    
    return initPromise.then(() => {
      expect(indexedDBService.db).toBe(mockIDBRequest.result);
      expect(mockIDBRequest.result.createObjectStore).toHaveBeenCalled();
    });
  });

  test('应该正确保存压缩日志', async () => {
    const testData = { id: '1', timestamp: Date.now(), message: 'Test log' };
    
    indexedDBService.ready = Promise.resolve();
    indexedDBService.db = mockIDBRequest.result;
    
    const savePromise = indexedDBService.saveData('logs', testData);
    
    expect(compress).toHaveBeenCalledWith(JSON.stringify(testData));
    
    const putRequest = mockIDBRequest.result.transaction().objectStore().put();
    putRequest.onsuccess = jest.fn();
    putRequest.onsuccess();
    
    return savePromise.then(result => {
      expect(result).toBe(true);
      expect(mockIDBRequest.result.transaction).toHaveBeenCalledWith('logs', 'readwrite');
    });
  });

  test('应该正确获取并解压数据', async () => {
    indexedDBService.ready = Promise.resolve();
    indexedDBService.db = mockIDBRequest.result;
    
    const getPromise = indexedDBService.getData('logs', '1');
    
    const getRequest = mockIDBRequest.result.transaction().objectStore().get();
    getRequest.onsuccess = jest.fn();
    getRequest.onsuccess({ 
      target: { 
        result: { 
          id: '1', 
          compressedData: 'compressed-data' 
        } 
      } 
    });
    
    return getPromise.then(data => {
      expect(decompress).toHaveBeenCalledWith('compressed-data');
      expect(data).toEqual({ id: '1', data: 'test' });
      expect(mockIDBRequest.result.transaction).toHaveBeenCalledWith('logs', 'readonly');
    });
  });

  test('应该正确处理数据库错误', async () => {
    indexedDBService.ready = Promise.resolve();
    indexedDBService.db = mockIDBRequest.result;
    
    const savePromise = indexedDBService.saveData('logs', { id: '1' });
    
    const putRequest = mockIDBRequest.result.transaction().objectStore().put();
    putRequest.onerror = jest.fn();
    putRequest.onerror({ target: { error: new Error('Test error') } });
    
    await expect(savePromise).rejects.toThrow('Test error');
  });

  test('应该正确删除数据', async () => {
    indexedDBService.ready = Promise.resolve();
    indexedDBService.db = mockIDBRequest.result;
    
    const deletePromise = indexedDBService.deleteData('logs', '1');
    
    const deleteRequest = mockIDBRequest.result.transaction().objectStore().delete();
    deleteRequest.onsuccess = jest.fn();
    deleteRequest.onsuccess();
    
    return deletePromise.then(result => {
      expect(result).toBe(true);
      expect(mockIDBRequest.result.transaction).toHaveBeenCalledWith('logs', 'readwrite');
      expect(mockIDBRequest.result.transaction().objectStore().delete).toHaveBeenCalledWith('1');
    });
  });
});
