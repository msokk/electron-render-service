import express from 'express';
import morgan from 'morgan';
import responseTime from 'response-time';
import { app as electronApp } from 'electron';

import WindowPool from './window_pool';
import auth from './auth';
import { printUsage, printBootMessage, handleErrors, setContentDisposition } from './util';

const INTERFACE = process.env.INTERFACE || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const app = express();

app.use(responseTime());

// Log with token
morgan.token('key-label', req => req.keyLabel);
app.use(morgan(`[:date[iso]] :key-label@:remote-addr - :method :status
 :url :res[content-length] ":user-agent" :response-time ms`.replace('\n', '')));

app.disable('x-powered-by');
app.enable('trust proxy');

/**
 * GET /pdf - Render PDF
 *
 * Query params: https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback
 * removePrintMedia - removes <link media="print"> stylesheets
 */
app.get('/pdf', auth, (req, res) => {
  const {
    url = `data:text/plain;charset=utf-8,${printUsage('pdf')}`, removePrintMedia = 'false',
    marginsType = 0, pageSize = 'A4', printBackground = 'true', landscape = 'false', delay = 0,
    waitForText = 'false',
  } = req.query;

  req.app.pool.enqueue({ url, type: 'pdf',
    options: {
      pageSize,
      marginsType: parseInt(marginsType, 10),
      landscape: landscape === 'true',
      printBackground: printBackground === 'true',
      removePrintMedia: removePrintMedia === 'true',
      delay: parseInt(delay, 10),
      waitForText: waitForText !== 'false' ? waitForText : false,
    },
  }, (err, buffer) => {
    if (handleErrors(err, req, res)) return;

    setContentDisposition(res, 'pdf');
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
app.get(/^\/(png|jpeg)/, auth, (req, res) => {
  const type = req.params[0];
  const { url = `data:text/plain;charset=utf-8,${printUsage(type)}` } = req.query;

  req.app.pool.enqueue({ url, type, options: req.query }, (err, buffer) => {
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
app.get('/', (req, res) => {
  res.send(printUsage());
});


// Electron finished booting
electronApp.on('ready', () => {
  app.pool = new WindowPool();
  const listener = app.listen(PORT, INTERFACE, () => printBootMessage(listener));
});


// Stop Electron on SIG*
process.on('exit', code => electronApp.exit(code));

// Passthrough error handler to silence Electron prompt
process.on('uncaughtException', err => { throw err; });
