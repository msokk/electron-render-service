import assert from 'assert';
import { printUsage } from '../src/util';


describe('util', () => {
  describe('#printUsage()', () => {
    it('should print default usage string', () => {
      assert.equal(printUsage(), 'Usage: GET /[pdf|png|jpeg]?url=http://google.com&accessKey=[token]');
    });
  });
});
