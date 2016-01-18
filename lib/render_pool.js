'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _async = require('async');

var _electron = require('electron');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_HEADERS = 'Cache-Control: no-cache, no-store, must-revalidate';
const CONCURRENCY = process.env.CONCURRENCY || 1;
const windowPool = [];

/**
 * Get renderer from pool and lock it
 */
function getRenderer() {
  const win = windowPool.filter(p => p.busy === false)[0];
  if (win) windowPool[win.id - 1].busy = true;
  return win;
}

// Render queue
const rendererQueue = (0, _async.queue)((_ref, done) => {
  let type = _ref.type;
  let res = _ref.res;
  let url = _ref.url;
  let options = _ref.options;

  const win = getRenderer();
  if (!win) throw new Error('Pool is empty?');

  const webContents = win.webContents;

  webContents.loadURL(url, { extraHeaders: DEFAULT_HEADERS });

  webContents.once('did-finish-load', () => {
    if (type === 'pdf') {
      webContents.printToPDF(options, (error, data) => {
        if (error) throw error;

        res.set('Content-Disposition', `inline; filename="render-${ Date.now() }.pdf"`);
        res.type('pdf').send(data);
        win.release();
        done();
      });
    }
  });
}, CONCURRENCY);

exports.default = {
  /**
   * Push a render task to queue
   */
  enqueue(task) {
    rendererQueue.push(task);
  },

  /**
   * Fetch stats for debugging
   */
  stats() {
    return {
      concurrency: rendererQueue.concurrency,
      length: rendererQueue.length(),
      workersList: rendererQueue.workersList().map(_ref2 => {
        let data = _ref2.data;
        return { url: data.url, options: data.options, type: data.type };
      })
    };
  },

  /**
   * Create Electron window pool
   */
  init() {
    Array.from({ length: CONCURRENCY }, (v, k) => k).forEach(i => {
      const browserWindow = new _electron.BrowserWindow({ show: false });

      // Set user agent
      const webContents = browserWindow.webContents;
      webContents.setUserAgent(`${ webContents.getUserAgent() } ${ _package2.default.name }/${ _package2.default.version }`);

      // Basic locking
      browserWindow.busy = false;
      browserWindow.release = () => windowPool[i].busy = false;

      // Add to pool
      windowPool.push(browserWindow);
    });
  }
};