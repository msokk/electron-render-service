'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.validateResult = validateResult;
/**
 * Custom Renderer error
 */
class RendererError extends Error {
  constructor(code, message) {
    let statusCode = arguments.length <= 2 || arguments[2] === undefined ? 500 : arguments[2];

    super();
    this.code = code;
    this.message = message;
    this.statusCode = statusCode;
  }
}

exports.RendererError = RendererError; /**
                                        * Handle loading failure errors
                                        */

function handleLoadingError(currentUrl, event, code, desc, url) {
  switch (code) {
    case -105:
      return Promise.reject(new RendererError('NAME_NOT_RESOLVED', 'The host name could not be resolved.'));
    case -137:
      return Promise.reject(new RendererError('NAME_RESOLUTION_FAILED', 'Hostname resolution failed (DNS).'));
    case -300:
      return Promise.reject(new RendererError('INVALID_URL', 'The URL is invalid.'));
    case -501:
      return Promise.reject(new RendererError('INSECURE_RESPONSE', 'The server\'s response was insecure (e.g. there was a cert error).'));
    case -6:
      return Promise.reject(new RendererError('FILE_NOT_FOUND', 'The file or directory cannot be found.'));
    case -3:
      // Subresource fails to load, render page anyway
      if (currentUrl !== url) {
        process.stderr.write(`Failed to load url on page:\n${ url }\n`);
        return new Promise(resolve => event.sender.once('did-finish-load', resolve));
      }

      return Promise.reject(new RendererError('ABORTED', 'Page failed to load.'));
    default:
      return Promise.reject(new RendererError('GENERIC_ERROR', `${ code } - ${ desc }`));
  }
}

/**
 * Validate renderer result
 */
function validateResult(originalUrl, eventType) {
  switch (eventType) {
    // Loading failures
    case 'did-fail-load':
      for (var _len = arguments.length, args = Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }

      return handleLoadingError(originalUrl, ...args);
    // Renderer process has crashed
    case 'crashed':
      return Promise.reject(new RendererError('RENDERER_CRASH', 'Render process crashed.'));
    // Page loading timed out
    case 'timeout':
      return Promise.reject(new RendererError('RENDERER_TIMEOUT', 'Renderer timed out.', 524));
    // Page loaded successfully
    case 'did-finish-load':
      return Promise.resolve();

    // Unhandled event
    default:
      return Promise.reject(new RendererError('UNHANDLED_EVENT', eventType));
  }
}