const request = require('supertest')('http://localhost:3000');
const assert = require('assert');
const packageFile = require(`${process.cwd()}/package.json`);

describe('info', () => {
	it('GET /info should response 200 and contain application name and version', () => {
		return request
			.get('/info')
			.expect(200)
			.expect(res => assert.deepEqual(res.body, { [packageFile.name]: packageFile.version }));
	});
});
