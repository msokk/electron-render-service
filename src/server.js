const express = require('express');
const morgan = require('morgan');
const responseTime = require('response-time');
const expressValidator = require('express-validator');

const electronApp = require('electron').app; // eslint-disable-line import/no-unresolved
electronApp.commandLine.appendSwitch('disable-http-cache');
electronApp.commandLine.appendSwitch('disable-gpu');

const WindowPool = require('./window_pool');
const auth = require('./auth');
const { printUsage, printBootMessage, handleErrors, setContentDisposition } = require('./util');

const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const LIMIT = 3000; // Constrain screenshots to 3000x3000px
const WINDOW_WIDTH = parseInt(process.env.WINDOW_WIDTH, 10) || 1024;
const WINDOW_HEIGHT = parseInt(process.env.WINDOW_HEIGHT, 10) || 768;
const app = express();

app.use(responseTime());
app.use(expressValidator());

// Log with token
morgan.token('key-label', req => req.keyLabel);
app.use(morgan(`[:date[iso]] :key-label@:remote-addr - :method :status
 :url :res[content-length] ":user-agent" :response-time ms`.replace('\n', '')));

app.disable('x-powered-by');
app.enable('trust proxy');


/**
 * GET /pdf - Render PDF
 *
 * See more at https://git.io/vwDaJ
 */
app.get('/pdf', auth, (req, res) => {
  req.check({
    url: { // Full URL to fetch
      optional: true,
      isURL: {
        errorMessage: 'Invalid url',
        options: [{ require_protocol: true }],
      },
    },
    html: {
      optional: true
    },
    pageSize: { // Specify page size of the generated PDF
      optional: true,
      isIn: { options: [['A3', 'A4', 'A5', 'Legal', 'Letter', 'Tabloid']] },
    },
    marginsType: { // Specify the type of margins to use
      optional: true, isInt: true, isIn: { options: [[0, 1, 2]] },
    },
    printBackground: { // Whether to print CSS backgrounds.
      optional: true, isBoolean: true,
    },
    landscape: { // true for landscape, false for portrait.
      optional: true, isBoolean: true,
    },
    removePrintMedia: { // Removes any <link media="print"> stylesheets on page before render.
      optional: true, isBoolean: true,
    },
    delay: { // Specify how long to wait before generating the PDF
      optional: true, isInt: true,
    },
    waitForText: { // Specify a specific string of text to find before generating the PDF
      optional: true, notEmpty: true,
    },
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

  const { url, html, pageSize = 'A4', marginsType = 0, printBackground = true, landscape = false,
    removePrintMedia = false, delay = 0, waitForText = false } = req.query;

  if (!url && !html) {
    res.status(400).send({
      "input_errors":[
        {"param":"url","msg":"Can not be empty when no html is provided", "value": url},
        {"param":"html","msg":"Can not be empty when no url is provided", "value": html}
      ]
    });
    return;
  }

  req.app.pool.enqueue({ type: 'pdf', url, html, pageSize, marginsType,
    landscape, printBackground, removePrintMedia, delay, waitForText,
  }, (err, buffer) => {
    if (handleErrors(err, req, res)) return;

    setContentDisposition(res, 'pdf');
    res.type('pdf').send(buffer);
  });
});


/**
 * GET /png|jpeg - Render png or jpeg
 */
app.get(/^\/(png|jpeg)/, auth, (req, res) => {
  const type = req.params[0];
  req.check({
    url: { // Full URL to fetch
      optional: true,
      isURL: {
        errorMessage: 'Invalid url',
        options: [{ require_protocol: true }],
      }
    },
    html: {
      optional: true
    },
    quality: { // JPEG quality
      optional: true, isInt: true,
    },
    browserWidth: { // Browser window width
      optional: true, isInt: true,
    },
    browserHeight: { // Browser window height
      optional: true, isInt: true,
    },
    delay: { // Specify how long to wait before generating the PDF
      optional: true, isInt: true,
    },
    waitForText: { // Specify a specific string of text to find before generating the PDF
      optional: true, notEmpty: true,
    },
  });

  if (req.query.clippingRect) {
    req.check({
      'clippingRect.x': { isInt: { errorMessage: 'Invalid value' } },
      'clippingRect.y': { isInt: { errorMessage: 'Invalid value' } },
      'clippingRect.width': { isInt: { errorMessage: 'Invalid value' } },
      'clippingRect.height': { isInt: { errorMessage: 'Invalid value' } },
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

  const { url, html, quality = 80, delay, waitForText, clippingRect,
    browserWidth = WINDOW_WIDTH, browserHeight = WINDOW_HEIGHT } = req.query;

  if (!url && !html) {
    res.status(400).send({
      "input_errors":[
        {"param":"url","msg":"Can not be empty when no html is provided", "value": url},
        {"param":"html","msg":"Can not be empty when no url is provided", "value": html}
      ]
    });
    return;
  }

  req.app.pool.enqueue({
    type, url, html, quality, delay, waitForText, clippingRect,
    browserWidth: Math.min(browserWidth, LIMIT), // Cap width and height to avoid overload
    browserHeight: Math.min(browserHeight, LIMIT),
  }, (err, buffer) => {
    if (handleErrors(err, req, res)) return;

    setContentDisposition(res, type);
    res.type(type).send(buffer);
  });
});


/**
 * GET /stats - Output some stats as JSON
 */
app.get('/stats', auth, (req, res) => {
  if (req.keyLabel !== 'global') return res.sendStatus(403);
  return res.send(req.app.pool.stats());
});


/**
 * GET / - Print usage
 */
app.get('/', (req, res) => res.send(printUsage()));


// Electron finished booting
electronApp.once('ready', () => {
  electronApp.ready = true;
  app.pool = new WindowPool();
  const listener = app.listen(PORT, HOSTNAME, () => printBootMessage(listener));
});


// Stop Electron on SIG*
process.on('exit', code => electronApp.exit(code));

// Passthrough error handler to silence Electron GUI prompt
process.on('uncaughtException', err => { throw err; });
