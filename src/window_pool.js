import async from 'async';
import { renderWorker, createWindow } from './renderer';

/**
 * Queues renderjobs in a pool of BrowserWindow's
 */
export default class WindowPool {
  /**
   * Push a render task to queue
   */
  enqueue(...args) {
    this.queue.push(...args);
  }

  /**
   * Fetch stats for debugging
   */
  stats() {
    return {
      concurrency: this.queue.concurrency,
      queue_length: this.queue.length(),
      workersList: this.queue.workersList().map(({ data }) => ({
        url: data.url, options: data.options, type: data.type,
      })),
    };
  }

  /**
   * Get a free BrowserWindow from pool
   */
  getAvailableWindow() {
    const availableId = Object.keys(this.windowPool)
      .filter(id => this.windowPool[id].busy === false)[0];

    if (!availableId) return null;
    return this.windowPool[availableId];
  }

  /**
   * Create a pool of BrowserWindow's
   */
  createPool(concurrency) {
    let n = concurrency;
    const setBusy = (id, value) => this.windowPool[id].busy = value;

    while (n-- > 0) {
      const window = createWindow();

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

    renderWorker(window, task, (...args) => {
      // Load blank state after render
      window.loadURL('about:blank');

      window.unlock();
      done(...args);
    });
  }

  /**
   * Create Electron window pool
   */
  constructor() {
    const concurrency = process.env.CONCURRENCY || 1;

    this.windowPool = {};
    this.createPool(concurrency);
    this.queue = async.queue(this.queueWorker.bind(this), concurrency);
  }
}
