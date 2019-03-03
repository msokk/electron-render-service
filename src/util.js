function printUsage(type = '[pdf|png|jpeg]', url = '') {
  return `Usage: GET ${url}/${type}?accessKey=[token]&url=http%3A%2F%2Fgoogle.com`;
}
exports.printUsage = printUsage;

exports.printBootMessage = function printBootMessage(listener) {
  const { port, address } = listener.address();
  const url = `http://${address}:${port}`;
  process.stdout.write(`Renderer listening on ${url}\n\n`);
  process.stdout.write(`${printUsage(undefined, url)}\n`);
};

/**
 * Respond with 500
 */
exports.handleErrors = function handleErrors(err, req, res) {
  if (!err) return false;

  res.status(err.statusCode || 500).send({
    error: {
      code: err.code,
      message: err.message || 'Internal Server Error'
    }
  });

  if (err instanceof Error) process.stderr.write(`${err}\n`);

  return true;
};

/**
 * Set Content-Disposition
 */
exports.setContentDisposition = function setContentDisposition(res, ext) {
  res.set('Content-Disposition', `inline; filename="render-${Date.now()}.${ext}"`);
};
