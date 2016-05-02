'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.electron = undefined;

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _responseTime = require('response-time');

var _responseTime2 = _interopRequireDefault(_responseTime);

var _expressValidator = require('express-validator');

var _expressValidator2 = _interopRequireDefault(_expressValidator);

var _electron = require('electron');

var _window_pool = require('./window_pool');

var _window_pool2 = _interopRequireDefault(_window_pool);

var _auth = require('./auth');

var _auth2 = _interopRequireDefault(_auth);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// eslint-disable-line import/no-unresolved
_electron.app.commandLine.appendSwitch('disable-http-cache');
_electron.app.commandLine.appendSwitch('disable-gpu');

const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const LIMIT = 3000; // Constrain screenshots to 3000x3000px
const WINDOW_WIDTH = parseInt(process.env.WINDOW_WIDTH, 10) || 1024;
const WINDOW_HEIGHT = parseInt(process.env.WINDOW_HEIGHT, 10) || 768;
const app = (0, _express2.default)();

app.use((0, _responseTime2.default)());
app.use((0, _expressValidator2.default)());

// Log with token
_morgan2.default.token('key-label', req => req.keyLabel);
app.use((0, _morgan2.default)(`[:date[iso]] :key-label@:remote-addr - :method :status
 :url :res[content-length] ":user-agent" :response-time ms`.replace('\n', '')));

app.disable('x-powered-by');
app.enable('trust proxy');

/**
 * GET /pdf - Render PDF
 *
 * See more at https://git.io/vwDaJ
 */
app.get('/pdf', _auth2.default, (req, res) => {
  req.check({
    url: { // Full URL to fetch
      notEmpty: true,
      isURL: {
        errorMessage: 'Invalid url',
        options: [{ require_protocol: true }]
      }
    },
    pageSize: { // Specify page size of the generated PDF
      optional: true,
      isIn: { options: [['A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid']] }
    },
    marginsType: { // Specify the type of margins to use
      optional: true, isInt: true, isIn: { options: [[0, 1, 2]] }
    },
    printBackground: { // Whether to print CSS backgrounds.
      optional: true, isBoolean: true
    },
    landscape: { // true for landscape, false for portrait.
      optional: true, isBoolean: true
    },
    removePrintMedia: { // Removes any <link media="print"> stylesheets on page before render.
      optional: true, isBoolean: true
    },
    delay: { // Specify how long to wait before generating the PDF
      optional: true, isInt: true
    },
    waitForText: { // Specify a specific string of text to find before generating the PDF
      optional: true, notEmpty: true
    }
  });

  const validationResult = req.validationErrors();
  if (validationResult) {
    res.status(400).send({ input_errors: validationResult });
    return;
  }

  req.sanitize('marginsType').toInt(10);
  req.sanitize('printBackground').toBoolean(true);
  req.sanitize('landscape').toBoolean(true);
  req.sanitize('removePrintMedia').toBoolean(true);
  req.sanitize('delay').toInt(10);

  var _req$query = req.query;
  const url = _req$query.url;
  var _req$query$pageSize = _req$query.pageSize;
  const pageSize = _req$query$pageSize === undefined ? 'A4' : _req$query$pageSize;
  var _req$query$marginsTyp = _req$query.marginsType;
  const marginsType = _req$query$marginsTyp === undefined ? 0 : _req$query$marginsTyp;
  var _req$query$printBackg = _req$query.printBackground;
  const printBackground = _req$query$printBackg === undefined ? true : _req$query$printBackg;
  var _req$query$landscape = _req$query.landscape;
  const landscape = _req$query$landscape === undefined ? false : _req$query$landscape;
  var _req$query$removePrin = _req$query.removePrintMedia;
  const removePrintMedia = _req$query$removePrin === undefined ? false : _req$query$removePrin;
  var _req$query$delay = _req$query.delay;
  const delay = _req$query$delay === undefined ? 0 : _req$query$delay;
  var _req$query$waitForTex = _req$query.waitForText;
  const waitForText = _req$query$waitForTex === undefined ? false : _req$query$waitForTex;


  req.app.pool.enqueue({ type: 'pdf', url: url, pageSize: pageSize, marginsType: marginsType,
    landscape: landscape, printBackground: printBackground, removePrintMedia: removePrintMedia, delay: delay, waitForText: waitForText
  }, (err, buffer) => {
    if ((0, _util.handleErrors)(err, req, res)) return;

    (0, _util.setContentDisposition)(res, 'pdf');
    res.type('pdf').send(buffer);
  });
});

/**
 * GET /png|jpeg - Render png or jpeg
 */
app.get(/^\/(png|jpeg)/, _auth2.default, (req, res) => {
  const type = req.params[0];
  req.check({
    url: { // Full URL to fetch
      notEmpty: true,
      isURL: {
        errorMessage: 'Invalid url',
        options: [{ require_protocol: true }]
      }
    },
    quality: { // JPEG quality
      optional: true, isInt: true
    },
    browserWidth: { // Browser window width
      optional: true, isInt: true
    },
    browserHeight: { // Browser window height
      optional: true, isInt: true
    },
    delay: { // Specify how long to wait before generating the PDF
      optional: true, isInt: true
    },
    waitForText: { // Specify a specific string of text to find before generating the PDF
      optional: true, notEmpty: true
    }
  });

  if (req.query.clippingRect) {
    req.check({
      'clippingRect.x': { isInt: { errorMessage: 'Invalid value' } },
      'clippingRect.y': { isInt: { errorMessage: 'Invalid value' } },
      'clippingRect.width': { isInt: { errorMessage: 'Invalid value' } },
      'clippingRect.height': { isInt: { errorMessage: 'Invalid value' } }
    });
  }

  const validationResult = req.validationErrors();
  if (validationResult) {
    res.status(400).send({ input_errors: validationResult });
    return;
  }

  req.sanitize('quality').toInt(10);
  req.sanitize('browserWidth').toInt(10);
  req.sanitize('browserHeight').toInt(10);

  if (req.query.clippingRect) {
    req.sanitize('clippingRect.x').toInt(10);
    req.sanitize('clippingRect.y').toInt(10);
    req.sanitize('clippingRect.width').toInt(10);
    req.sanitize('clippingRect.height').toInt(10);
  }

  var _req$query2 = req.query;
  const url = _req$query2.url;
  var _req$query2$quality = _req$query2.quality;
  const quality = _req$query2$quality === undefined ? 80 : _req$query2$quality;
  const delay = _req$query2.delay;
  const waitForText = _req$query2.waitForText;
  const clippingRect = _req$query2.clippingRect;
  var _req$query2$browserWi = _req$query2.browserWidth;
  const browserWidth = _req$query2$browserWi === undefined ? WINDOW_WIDTH : _req$query2$browserWi;
  var _req$query2$browserHe = _req$query2.browserHeight;
  const browserHeight = _req$query2$browserHe === undefined ? WINDOW_HEIGHT : _req$query2$browserHe;


  req.app.pool.enqueue({
    type: type, url: url, quality: quality, delay: delay, waitForText: waitForText, clippingRect: clippingRect,
    browserWidth: Math.min(browserWidth, LIMIT), // Cap width and height to avoid overload
    browserHeight: Math.min(browserHeight, LIMIT)
  }, (err, buffer) => {
    if ((0, _util.handleErrors)(err, req, res)) return;

    (0, _util.setContentDisposition)(res, type);
    res.type(type).send(buffer);
  });
});

/**
 * GET /stats - Output some stats as JSON
 */
app.get('/stats', _auth2.default, (req, res) => {
  if (req.keyLabel !== 'global') return res.sendStatus(403);
  return res.send(req.app.pool.stats());
});

/**
 * GET / - Print usage
 */
app.get('/', (req, res) => res.send((0, _util.printUsage)()));

// Electron finished booting
_electron.app.once('ready', () => {
  _electron.app.ready = true;
  app.pool = new _window_pool2.default();
  const listener = app.listen(PORT, HOSTNAME, () => (0, _util.printBootMessage)(listener));
});

// Stop Electron on SIG*
process.on('exit', code => _electron.app.exit(code));

// Passthrough error handler to silence Electron GUI prompt
process.on('uncaughtException', err => {
  throw err;
});

exports.default = app;
const electron = exports.electron = _electron.app;