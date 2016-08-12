const assert = require('assert');
const { printUsage } = require('../src/util');


describe('util', () => {
  describe('#printUsage()', () => {
    it('should print default usage string', () => {
      assert.equal(printUsage(), 'Usage: GET /[pdf|png|jpeg]?accessKey=[token]&url=http%3A%2F%2Fgoogle.com');
    });
  });
});
