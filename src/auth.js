const KEY_PREFIX = 'RENDERER_ACCESS_KEY';
const validKeys = {};

// Global key
if (process.env[KEY_PREFIX]) validKeys.global = process.env[KEY_PREFIX];

// Labeled keys
Object.keys(process.env)
  .filter(k => k.startsWith(`${KEY_PREFIX}_`))
  .filter(k => process.env[k].length > 0)
  .forEach(k => {
    validKeys[k.replace(`${KEY_PREFIX}_`, '').toLowerCase()] = process.env[k];
  });

if (Object.keys(validKeys).length === 0) {
  process.stderr.write(`No ${KEY_PREFIX} environment variable defined!\n`);
  process.exit(1);
}

/**
 * Simple token auth middleware
 */
module.exports = function authMiddleware(req, res, next) {
  const sentKey = req.query.accessKey;
  const key = Object.keys(validKeys).filter(k => validKeys[k] === sentKey);
  if (!sentKey || key.length === 0) {
    return res.status(403).send({
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing access key.' }
    });
  }

  /* eslint-disable no-param-reassign, prefer-destructuring */
  req.keyLabel = key[0];
  return next();
};
