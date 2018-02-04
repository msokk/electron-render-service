const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const supertest = require('supertest'); // eslint-disable-line

const fixturePath = path.join(__dirname, 'fixtures');

const request = supertest('http://localhost:3000');

const parseBuffer = (res, fn) => { // Superagent does not detect PDF
  const data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => fn(null, Buffer.concat(data)));
};

describe('integration', () => {
  describe('GET /stats', () => {
    it('should disallow access without key', (done) => {
      request
        .get('/stats')
        .set('Accept', 'application/json')
        .expect(403, done);
    });

    it('should print empty stats', (done) => {
      request.get('/stats')
        .query({ accessKey: process.env.RENDERER_ACCESS_KEY })
        .set('Accept', 'application/json')
        .expect(200, {
          concurrency: 1,
          queue_length: 0,
          workersList: [],
        }, done);
    });
  });

  describe('GET /png', () => {
    it('should render valid png from fixtures/example.html', function renderPng(done) {
      this.slow(10000);

      request.get('/png')
        .query({ accessKey: process.env.RENDERER_ACCESS_KEY, url: 'https://example.com/' })
        .expect((res) => {
          if (res.statusCode !== 200) {
            const errMsg = `Invalid response code: ${res.statusCode}\n${JSON.stringify(res.body)}`;
            throw new Error(errMsg);
          }

          const examplePngPath = path.join(fixturePath, 'example.png');
          const fixture = fs.readFileSync(examplePngPath);

          if (res.body.compare(fixture) === 0) return;

          fs.writeFileSync('./example_failed.png', res.body);
          execSync('curl --upload-file ./example_failed.png https://transfer.sh/example_failed.png', { stdio: 'inherit' });
          throw new Error(`${examplePngPath} does not match rendered screenshot`);
        })
        .end(done);
    });
  });

  describe('GET /pdf', () => {
    it('should render valid pdf from fixtures/example.html', function renderPdf(done) {
      this.slow(10000);

      request.get('/pdf')
        .parse(parseBuffer) // Superagent does not detect PDF
        .query({ accessKey: process.env.RENDERER_ACCESS_KEY, url: 'https://example.com/' })
        .expect((res) => {
          if (res.statusCode !== 200) {
            throw new Error(`Invalid response code: ${res.statusCode}\n${res.body}`);
          }

          const examplePdfPath = path.join(fixturePath, 'example.pdf');
          const fixture = fs.readFileSync(examplePdfPath);

          if (res.body.slice(150).compare(fixture.slice(150)) === 0) return; // Slice out ModDate

          fs.writeFileSync('./example_failed.pdf', res.body);
          execSync('curl --upload-file ./example_failed.pdf https://transfer.sh/example_failed.pdf', { stdio: 'inherit' });
          throw new Error(`${examplePdfPath} does not match rendered pdf`);
        })
        .end(done);
    });
  });

  describe('POST /pdf', () => {
    it('should render valid pdf from POSTED html in fixtures/example.html', function renderPdf(done) {
      this.slow(10000);
      const exampleHtmlPath = path.join(fixturePath, 'example.html');

      request.post('/pdf')
        .parse(parseBuffer) // Superagent does not detect PDF
        .type('form')
        .query({ accessKey: process.env.RENDERER_ACCESS_KEY })
        .send(fs.readFileSync(exampleHtmlPath, 'utf-8'))
        .expect((res) => {
          if (res.statusCode !== 200) {
            throw new Error(`Invalid response code: ${res.statusCode}\n${res.body}`);
          }

          const examplePdfPath = path.join(fixturePath, 'example.pdf');
          const fixture = fs.readFileSync(examplePdfPath);

          if (res.body.slice(150).compare(fixture.slice(150)) === 0) return; // Slice out ModDate

          fs.writeFileSync('./example_failed.pdf', res.body);
          execSync('curl --upload-file ./example_failed.pdf https://transfer.sh/example_failed.pdf', { stdio: 'inherit' });
          throw new Error(`${examplePdfPath} does not match rendered pdf`);
        })
        .end(done);
    });
  });
});
