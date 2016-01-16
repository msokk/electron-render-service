import express from 'express';
import morgan from 'morgan';
import { app as electronApp } from 'electron';

import renderPool from './render_pool';
import auth from './auth';

const INTERFACE = process.env.INTERFACE || '0.0.0.0';
const PORT = process.env.PORT || 3000;
const app = express();

function printPDFUsage(url = '') {
  return `Usage: GET ${url}/pdf?url=http://google.com&access_key=<token>`;
}

// Log with token
morgan.token('key-label', req => req.keyLabel);
app.use(morgan(`[:date[iso]] :key-label@:remote-addr - :method :status
:url :res[content-length] ":user-agent" :response-time ms`.replace('\n', '')));


/**
 * GET /pdf - Render PDF
 *
 * Query: https://github.com/atom/electron/blob/master/docs/api/web-contents.md#webcontentsprinttopdfoptions-callback
 */
app.get('/pdf', auth, (req, res) => {
  const { url = 'data:text/plain;charset=utf-8,' + printPDFUsage(),
    marginsType = 0, pageSize = 'A4', printBackground = true, landscape = false } = req.query;

  renderPool.enqueue({ url, res, type: 'pdf',
    options: { marginsType, pageSize, landscape, printBackground } });
});


/**
 * GET /stats - Output some stats as JSON
 */
app.get('/stats', auth, (req, res) => {
  if (req.keyLabel !== 'global') return res.sendStatus(403);

  res.send(renderPool.stats());
});


/**
 * GET / - Print usage
 */
app.get('/', (req, res) => res.status(404).send(printPDFUsage()));


// Electron finished booting
electronApp.on('ready', () => {
  renderPool.init();

  const listener = app.listen(PORT, INTERFACE, () => {
    const { port, address } = listener.address();
    const url = `http://${address}:${port}`;
    process.stdout.write(`Renderer listening on ${url}\n\n`);
    process.stdout.write(printPDFUsage(url) + '\n');
  });
});


// Stop Electron on SIG*
process.on('exit', code => electronApp.exit(code));
