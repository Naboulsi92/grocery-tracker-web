import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Ticket #223: the OS badge routing lives in public/sw.js (classic script,
// no imports), so the tests evaluate the real source with a stubbed `self`
// and drive the captured 'push' handler.

const swSource = await readFile(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sw.js'),
  'utf8',
);

// The navigator stub records on a single module-level store
// (`navigatorCalls`, reset per test): the SW is evaluated through
// Function-constructed scope, so recorder closures must stay outside of it
// for every test to observe the same calls.
const navigatorCalls = { setArgument: null, setCount: 0, clearCount: 0 };

function resetNavigatorCalls() {
  navigatorCalls.setArgument = null;
  navigatorCalls.setCount = 0;
  navigatorCalls.clearCount = 0;
}

function loadServiceWorker() {
  const handlers = {};
  const calls = { showNotification: [] };
  const self = {
    location: new URL('https://app.example/'),
    clients: { matchAll: async () => [] },
    caches: {
      open: async () => ({ addAll: async () => {}, match: async () => undefined, put: async () => {} }),
      keys: async () => [],
      match: async () => undefined,
      delete: async () => true,
    },
    navigator: {},
    registration: {
      showNotification: async (title, options) => {
        calls.showNotification.push([title, options]);
      },
    },
    addEventListener: (name, handler) => {
      handlers[name] = handler;
    },
  };
  new Function('self', swSource)(self);
  return { handlers, calls, self };
}

function makeBadgeNavigator() {
  return {
    setAppBadge: (count) => {
      navigatorCalls.setCount += 1;
      navigatorCalls.setArgument = count;
      return Promise.resolve();
    },
    clearAppBadge: () => {
      navigatorCalls.clearCount += 1;
      return Promise.resolve();
    },
  };
}

function makePushEvent(payloadJson, dataText) {
  const waited = [];
  const event = {
    data: payloadJson === null
      ? { json: () => { throw new Error('bad json'); }, text: () => dataText ?? '' }
      : { json: () => payloadJson, text: () => dataText ?? '' },
    waitUntil: (promise) => {
      waited.push(promise);
    },
  };
  return { event, waited };
}

describe('sw.js OS badge routing (ticket #223)', () => {
  test('sets the OS badge to the payload count and shows the notification', async () => {
    resetNavigatorCalls();
    const { handlers, calls, self } = loadServiceWorker();
    self.navigator = makeBadgeNavigator();
    const { event, waited } = makePushEvent({ title: 'Cuisine', body: '3 article(s) à acheter', badge: 3 });

    handlers.push(event);
    await waited[0];

    assert.equal(navigatorCalls.setCount, 1);
    assert.equal(navigatorCalls.setArgument, 3);
    assert.equal(navigatorCalls.clearCount, 0);
    assert.equal(calls.showNotification.length, 1);
    assert.deepEqual(calls.showNotification[0][0], 'Cuisine');
  });

  test('clears the OS badge when the count says the list is empty', async () => {
    resetNavigatorCalls();
    const { handlers, self } = loadServiceWorker();
    self.navigator = makeBadgeNavigator();
    const { event, waited } = makePushEvent({ badge: 0 });

    handlers.push(event);
    await waited[0];

    assert.equal(navigatorCalls.clearCount, 1);
    assert.equal(navigatorCalls.setCount, 0);
  });

  test('leaves the OS badge untouched when the payload has no badge', async () => {
    resetNavigatorCalls();
    const { handlers, calls, self } = loadServiceWorker();
    self.navigator = makeBadgeNavigator();
    const { event, waited } = makePushEvent({ body: 'Mise à jour' });

    handlers.push(event);
    await waited[0];

    assert.equal(navigatorCalls.setCount, 0);
    assert.equal(navigatorCalls.clearCount, 0);
    assert.equal(calls.showNotification.length, 1);
  });

  test('leaves the OS badge untouched on malformed badge values', async () => {
    for (const badge of [2.5, -1]) {
      resetNavigatorCalls();
      const { handlers, self } = loadServiceWorker();
      self.navigator = makeBadgeNavigator();
      const { event, waited } = makePushEvent({ badge });

      handlers.push(event);
      await waited[0];

      assert.equal(navigatorCalls.setCount, 0, `setAppBadge not called for badge=${badge}`);
      assert.equal(navigatorCalls.clearCount, 0, `clearAppBadge not called for badge=${badge}`);
    }
  });

  test('engines without the badge API still receive the notification', async () => {
    resetNavigatorCalls();
    const { handlers, calls, self } = loadServiceWorker();
    self.navigator = {}; // no setAppBadge/clearAppBadge (Firefox desktop)
    const { event, waited } = makePushEvent({ badge: 2 });

    handlers.push(event);
    await waited[0];

    assert.equal(calls.showNotification.length, 1);
    assert.equal(navigatorCalls.setCount, 0);
    assert.equal(navigatorCalls.clearCount, 0);
  });

  test('a rejected setAppBadge promise never breaks the push handling', async () => {
    resetNavigatorCalls();
    const { handlers, calls, self } = loadServiceWorker();
    self.navigator = {
      setAppBadge: (count) => {
        navigatorCalls.setCount += 1;
        navigatorCalls.setArgument = count;
        return Promise.reject(new Error('boom'));
      },
    };
    const { event, waited } = makePushEvent({ badge: 5 });

    handlers.push(event);
    await waited[0];

    assert.equal(navigatorCalls.setCount, 1);
    assert.equal(navigatorCalls.setArgument, 5);
    assert.equal(calls.showNotification.length, 1);
  });

  test('malformed push JSON routes no badge change', async () => {
    resetNavigatorCalls();
    const { handlers, calls, self } = loadServiceWorker();
    self.navigator = makeBadgeNavigator();
    const { event, waited } = makePushEvent(null, 'raw text');

    handlers.push(event);
    await waited[0];

    assert.equal(navigatorCalls.setCount, 0);
    assert.equal(navigatorCalls.clearCount, 0);
    assert.equal(calls.showNotification.length, 1);
  });

  test('notification and badge update share the push event lifetime', async () => {
    resetNavigatorCalls();
    const { handlers, calls, self } = loadServiceWorker();
    let releaseBadge;
    const deferredBadge = new Promise((resolve) => { releaseBadge = resolve; });
    self.navigator = {
      setAppBadge: (count) => {
        navigatorCalls.setCount += 1;
        navigatorCalls.setArgument = count;
        return deferredBadge;
      },
    };
    const { event, waited } = makePushEvent({ badge: 4 });

    handlers.push(event);

    assert.equal(waited.length, 1, 'a single waitUntil covers notification + badge');
    let settled = false;
    waited[0].then(() => { settled = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(settled, false, 'waitUntil stays pending until the badge promise settles');
    releaseBadge();
    await waited[0];
    assert.equal(settled, true);
    assert.equal(navigatorCalls.setCount, 1);
    assert.equal(calls.showNotification.length, 1);
  });
});
