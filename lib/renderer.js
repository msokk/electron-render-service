'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.renderWorker = renderWorker;
exports.createWindow = createWindow;

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _electron = require('electron');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const TIMEOUT = process.env.TIMEOUT || 30;
const WINDOW_WIDTH = parseInt(process.env.WINDOW_WIDTH, 10) || 1024;
const WINDOW_HEIGHT = parseInt(process.env.WINDOW_HEIGHT, 10) || 768;
const LIMIT = 3000; // Constrain screenshots to 3000x3000px

const DEFAULT_HEADERS = 'Cache-Control: no-cache, no-store, must-revalidate';

/**
 * Render PDF
 */
function renderPDF(_ref, done) {
  let options = _ref.options;

  this.webContents.printToPDF(options, done);
}

/**
 * Render image
 */
function renderImage(_ref2, done) {
  let type = _ref2.type;
  let options = _ref2.options;

  const handleCapture = image => {
    done(null, type === 'png' ? image.toPng() : image.toJpeg(parseInt(options.quality, 10) || 80));
  };

  // Sanitize rect
  const validKeys = ['x', 'y', 'width', 'height'];
  const rect = {};
  Object.keys(options).map(k => [k, options[k]]).filter(_ref3 => {
    var _ref4 = _slicedToArray(_ref3, 2);

    let k = _ref4[0];
    let v = _ref4[1];
    return validKeys.includes(k) && !isNaN(parseInt(v, 10));
  }).forEach(_ref5 => {
    var _ref6 = _slicedToArray(_ref5, 2);

    let k = _ref6[0];
    let v = _ref6[1];
    return rect[k] = parseInt(v, 10);
  });

  // Use explicit browser size or rect size, capped by LIMIT, default to ENV variable
  const browserSize = {
    width: Math.min(parseInt(options.browserWidth, 10) || rect.width, LIMIT) || WINDOW_WIDTH,
    height: Math.min(parseInt(options.browserHeight, 10) || rect.height, LIMIT) || WINDOW_HEIGHT
  };

  if (Object.keys(rect).length === 4) {
    // Avoid stretching by adding rect coordinates to size
    this.setSize(browserSize.width + rect.x, browserSize.height + rect.y);
    setTimeout(() => this.capturePage(rect, handleCapture), 50);
  } else {
    this.setSize(browserSize.width, browserSize.height);
    setTimeout(() => this.capturePage(handleCapture), 50);
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
      done({ statusCode: 500, code: 'GENERIC_ERROR', message: `${ code } - ${ desc }` });
  }
}

/**
 * Render job with error handling
 */
function renderWorker(window, task, done) {
  const webContents = window.webContents;

  // Prevent loading of malicious chrome:// URLS

  if (task.url.startsWith('chrome://')) {
    return done({ statusCode: 500, code: 'INVALID_URL', message: 'The URL is invalid.' });
  }

  const timeoutTimer = setTimeout(() => webContents.emit('timeout'), TIMEOUT * 1000);

  webContents.once('finished', function (type) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    clearTimeout(timeoutTimer);

    switch (type) {
      // Loading failures
      case 'did-fail-load':
        handleLoadingError(done, ...args);
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
      default:
        done({ statusCode: 500, code: 'UNKNOWN_EVENT', message: type });
    }
  });

  webContents.loadURL(task.url, { extraHeaders: DEFAULT_HEADERS });
}

/**
 * Create BrowserWindow
 */
function createWindow() {
  const window = new _electron.BrowserWindow({
    width: WINDOW_WIDTH, height: WINDOW_HEIGHT,
    frame: false, show: false,
    webPreferences: {
      blinkFeatures: 'OverlayScrollbars' }
  });

  // Set user agent
  // Slimmer scrollbars
  const webContents = window.webContents;

  webContents.setUserAgent(`${ webContents.getUserAgent() } ${ _package2.default.name }/${ _package2.default.version }`);

  // Emit end events to an aggregate for worker to listen on once
  ['did-fail-load', 'crashed', 'did-finish-load', 'timeout'].forEach(e => {
    webContents.on(e, function () {
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return webContents.emit('finished', e, ...args);
    });
  });

  return window;
}