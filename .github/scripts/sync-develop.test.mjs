import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncDevelop } from './sync-develop.mjs';

const sha = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const newer = 'c'.repeat(40);
const ref = sha => ({ object: { sha } });

function fixture(responses) {
  const calls = [];
  return {
    calls,
    options: {
      repository: 'owner/repository', sha, token: 'test-token', log: () => {},
      request: async (url, options) => {
        calls.push({ url, ...options });
        const response = responses.shift();
        assert.ok(response, 'Unexpected GitHub request');
        return { ok: !response.error, status: response.error ?? 200, json: async () => response };
      },
    },
  };
}

test('fast-forwards validated main without forcing or changing main', async () => {
  const { calls, options } = fixture([ref(sha), ref(previous), { status: 'ahead' }, ref(sha), ref(sha)]);
  assert.equal(await syncDevelop(options), 'updated');
  assert.equal(calls.filter(call => call.method !== 'GET').length, 1);
  assert.equal(calls.at(-1).url, 'https://api.github.com/repos/owner/repository/git/refs/heads/develop');
  assert.deepEqual(JSON.parse(calls.at(-1).body), { sha, force: false });
});

test('does not write when develop already matches main', async () => {
  const { calls, options } = fixture([ref(sha), ref(sha)]);
  assert.equal(await syncDevelop(options), 'unchanged');
  assert.equal(calls.length, 2);
});

test('ignores a superseded workflow before reading develop', async () => {
  const { calls, options } = fixture([ref(newer)]);
  assert.equal(await syncDevelop(options), 'superseded');
  assert.equal(calls.length, 1);
});

test('does not write if main changes during synchronization', async () => {
  const { calls, options } = fixture([ref(sha), ref(previous), { status: 'ahead' }, ref(newer)]);
  assert.equal(await syncDevelop(options), 'superseded');
  assert.ok(calls.every(call => call.method === 'GET'));
});

for (const status of ['behind', 'diverged', 'identical']) {
  test(`preserves develop history when comparison is ${status}`, async () => {
    const { calls, options } = fixture([ref(sha), ref(previous), { status }]);
    await assert.rejects(syncDevelop(options), /history will not be overwritten/);
    assert.ok(calls.every(call => call.method === 'GET'));
  });
}

for (const error of [403, 422]) {
  test(`reports protected or conflicting updates (${error}) without a forced retry`, async () => {
    const { calls, options } = fixture([ref(sha), ref(previous), { status: 'ahead' }, ref(sha), { error }]);
    await assert.rejects(syncDevelop(options), new RegExp(`returned ${error}`));
    assert.equal(calls.filter(call => call.method === 'PATCH').length, 1);
    assert.equal(JSON.parse(calls.at(-1).body).force, false);
  });
}

test('does not recreate a missing develop branch', async () => {
  const { calls, options } = fixture([ref(sha), { error: 404 }]);
  await assert.rejects(syncDevelop(options), /returned 404/);
  assert.ok(calls.every(call => call.method === 'GET'));
});

test('fails closed on missing credentials or invalid input', async () => {
  const { calls, options } = fixture([]);
  for (const override of [{ token: '' }, { sha: 'main' }, { repository: '../../another/repo' }]) {
    await assert.rejects(syncDevelop({ ...options, ...override }), /are required/);
  }
  assert.equal(calls.length, 0);
});
