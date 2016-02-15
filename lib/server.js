'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _responseTime = require('response-time');

var _responseTime2 = _interopRequireDefault(_responseTime);

var _electron = require('electron');

var _window_pool = require('./window_pool');

var _window_pool2 = _interopRequireDefault(_window_pool);

var _auth = require('./auth');

var _auth2 = _interopRequireDefault(_auth);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const INTERFACE = process.env.INTERFACE || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const app = (0, _express2.default)();

app.use((0, _responseTime2.default)());

// Log with token
_morgan2.default.token('key-label', req => req.keyLabel);
app.use((0, _morgan2.default)(`[:date[iso]] :key-label@:remote-addr - :method :status
 :url :res[content-length] ":user-agent" :response-time ms`.replace('\n', '')));

app.disable('x-powered-by');
app.enable('trust proxy');

/**
 * GET /pdf - Render PDF
 *
 * Query params: https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback
 * removePrintMedia - removes <link media="print"> stylesheets
 */
app.get('/pdf', _auth2.default, (req, res) => {
  var _req$query = req.query;
  var _req$query$url = _req$query.url;
  const url = _req$query$url === undefined ? `data:text/plain;charset=utf-8,${ (0, _util.printUsage)('pdf') }` : _req$query$url;
  var _req$query$removePrin = _req$query.removePrintMedia;
  const removePrintMedia = _req$query$removePrin === undefined ? 'false' : _req$query$removePrin;
  var _req$query$marginsTyp = _req$query.marginsType;
  const marginsType = _req$query$marginsTyp === undefined ? 0 : _req$query$marginsTyp;
  var _req$query$pageSize = _req$query.pageSize;
  const pageSize = _req$query$pageSize === undefined ? 'A4' : _req$query$pageSize;
  var _req$query$printBackg = _req$query.printBackground;
  const printBackground = _req$query$printBackg === undefined ? 'true' : _req$query$printBackg;
  var _req$query$landscape = _req$query.landscape;
  const landscape = _req$query$landscape === undefined ? 'false' : _req$query$landscape;


  req.app.pool.enqueue({ url, type: 'pdf',
    options: {
      pageSize,
      marginsType: parseInt(marginsType, 10),
      landscape: landscape === 'true',
      printBackground: printBackground === 'true',
      removePrintMedia: removePrintMedia === 'true'
    }
  }, (err, buffer) => {
    if ((0, _util.handleErrors)(err, req, res)) return;

    (0, _util.setContentDisposition)(res, 'pdf');
    res.type('pdf').send(buffer);
  });
});

/**
 * GET /png|jpeg - Render png or jpeg
 *
 * Query params:
 * x = 0, y = 0, width, height
 * quality = 80 - JPEG quality
 */
app.get(/^\/(png|jpeg)/, _auth2.default, (req, res) => {
  const type = req.params[0];
  var _req$query$url2 = req.query.url;
  const url = _req$query$url2 === undefined ? `data:text/plain;charset=utf-8,${ (0, _util.printUsage)(type) }` : _req$query$url2;


  req.app.pool.enqueue({ url, type, options: req.query }, (err, buffer) => {
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

  res.send(req.app.pool.stats());
});

/**
 * GET / - Print usage
 */
app.get('/', (req, res) => {
  res.send((0, _util.printUsage)());
});

// Electron finished booting
_electron.app.on('ready', () => {
  app.pool = new _window_pool2.default();
  const listener = app.listen(PORT, INTERFACE, () => (0, _util.printBootMessage)(listener));
});

// Stop Electron on SIG*
process.on('exit', code => _electron.app.exit(code));

// Passthrough error handler to silence Electron prompt
process.on('uncaughtException', err => {
  throw err;
});