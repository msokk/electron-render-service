/* eslint-disable no-console */
const { BrowserWindow } = require('electron');
const retry = require('retry');
const path = require('path');
const fs = require('fs');
const pjson = require('../package.json');

const { validateResult, RendererError } = require('./error_handler');

const TIMEOUT = parseInt(process.env.TIMEOUT, 10) || 30;
const DEVELOPMENT = process.env.NODE_ENV === 'development';
const WINDOW_WIDTH = parseInt(process.env.WINDOW_WIDTH, 10) || 1024;
const WINDOW_HEIGHT = parseInt(process.env.WINDOW_HEIGHT, 10) || 768;
const DEFAULT_HEADERS = 'Cache-Control: no-cache, no-store, must-revalidate\nPragma: no-cache';

/**
 * Render PDF
 */
const pdfFailedFixture = fs.readFileSync(path.resolve(__dirname, './fixtures/render_failed.pdf'));

function renderPDF(options, done) {
  // Remove print stylesheets prior rendering
  if (options.removePrintMedia) {
    const selector = 'document.querySelectorAll(\'link[rel="stylesheet"][media="print"]\')';
    const code = `Array.prototype.forEach.call(${selector}, s => s.remove());`;
    this.webContents.executeJavaScript(code);
  }

  // Support setting page size in microns with NxN syntax
  const customPage = options.pageSize.match(/([0-9]+)x([0-9]+)/);
  if (customPage) {
    // eslint-disable-next-line no-param-reassign
    options.pageSize = {
      width: parseInt(customPage[1], 10),
      height: parseInt(customPage[2], 10)
    };
  }

  let tries = 0;
  const attemptRender = () => {
    tries += 1;
    if (tries > 5) {
      done(new Error('Render failed'));
      return;
    }
    this.webContents.printToPDF(options, (err, data) => {
      if (data.slice(150).compare(pdfFailedFixture.slice(150)) === 0) {
        // Slice out ModDate
        console.log('Pdf empty, creation failed! Retrying...');
        setTimeout(attemptRender, 50);
        return;
      }
      done(err, data);
    });
  };

  attemptRender();
}

/**
 * Render image png/jpeg
 */
function renderImage({ type, quality, browserWidth, browserHeight, clippingRect }, done) {
  const handleCapture = image => done(null, type === 'png' ? image.toPNG() : image.toJPEG(quality));

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
exports.renderWorker = function renderWorker(window, task, done) {
  const { webContents } = window;
  let waitOperation = null;

  const timeoutTimer = setTimeout(() => webContents.emit('timeout'), TIMEOUT * 1000);

  if (task.waitForText !== false) {
    waitOperation = retry.operation({
      retries: TIMEOUT,
      factor: 1,
      minTimeout: 750,
      maxTimeout: 1000
    });
  }

  webContents.once('finished', (type, ...args) => {
    clearTimeout(timeoutTimer);

    function renderIt() {
      validateResult(task.url, type, ...args)
        // Page loaded successfully
        .then(() => (task.type === 'pdf' ? renderPDF : renderImage).call(window, task, done))
        .catch(ex => done(ex));
    }

    if (type !== 'did-finish-load') {
      renderIt();

      // Delay rendering n seconds
    } else if (task.delay > 0) {
      console.log('delaying pdf generation by %sms', task.delay * 1000);
      setTimeout(renderIt, task.delay * 1000);

      // Look for specific string before rendering
    } else if (task.waitForText) {
      console.log('delaying pdf generation, waiting for text "%s" to appear', task.waitForText);
      waitOperation.attempt(() => {
        webContents.findInPage(''); // TODO: Workaround for https://crbug.com/670498
        webContents.findInPage(task.waitForText);
      });

      webContents.on('found-in-page', function foundInPage(event, result) {
        if (result.matches === 0) {
          const isRetrying = waitOperation.retry(new Error('not ready to render'));

          if (!isRetrying) {
            done(
              new RendererError('TEXT_NOT_FOUND', `Failed to find text: ${task.waitForText}`, 404)
            );
            webContents.removeListener('found-in-page', foundInPage);
          }
        } else if (result.finalUpdate) {
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
};

/**
 * Create BrowserWindow
 */
exports.createWindow = function createWindow() {
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    frame: DEVELOPMENT,
    show: DEVELOPMENT,
    transparent: true,
    enableLargerThanScreen: true,
    webPreferences: {
      blinkFeatures: 'OverlayScrollbars', // Slimmer scrollbars
      allowDisplayingInsecureContent: true, // Show http content on https site
      allowRunningInsecureContent: true, // Run JS, CSS from http urls
      nodeIntegration: false // Disable exposing of Node.js symbols to DOM
    }
  });

  // Set user agent
  const { webContents } = window;
  webContents.setUserAgent(`${webContents.getUserAgent()} ${pjson.name}/${pjson.version}`);

  // Emit end events to an aggregate for worker to listen on once
  ['did-fail-load', 'crashed', 'did-finish-load', 'timeout'].forEach(e => {
    webContents.on(e, (...args) => webContents.emit('finished', e, ...args));
  });

  return window;
};
