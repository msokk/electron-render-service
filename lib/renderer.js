'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.renderWorker = renderWorker;
exports.createWindow = createWindow;

var _package = require('../package.json');

var _package2 = _interopRequireDefault(_package);

var _electron = require('electron');

var _retry = require('retry');

var _retry2 = _interopRequireDefault(_retry);

var _error_handler = require('./error_handler');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-line import/no-unresolved
/* eslint-disable no-console */


const TIMEOUT = parseInt(process.env.TIMEOUT, 10) || 30;
const DEVELOPMENT = process.env.NODE_ENV === 'development';
const WINDOW_WIDTH = parseInt(process.env.WINDOW_WIDTH, 10) || 1024;
const WINDOW_HEIGHT = parseInt(process.env.WINDOW_HEIGHT, 10) || 768;
const DEFAULT_HEADERS = 'Cache-Control: no-cache, no-store, must-revalidate\nPragma: no-cache';

/**
 * Render PDF
 */
function renderPDF(options, done) {
  // Remove print stylesheets prior rendering
  if (options.removePrintMedia) {
    const selector = 'document.querySelectorAll(\'link[rel="stylesheet"][media="print"]\')';
    const code = `Array.prototype.forEach.call(${ selector }, s => s.remove());`;
    this.webContents.executeJavaScript(code);
  }

  this.webContents.printToPDF(options, done);
}

/**
 * Render image png/jpeg
 */
function renderImage(_ref, done) {
  let type = _ref.type;
  let quality = _ref.quality;
  let browserWidth = _ref.browserWidth;
  let browserHeight = _ref.browserHeight;
  let clippingRect = _ref.clippingRect;

  const handleCapture = image => done(null, type === 'png' ? image.toPng() : image.toJpeg(quality));

  if (clippingRect) {
    // Avoid stretching by adding rect coordinates to size
    this.setSize(browserWidth + clippingRect.x, browserHeight + clippingRect.y);
    setTimeout(() => this.capturePage(clippingRect, handleCapture), 50);
  } else {
    this.setSize(browserWidth, browserHeight);
    setTimeout(() => this.capturePage(handleCapture), 50);
  }
}

/**
 * Render job with error handling
 */
function renderWorker(window, task, done) {
  const webContents = window.webContents;

  let waitOperation = null;

  const timeoutTimer = setTimeout(() => webContents.emit('timeout'), TIMEOUT * 1000);

  if (task.waitForText !== false) {
    waitOperation = _retry2.default.operation({ retries: TIMEOUT, factor: 1,
      minTimeout: 750, maxTimeout: 1000 });
  }

  webContents.once('finished', function (type) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    clearTimeout(timeoutTimer);

    function renderIt() {
      (0, _error_handler.validateResult)(task.url, type, ...args)
      // Page loaded successfully
      .then(() => (task.type === 'pdf' ? renderPDF : renderImage).call(window, task, done)).catch(ex => done(ex));
    }

    // Delay rendering n seconds
    if (task.delay > 0) {
      console.log('delaying pdf generation by %sms', task.delay * 1000);
      setTimeout(renderIt, task.delay * 1000);

      // Look for specific string before rendering
    } else if (task.waitForText) {
        console.log('delaying pdf generation, waiting for text "%s" to appear', task.waitForText);
        waitOperation.attempt(() => webContents.findInPage(task.waitForText));

        webContents.on('found-in-page', function foundInPage(event, result) {
          if (result.matches === 0) {
            waitOperation.retry(new Error('not ready to render'));
            return;
          }

          if (result.finalUpdate) {
            webContents.stopFindInPage('clearSelection');
            webContents.removeListener('found-in-page', foundInPage);
            renderIt();
          }
        });
      } else {
        renderIt();
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
    enableLargerThanScreen: true,
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
      for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return webContents.emit('finished', e, ...args);
    });
  });

  return window;
}