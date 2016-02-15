'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.printUsage = printUsage;
exports.printBootMessage = printBootMessage;
exports.handleErrors = handleErrors;
exports.setContentDisposition = setContentDisposition;
function printUsage() {
  let type = arguments.length <= 0 || arguments[0] === undefined ? '[pdf|png|jpeg]' : arguments[0];
  let url = arguments.length <= 1 || arguments[1] === undefined ? '' : arguments[1];

  return `Usage: GET ${ url }/${ type }?url=http://google.com&access_key=[token]`;
}

function printBootMessage(listener) {
  var _listener$address = listener.address();

  const port = _listener$address.port;
  const address = _listener$address.address;

  const url = `http://${ address }:${ port }`;
  process.stdout.write(`Renderer listening on ${ url }\n\n`);
  process.stdout.write(`${ printUsage(undefined, url) }\n`);
}

/**
 * Respond with 500
 */
function handleErrors(err, req, res) {
  if (!err) return false;

  res.status(err.statusCode || 500).send({
    error: {
      code: err.code,
      message: err.message || 'Internal Server Error'
    }
  });

  if (err instanceof Error) process.stderr.write(`${ err }\n`);

  return true;
}

/**
 * Set Content-Disposition
 */
function setContentDisposition(res, ext) {
  res.set('Content-Disposition', `inline; filename="render-${ Date.now() }.${ ext }"`);
}