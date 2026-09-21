import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { MIN_SUITES, MIN_TESTS, checkCounts } from './check-test-count.mjs';

describe('check-test-count', () => {
  test('seuils documentes (garde-fou anti-exclusion silencieuse)', () => {
    assert.equal(MIN_SUITES, 26);
    assert.equal(MIN_TESTS, 280);
  });

  test('accepte le volume actuel (28 suites / 313 tests)', () => {
    assert.deepEqual(checkCounts({ suites: 28, tests: 313 }), []);
  });

  test('accepte exactement les seuils', () => {
    assert.deepEqual(checkCounts({ suites: 26, tests: 280 }), []);
  });

  test('refuse une exclusion silencieuse (ancien perimetre 18/104)', () => {
    const errors = checkCounts({ suites: 18, tests: 104 });
    assert.equal(errors.length, 2);
    assert.match(errors.join('\n'), /suites/);
    assert.match(errors.join('\n'), /tests/);
  });

  test('refuse les valeurs non entieres', () => {
    assert.equal(checkCounts({ suites: Number.NaN, tests: 300 }).length, 1);
    assert.equal(checkCounts({ suites: 30, tests: undefined }).length, 1);
  });
});
