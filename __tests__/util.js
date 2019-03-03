const { printUsage } = require('../src/util');

describe('util#printUsage()', () => {
  it('should print default usage string', () => {
    expect(printUsage()).toBe(
      'Usage: GET /[pdf|png|jpeg]?accessKey=[token]&url=http%3A%2F%2Fgoogle.com'
    );
  });
});
