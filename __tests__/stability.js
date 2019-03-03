const fs = require('fs');
const path = require('path');
const async = require('async');
const { execSync } = require('child_process');
const got = require('got');

const bigTableHtml = fs.readFileSync(path.resolve(__dirname, 'fixtures/bigTable.html'), 'utf-8');

beforeEach(() => {
  jest.setTimeout(60000);
});

describe('stability', () => {
  describe('POST /pdf', () => {
    it("should render proper PDF's when posting large amounts of big HTML chunks", done => {
      const fixturePath = path.join(__dirname, 'fixtures');
      const examplePdfPath = path.join(fixturePath, 'bigTable.pdf');
      const fixture = fs.readFileSync(examplePdfPath);

      const q = async.queue(async task => {
        const { body } = await got.post('http://localhost:3000/pdf', {
          body: bigTableHtml,
          encoding: null,
          query: {
            accessKey: process.env.RENDERER_ACCESS_KEY,
            url: 'https://example.com/'
          }
        });

        if (body.slice(150).compare(fixture.slice(150)) === 0) return; // Slice out ModDate

        fs.writeFileSync('./bigTable_failed.pdf', body);
        execSync(
          'curl --upload-file ./bigTable_failed.pdf https://transfer.sh/bigTable_failed.pdf',
          { stdio: 'inherit' }
        );
        throw new Error(`${examplePdfPath} (${task}) does not match rendered screenshot`);
      }, 8);

      for (let i = 0; i < 80; i += 1) {
        q.push(i, err => {
          if (err) done(err);
        });
      }

      q.drain = done;
    });
  });
});
