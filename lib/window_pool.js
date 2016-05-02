'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

var _renderer = require('./renderer');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Queues renderjobs in a pool of BrowserWindow's
 */
class WindowPool {
  /**
   * Create Electron window pool
   */
  constructor() {
    const concurrency = parseInt(process.env.CONCURRENCY, 10) || 1;

    this.windowPool = {};
    this.createPool(concurrency);
    this.queue = _async2.default.queue(this.queueWorker.bind(this), concurrency);
  }

  /**
   * Push a render task to queue
   */
  enqueue() {
    this.queue.push(...arguments);
  }

  /**
   * Fetch stats for debugging
   */
  stats() {
    return {
      concurrency: this.queue.concurrency,
      queue_length: this.queue.length(),
      workersList: this.queue.workersList().map(_ref => {
        let data = _ref.data;
        return {
          url: data.url, options: data.options, type: data.type
        };
      })
    };
  }

  /**
   * Get a free BrowserWindow from pool
   */
  getAvailableWindow() {
    const availableId = Object.keys(this.windowPool).filter(id => this.windowPool[id].busy === false)[0];

    if (!availableId) return null;
    return this.windowPool[availableId];
  }

  /**
   * Create a pool of BrowserWindow's
   */
  createPool(concurrency) {
    let n = concurrency;
    const setBusy = (id, value) => {
      this.windowPool[id].busy = value;
    };

    while (n-- > 0) {
      const window = (0, _renderer.createWindow)();

      // Basic locking
      window.busy = false;
      window.unlock = setBusy.bind(this, window.id, false);
      window.lock = setBusy.bind(this, window.id, true);

      // Add to pool
      this.windowPool[window.id] = window;
    }
  }

  /**
   * Wrap queue worker with locking mechanism
   */
  queueWorker(task, done) {
    const window = this.getAvailableWindow();
    if (!window) throw new Error('Pool is empty while queue is not saturated!?');
    window.lock();

    (0, _renderer.renderWorker)(window, task, function () {
      // Load blank state after render
      if (process.env.NODE_ENV !== 'development') window.loadURL('about:blank');
      window.webContents.clearHistory();

      window.unlock();
      done(...arguments);
    });
  }
}
exports.default = WindowPool;