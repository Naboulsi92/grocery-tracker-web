import assert from 'node:assert/strict';
import test from 'node:test';
import { containsServiceRoleJwt } from './scan-secrets.mjs';

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

test('detects service-role claims by decoding JWT candidates', () => {
  assert.notEqual(containsServiceRoleJwt(`key=${jwt({ role: 'service_role', ref: 'local' })}`), -1);
  assert.equal(containsServiceRoleJwt(`key=${jwt({ role: 'anon', ref: 'local' })}`), -1);
  assert.equal(containsServiceRoleJwt('eyJ.invalid.signature'), -1);
});
