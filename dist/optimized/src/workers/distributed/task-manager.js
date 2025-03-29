/**
 * @file task-manager.js
 * @description 分布式任务管理器，协调多个Worker进行并行处理
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 分布式任务管理器
 * @class TaskManager
 */
class TaskManager {
  /**
   * 创建任务管理器实例
   * @param {number} maxWorkers - 最大Worker数量
   */
  constructor(maxWorkers = 4) {
    this.maxWorkers = Math.max(1, Math.min(maxWorkers, navigator.hardwareConcurrency || 4));
    this.workers = [];
    this.taskQueue = [];
    this.activeTaskCount = 0;
    this.completedTaskCount = 0;
    this.failedTaskCount = 0;
    this.isProcessing = false;
    this.taskResults = new Map();
    this.taskCallbacks = new Map();
    this.workerScripts = new Map();
  }
  
  /**
   * 注册Worker脚本
   * @param {string} taskType - 任务类型
   * @param {string} scriptPath - Worker脚本路径
   */
  registerWorkerScript(taskType, scriptPath) {
    this.workerScripts.set(taskType, scriptPath);
  }
  
  /**
   * 添加任务到队列
   * @param {string} taskType - 任务类型
   * @param {Object} taskData - 任务数据
   * @param {Function} callback - 完成回调
   * @returns {string} - 任务ID
   */
  addTask(taskType, taskData, callback) {
    if (!this.workerScripts.has(taskType)) {
      console.error(`未注册的任务类型: ${taskType}`);
      if (callback) {
        callback({ error: `未注册的任务类型: ${taskType}` });
      }
      return null;
    }
    
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task = {
      id: taskId,
      type: taskType,
      data: taskData,
      status: 'pending',
      priority: taskData.priority || 'medium',
      addedAt: Date.now()
    };
    
    this.taskQueue.push(task);
    
    if (callback) {
      this.taskCallbacks.set(taskId, callback);
    }
    
    this._sortTaskQueue();
    
    if (!this.isProcessing) {
      this._processQueue();
    }
    
    return taskId;
  }
  
  /**
   * 取消任务
   * @param {string} taskId - 任务ID
   * @returns {boolean} - 是否成功取消
   */
  cancelTask(taskId) {
    const taskIndex = this.taskQueue.findIndex(task => task.id === taskId);
    
    if (taskIndex !== -1) {
      this.taskQueue.splice(taskIndex, 1);
      this.taskCallbacks.delete(taskId);
      return true;
    }
    
    return false;
  }
  
  /**
   * 启动任务处理
   * @private
   */
  _processQueue() {
    if (this.taskQueue.length === 0 || this.activeTaskCount >= this.maxWorkers) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.taskQueue.length > 0 && this.activeTaskCount < this.maxWorkers) {
      const task = this.taskQueue.shift();
      this._processTask(task);
    }
  }
  
  /**
   * 处理单个任务
   * @param {Object} task - 任务对象
   * @private
   */
  _processTask(task) {
    const { id, type, data } = task;
    
    try {
      const scriptPath = this.workerScripts.get(type);
      
      if (!scriptPath) {
        this._handleTaskError(id, `未找到Worker脚本: ${type}`);
        return;
      }
      
      const worker = new Worker(scriptPath, { type: 'module' });
      
      worker.onmessage = (e) => {
        this._handleWorkerMessage(id, e.data);
        
        worker.terminate();
        
        const workerIndex = this.workers.indexOf(worker);
        if (workerIndex !== -1) {
          this.workers.splice(workerIndex, 1);
        }
        
        this.activeTaskCount--;
        
        this._processQueue();
      };
      
      worker.onerror = (e) => {
        this._handleTaskError(id, `Worker错误: ${e.message}`);
        
        worker.terminate();
        
        const workerIndex = this.workers.indexOf(worker);
        if (workerIndex !== -1) {
          this.workers.splice(workerIndex, 1);
        }
        
        this.activeTaskCount--;
        this.failedTaskCount++;
        
        this._processQueue();
      };
      
      worker.postMessage({
        taskId: id,
        action: type,
        ...data
      });
      
      this.workers.push(worker);
      this.activeTaskCount++;
      
      task.status = 'processing';
      task.startedAt = Date.now();
      
    } catch (e) {
      this._handleTaskError(id, `启动Worker错误: ${e.message}`);
    }
  }
  
  /**
   * 处理Worker消息
   * @param {string} taskId - 任务ID
   * @param {Object} data - 消息数据
   * @private
   */
  _handleWorkerMessage(taskId, data) {
    this.taskResults.set(taskId, {
      ...data,
      completedAt: Date.now()
    });
    
    if (this.taskCallbacks.has(taskId)) {
      const callback = this.taskCallbacks.get(taskId);
      callback(data);
      this.taskCallbacks.delete(taskId);
    }
    
    this.completedTaskCount++;
  }
  
  /**
   * 处理任务错误
   * @param {string} taskId - 任务ID
   * @param {string} errorMessage - 错误消息
   * @private
   */
  _handleTaskError(taskId, errorMessage) {
    const errorData = {
      error: errorMessage,
      completedAt: Date.now()
    };
    
    this.taskResults.set(taskId, errorData);
    
    if (this.taskCallbacks.has(taskId)) {
      const callback = this.taskCallbacks.get(taskId);
      callback(errorData);
      this.taskCallbacks.delete(taskId);
    }
    
    this.failedTaskCount++;
  }
  
  /**
   * 按优先级排序任务队列
   * @private
   */
  _sortTaskQueue() {
    const priorityValues = {
      'high': 3,
      'medium': 2,
      'low': 1
    };
    
    this.taskQueue.sort((a, b) => {
      const priorityA = priorityValues[a.priority] || 2;
      const priorityB = priorityValues[b.priority] || 2;
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      return a.addedAt - b.addedAt;
    });
  }
  
  /**
   * 获取任务状态
   * @returns {Object} - 任务状态统计
   */
  getStatus() {
    return {
      queuedTasks: this.taskQueue.length,
      activeTasks: this.activeTaskCount,
      completedTasks: this.completedTaskCount,
      failedTasks: this.failedTaskCount,
      totalProcessed: this.completedTaskCount + this.failedTaskCount,
      activeWorkers: this.workers.length,
      maxWorkers: this.maxWorkers
    };
  }
  
  /**
   * 清理任务结果
   * @param {number} maxAge - 最大保留时间(毫秒)
   */
  cleanupResults(maxAge = 3600000) {
    const now = Date.now();
    
    for (const [taskId, result] of this.taskResults.entries()) {
      if (result.completedAt && (now - result.completedAt) > maxAge) {
        this.taskResults.delete(taskId);
      }
    }
  }
  
  /**
   * 停止所有任务
   */
  stopAll() {
    this.workers.forEach(worker => {
      try {
        worker.terminate();
      } catch (e) {
        console.warn('终止Worker错误:', e);
      }
    });
    
    this.workers = [];
    
    this.activeTaskCount = 0;
    this.isProcessing = false;
    
    this.taskQueue.forEach(task => {
      this._handleTaskError(task.id, '任务被取消');
    });
    
    this.taskQueue = [];
  }
}

export default TaskManager;
