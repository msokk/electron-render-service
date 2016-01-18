'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _morgan = require('morgan');

var _morgan2 = _interopRequireDefault(_morgan);

var _electron = require('electron');

var _render_pool = require('./render_pool');

var _render_pool2 = _interopRequireDefault(_render_pool);

var _auth = require('./auth');

var _auth2 = _interopRequireDefault(_auth);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const INTERFACE = process.env.INTERFACE || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const app = (0, _express2.default)();

function printPDFUsage() {
  let url = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

  return `Usage: GET ${ url }/pdf?url=http://google.com&access_key=<token>`;
}

// Log with token
_morgan2.default.token('key-label', req => req.keyLabel);
app.use((0, _morgan2.default)(`[:date[iso]] :key-label@:remote-addr - :method :status
:url :res[content-length] ":user-agent" :response-time ms`.replace('\n', '')));

/**
 * GET /pdf - Render PDF
 *
 * Query: https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback
 */
app.get('/pdf', _auth2.default, (req, res) => {
  var _req$query = req.query;
  var _req$query$url = _req$query.url;
  const url = _req$query$url === undefined ? 'data:text/plain;charset=utf-8,' + printPDFUsage() : _req$query$url;
  var _req$query$marginsTyp = _req$query.marginsType;
  const marginsType = _req$query$marginsTyp === undefined ? 0 : _req$query$marginsTyp;
  var _req$query$pageSize = _req$query.pageSize;
  const pageSize = _req$query$pageSize === undefined ? 'A4' : _req$query$pageSize;
  var _req$query$printBackg = _req$query.printBackground;
  const printBackground = _req$query$printBackg === undefined ? true : _req$query$printBackg;
  var _req$query$landscape = _req$query.landscape;
  const landscape = _req$query$landscape === undefined ? false : _req$query$landscape;

  _render_pool2.default.enqueue({ url, res, type: 'pdf',
    options: { marginsType, pageSize, landscape, printBackground } });
});

/**
 * GET /stats - Output some stats as JSON
 */
app.get('/stats', _auth2.default, (req, res) => {
  if (req.keyLabel !== 'global') return res.sendStatus(403);

  res.send(_render_pool2.default.stats());
});

/**
 * GET / - Print usage
 */
app.get('/', (req, res) => res.status(404).send(printPDFUsage()));

// Electron finished booting
_electron.app.on('ready', () => {
  _render_pool2.default.init();

  const listener = app.listen(PORT, INTERFACE, () => {
    var _listener$address = listener.address();

    const port = _listener$address.port;
    const address = _listener$address.address;

    const url = `http://${ address }:${ port }`;
    process.stdout.write(`Renderer listening on ${ url }\n\n`);
    process.stdout.write(printPDFUsage(url) + '\n');
  });
});

// Stop Electron on SIG*
process.on('exit', code => _electron.app.exit(code));