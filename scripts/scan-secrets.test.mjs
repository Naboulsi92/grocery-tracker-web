import assert from 'node:assert/strict';
import test from 'node:test';
import { containsServiceRoleJwt, findFindings } from './scan-secrets.mjs';

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

test('detects service-role claims by decoding JWT candidates', () => {
  assert.notEqual(containsServiceRoleJwt(`key=${jwt({ role: 'service_role', ref: 'local' })}`), -1);
  assert.equal(containsServiceRoleJwt(`key=${jwt({ role: 'anon', ref: 'local' })}`), -1);
  assert.equal(containsServiceRoleJwt('eyJ.invalid.signature'), -1);
});

test('regression #73: fake E2E literals are allowed', () => {
  const content = `
    await page.getByLabel('Email').fill('nonexistent@example.com');
    await page.getByLabel('Mot de passe').fill('wrongpassword123');
  `;
  assert.deepEqual(findFindings(content, 'src/e2e/error-states.spec.ts'), []);
});

test('E2E email on a real domain is flagged', () => {
  const content = `await page.getByLabel('Email').fill('user@gmail.com');`;
  const findings = findFindings(content, 'src/e2e/error-states.spec.ts');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /email literal in E2E/);
});

test('E2E password fill with a real-looking value is flagged', () => {
  const content = `await page.getByLabel('Mot de passe').fill('Tr0ub4dor&3');`;
  const findings = findFindings(content, 'src/e2e/error-states.spec.ts');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /password literal in E2E fill/);
});

test('non-E2E paths do not apply e2e literal patterns', () => {
  const content = `
    fill('nonexistent@example.com');
    fill('wrongpassword123');
  `;
  assert.deepEqual(findFindings(content, 'src/lib/foo.ts'), []);
});
