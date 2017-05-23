const request = require('supertest')('http://localhost:3000');
const assert = require('assert');

describe('healthcheck', () => {
	it('GET /health_check should response 200 and status UP', () => {
		return request
			.get('/health_check')
			.expect(200)
			.expect(res => assert.deepEqual(res.body, { status: 'UP' }));
	});
});
