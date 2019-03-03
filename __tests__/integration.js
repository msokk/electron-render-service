const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const got = require('got');

const fixturePath = path.join(__dirname, 'fixtures');

const client = got.extend({
  baseUrl: 'http://localhost:3000',
  query: { accessKey: process.env.RENDERER_ACCESS_KEY }
});

function recordFailure(name, body) {
  fs.writeFileSync(`./${name}`, body);
  execSync(`curl --upload-file ./${name} https://transfer.sh/${name}`, {
    stdio: 'inherit'
  });
}

beforeEach(() => {
  jest.setTimeout(10000);
});

describe('integration', () => {
  describe('GET /stats', () => {
    it('should disallow access without key', async () => {
      expect.assertions(1);
      try {
        await got.get('http://localhost:3000/stats');
      } catch (error) {
        expect(error.response.statusCode).toEqual(403);
      }
    });

    it('should print empty stats', async () => {
      const { body } = await client.get('/stats', { json: true });

      expect(body).toEqual({
        concurrency: 1,
        queue_length: 0,
        workersList: []
      });
    });
  });

  describe('GET /png', () => {
    it('should render valid png from fixtures/example.html', async () => {
      const { body } = await client.get('/png', {
        encoding: null,
        query: { url: 'https://example.com/' }
      });

      const examplePngPath = path.join(fixturePath, 'example.png');
      const fixture = fs.readFileSync(examplePngPath);
      if (body.compare(fixture) === 0) return;

      recordFailure('example_failed.png', body);
      throw new Error(`${examplePngPath} does not match rendered screenshot`);
    });
  });

  describe('GET /pdf', () => {
    it('should render valid pdf from fixtures/example.html', async () => {
      const { body } = await client.get('/pdf', {
        encoding: null,
        query: { url: 'https://example.com/' }
      });

      const examplePdfPath = path.join(fixturePath, 'example.pdf');
      const fixture = fs.readFileSync(examplePdfPath);
      if (body.slice(150).compare(fixture.slice(150)) === 0) return; // Slice out ModDate

      recordFailure('example_failed.pdf', body);
      throw new Error(`${examplePdfPath} does not match rendered pdf`);
    });
  });

  describe('POST /pdf', () => {
    it('should render valid pdf from POSTED html in fixtures/example.html', async () => {
      const exampleHtmlPath = path.join(fixturePath, 'example.html');
      const exampleHtml = fs.readFileSync(exampleHtmlPath, 'utf-8');

      const { body } = await client.post('/pdf', {
        body: exampleHtml,
        encoding: null,
        query: { url: 'https://example.com/' }
      });

      const examplePdfPath = path.join(fixturePath, 'example.pdf');
      const fixture = fs.readFileSync(examplePdfPath);

      if (body.slice(150).compare(fixture.slice(150)) === 0) return; // Slice out ModDate
      recordFailure('example_failed_post.pdf', body);
      throw new Error(`${examplePdfPath} does not match rendered pdf`);
    });
  });
});
