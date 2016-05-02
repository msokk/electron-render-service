import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import request from 'supertest';
import express from 'express';
import app, { electron } from '../src/server';

const fixturePath = path.join(__dirname, 'fixtures');
const fixtureServer = express();
fixtureServer.use(express.static(fixturePath));
fixtureServer.listen(3001);

const parseBuffer = (res, fn) => { // Superagent does not detect PDF
  const data = [];
  res.on('data', chunk => data.push(chunk));
  res.on('end', () => fn(null, Buffer.concat(data)));
};

describe('integration', () => {
  before(function bootElectron(done) {
    this.timeout(5000);
    if (electron.ready) {
      done();
      return;
    }

    electron.on('ready', () => done);
  });

  describe('GET /stats', () => {
    it('should disallow access without key', done => {
      request(app)
        .get('/stats')
        .set('Accept', 'application/json')
        .expect(403, done);
    });

    it('should print empty stats', done => {
      request(app)
        .get('/stats')
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

      request(app)
        .get('/png')
        .query({ accessKey: process.env.RENDERER_ACCESS_KEY, url: 'http://localhost:3001/example.html' })
        .expect(res => {
          const examplePngPath = path.join(fixturePath, 'example.png');

          const fixture = fs.readFileSync(examplePngPath);

          if (res.body.compare(fixture) === 0) return;

          fs.writeFileSync('./example_failed.png', res.body);
          execSync('curl --upload-file ./example_failed.png https://transfer.sh/example_failed.png', { stdio: 'inherit' });
          throw new Error(`${examplePngPath} does not match rendered screenshot`);
        })
        .end(done);
    });

    it('should render valid png from http://acid2.acidtests.org/#top', function renderPng(done) {
      this.timeout(5000);
      this.slow(10000);

      request(app)
        .get('/png')
        .query({ accessKey: process.env.RENDERER_ACCESS_KEY, url: 'http://acid2.acidtests.org/#top' })
        .expect(res => {
          const acidPngPath = path.join(fixturePath, 'acid2.png');
          const fixture = fs.readFileSync(acidPngPath);

          if (res.body.compare(fixture) === 0) return;

          throw new Error(`${acidPngPath} does not match rendered screenshot`);
        })
        .end(done);
    });
  });

  describe('GET /pdf', () => {
    it('should render valid pdf from fixtures/example.html', function renderPdf(done) {
      this.slow(10000);

      request(app)
        .get('/pdf')
        .parse(parseBuffer) // Superagent does not detect PDF
        .query({ accessKey: process.env.RENDERER_ACCESS_KEY, url: 'http://localhost:3001/example.html' })
        .expect(res => {
          const examplePdfPath = path.join(fixturePath, 'example.pdf');
          const fixture = fs.readFileSync(examplePdfPath);

          if (res.body.slice(150).compare(fixture.slice(150)) === 0) return; // Slice out ModDate

          throw new Error(`${examplePdfPath} does not match rendered pdf`);
        })
        .end(done);
    });
  });
});
