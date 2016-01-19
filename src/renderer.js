import pjson from '../package.json';
import { BrowserWindow } from 'electron';

const TIMEOUT = process.env.TIMEOUT || 30;
const WINDOW_WIDTH = process.env.WINDOW_WIDTH || 1024;
const WINDOW_HEIGHT = process.env.WINDOW_HEIGHT || 768;
const LIMIT = 3000; // Constrain screenshots to 3000x3000px

const DEFAULT_HEADERS = 'Cache-Control: no-cache, no-store, must-revalidate';

/**
 * Render PDF
 */
function renderPDF({ options }, done) {
  this.webContents.printToPDF(options, done);
}

/**
 * Render image
 */
function renderImage({ type, options }, done) {
  const handleCapture = image => {
    done(null, type === 'png' ? image.toPng() : image.toJpeg(parseInt(options.quality, 10) || 80));
  };

  // Sanitize rect
  const validKeys = ['x', 'y', 'width', 'height'];
  const rect = {};
  Object.keys(options).map(k => [k, options[k]])
    .filter(([k, v]) => validKeys.includes(k) && !isNaN(parseInt(v, 10)))
    .forEach(([k, v]) => rect[k] = parseInt(v, 10));

  // Use explicit browser size or rect size, capped by LIMIT, default to ENV variable
  const browserSize = {
    width: Math.min(parseInt(options.browserWidth, 10) || rect.width, LIMIT) || WINDOW_WIDTH,
    height: Math.min(parseInt(options.browserHeight, 10) || rect.height, LIMIT) || WINDOW_HEIGHT,
  };

  if (Object.keys(rect).length === 4) {
    // Avoid stretching by adding rect coordinates to size
    this.setSize(browserSize.width + rect.x, browserSize.height + rect.y);
    this.capturePage(rect, handleCapture);
  } else {
    this.setSize(browserSize.width, browserSize.height);
    this.capturePage(handleCapture);
  }
}

/**
 * Handle loading failure errors
 */
function handleLoadingError(done, e, code, desc) {
  switch (code) {
    case -105:
      done({ statusCode: 500, code: 'NAME_NOT_RESOLVED',
        message: `The host name could not be resolved.` });
      break;
    case -300:
      done({ statusCode: 500, code: 'INVALID_URL', message: 'The URL is invalid.' });
      break;
    case -501:
      done({ statusCode: 500, code: 'INSECURE_RESPONSE',
        message: 'The server\'s response was insecure (e.g. there was a cert error).' });
      break;
    case -3:
      done({ statusCode: 500, code: 'ABORTED', message: 'User aborted loading.' });
      break;
    default:
      done({ statusCode: 500, code: 'GENERIC_ERROR', message: `${code} - ${desc}` });
  }
}

/**
 * Render job with error handling
 */
export function renderWorker(window, task, done) {
  const { webContents } = window;

  // Prevent loading of malicious chrome:// URLS
  if (task.url.startsWith('chrome://')) {
    return done({ statusCode: 500, code: 'INVALID_URL', message: 'The URL is invalid.' });
  }

  const timeoutTimer = setTimeout(() => webContents.emit('timeout'), TIMEOUT * 1000);

  webContents.once('finished', (type, ...args) => {
    clearTimeout(timeoutTimer);

    switch (type) {
      // Loading failures
      case 'did-fail-load': handleLoadingError(done, ...args);
        break;
      // Renderer process has crashed
      case 'crashed':
        done({ statusCode: 500, code: 'RENDERER_CRASH', message: `Render process crashed.` });
        break;
      // Page loading timed out
      case 'timeout':
        done({ statusCode: 524, code: 'RENDERER_TIMEOUT', message: `Renderer timed out.` });
        break;
      // Page loaded successfully
      case 'did-finish-load':
        (task.type === 'pdf' ? renderPDF : renderImage).call(window, task, done);
        break;
      default: done({ statusCode: 500, code: 'UNKNOWN_EVENT', message: type });
    }
  });

  webContents.loadURL(task.url, { extraHeaders: DEFAULT_HEADERS });
}

/**
 * Create BrowserWindow
 */
export function createWindow() {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH, height: WINDOW_HEIGHT,
    frame: false, show: false,
  });

  // Set user agent
  const { webContents } = window;
  webContents.setUserAgent(`${webContents.getUserAgent()} ${pjson.name}/${pjson.version}`);

  // Emit end events to an aggregate for worker to listen on once
  ['did-fail-load', 'crashed', 'did-finish-load', 'timeout'].forEach(e => {
    webContents.on(e, (...args) => webContents.emit('finished', e, ...args));
  });

  return window;
}
