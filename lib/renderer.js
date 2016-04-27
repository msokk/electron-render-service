'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

exports.renderWorker = renderWorker;
exports.createWindow = createWindow;

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _electron = require('electron');

var _retry = require('retry');

var _retry2 = _interopRequireDefault(_retry);

var _error_handler = require('./error_handler');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const TIMEOUT = process.env.TIMEOUT || 30;
const DELAY = process.env.DELAY || 1;
const WINDOW_WIDTH = parseInt(process.env.WINDOW_WIDTH, 10) || 1024;
const WINDOW_HEIGHT = parseInt(process.env.WINDOW_HEIGHT, 10) || 768;
const LIMIT = 3000; // Constrain screenshots to 3000x3000px
const DEVELOPMENT = process.env.NODE_ENV === 'development';
const DEFAULT_HEADERS = 'Cache-Control: no-cache, no-store, must-revalidate';

/**
 * Render PDF
 */
function renderPDF(_ref, done) {
  let options = _ref.options;

  // Remove print stylesheets prior rendering
  if (options.removePrintMedia) {
    const selector = 'document.querySelectorAll(\'link[rel="stylesheet"][media="print"]\')';
    const code = `Array.prototype.forEach.call(${ selector }, s => s.remove());`;
    this.webContents.executeJavaScript(code);
  }

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
 * Render job with error handling
 */
function renderWorker(window, task, done) {
  const webContents = window.webContents;


  if (task.url.startsWith('chrome://')) {
    return done(new _error_handler.RendererError('INVALID_URL', 'chrome:// urls are forbidden.'));
  }

  const timeoutTimer = setTimeout(function () {
    webContents.emit('timeout');
    done(new Error('timeout was hit'));
  }, TIMEOUT * 1000);
  var timeoutHit = false;

  console.log('render worker');
  var renderType;

  if (task.options.waitForText !== false) {
    var waitOperation = _retry2.default.operation({
      retries: TIMEOUT,
      factor: 1,
      minTimeout: 750,
      maxTimeout: 1000
    });
  }

  function renderIt(task, type) {
    clearTimeout(timeoutTimer);

    (0, _error_handler.validateResult)(task.url, type).then(() => {
      // Page loaded successfully
      (task.type === 'pdf' ? renderPDF : renderImage).call(window, task, done);
    }).catch(ex => done(ex));
  }

  webContents.once('finished', type => {
    if (task.options.delay > 0) {
      console.log('delaying pdf generation by ', task.options.delay * 1000);
      setTimeout(renderIt.bind(null, task, type), task.options.delay * 1000);
    } else if (task.options.waitForText && task.options.waitForText !== 'false' && task.options.waitForText !== false) {
      console.log('delaying pdf generation, waiting for "' + task.options.waitForText + '" to appear');

      waitOperation.attempt(function (currentAttempt) {
        console.log('attempting to find text', currentAttempt);

        webContents.once('found-in-page', function (event, result) {
          if (result.finalUpdate && result.matches > 0 || result.finalUpdate == false && result.activeMatchOrdinal > 0) {
            webContents.stopFindInPage('clearSelection');
            return renderIt(task, type);
          }

          if (waitOperation.retry(new Error('not ready to render'))) {
            return;
          }
        });

        webContents.findInPage(task.options.waitForText);
      });
    } else {
      renderIt(task, type);
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
    frame: DEVELOPMENT, show: DEVELOPMENT,
    webPreferences: {
      blinkFeatures: 'OverlayScrollbars', // Slimmer scrollbars
      allowDisplayingInsecureContent: true, // Show http content on https site
      allowRunningInsecureContent: true }
  });

  // Set user agent
  // Run JS, CSS from http urls
  const webContents = window.webContents;

  webContents.setUserAgent(`${ webContents.getUserAgent() } ${ _package2.default.name }/${ _package2.default.version }`);

  // Emit end events to an aggregate for worker to listen on once
  ['did-fail-load', 'crashed', 'did-finish-load', 'timeout'].forEach(e => {
    webContents.on(e, function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return webContents.emit('finished', e, ...args);
    });
  });

  return window;
}