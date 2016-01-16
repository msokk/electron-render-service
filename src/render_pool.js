import pjson from '../package.json';
import { queue } from 'async';
import { BrowserWindow } from 'electron';

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
const rendererQueue = queue(({ type, res, url, options }, done) => {
  const win = getRenderer();
  if (!win) throw new Error('Pool is empty?');

  const { webContents } = win;
  webContents.loadURL(url, { extraHeaders: DEFAULT_HEADERS });

  webContents.once('did-finish-load', () => {
    if (type === 'pdf') {
      webContents.printToPDF(options, (error, data) => {
        if (error) throw error;

        res.set('Content-Disposition', `inline; filename="render-${Date.now()}.pdf"`);
        res.type('pdf').send(data);
        win.release();
        done();
      });
    }
  });
}, CONCURRENCY);


export default {
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
      workersList: rendererQueue.workersList().map(({ data }) =>
        ({ url: data.url, options: data.options, type: data.type })),
    };
  },

  /**
   * Create Electron window pool
   */
  init() {
    Array.from({ length: CONCURRENCY }, (v, k) => k).forEach(i => {
      const browserWindow = new BrowserWindow({ show: false });

      // Set user agent
      const webContents = browserWindow.webContents;
      webContents.setUserAgent(`${webContents.getUserAgent()} ${pjson.name}/${pjson.version}`);

      // Basic locking
      browserWindow.busy = false;
      browserWindow.release = () => windowPool[i].busy = false;

      // Add to pool
      windowPool.push(browserWindow);
    });
  },
};
