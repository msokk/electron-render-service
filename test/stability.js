const supertest = require('supertest'); // eslint-disable-line
const request = supertest('http://localhost:3000');
const fs = require('fs');
const path = require('path');
const async = require('async');
const { execSync } = require('child_process');

const bigTableHtml = fs.readFileSync(path.resolve(__dirname, 'fixtures/bigTable.html'), 'utf-8');

const parseBuffer = (res, fn) => { // Superagent does not detect PDF
  const data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => fn(null, Buffer.concat(data)));
};

describe('stability', () => {
  describe('POST /pdf', () => {
    it('should render proper PDF\'s when posting large amounts of big HTML chunks', function largeHTMLTest(done) {
      this.timeout(60000);
      this.slow(30000);

      const fixturePath = path.join(__dirname, 'fixtures');
      const examplePdfPath = path.join(fixturePath, 'bigTable.pdf');
      const fixture = fs.readFileSync(examplePdfPath);

      const q = async.queue((task, callback) => {
        request
          .post('/pdf')
          .parse(parseBuffer) // Superagent does not detect PDF
          .type('form')
          .send(bigTableHtml)
          .query({ accessKey: process.env.RENDERER_ACCESS_KEY })
          .expect((res) => {
            if (res.statusCode !== 200) {
              const errMsg = `Invalid response code: ${res.statusCode}\n${JSON.stringify(res.body)}`;
              throw new Error(errMsg);
            }

            if (res.body.slice(150).compare(fixture.slice(150)) === 0) return; // Slice out ModDate

            fs.writeFileSync('./bigTable_failed.pdf', res.body);
            execSync('curl --upload-file ./bigTable_failed.pdf https://transfer.sh/bigTable_failed.pdf', { stdio: 'inherit' });
            throw new Error(`${examplePdfPath} (${task}) does not match rendered screenshot`);
          })
          .end(callback);
      }, 8);

      for (let i = 0; i < 80; i += 1) {
        q.push(i, (err) => {
          if (err) done(err);
        });
      }

      q.drain = done;
    });
  });
});
