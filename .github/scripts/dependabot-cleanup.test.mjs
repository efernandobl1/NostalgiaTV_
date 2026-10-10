import test from 'node:test';
import assert from 'node:assert/strict';
import { isEligible, reconcile } from './dependabot-cleanup.mjs';

const repository = 'owner/project';
const pull = {
  number: 1, state: 'open', draft: false, user: { login: 'dependabot[bot]' },
  head: { sha: 'head', repo: { full_name: repository } },
  base: { ref: 'main', sha: 'new', repo: { full_name: repository } },
};
const signedCommit = {
  author: { login: 'dependabot[bot]' }, commit: { verification: { verified: true } },
};

test('selects an untouched Dependabot PR against an older main', () => {
  assert.equal(isEligible(pull, repository), true);
});

for (const [name, change] of [
  ['human author', { user: { login: 'someone' } }],
  ['fork', { head: { repo: { full_name: 'other/project' } } }],
  ['another base', { base: { ...pull.base, ref: 'develop' } }],
  ['draft', { draft: true }],
  ['closed PR', { state: 'closed' }],
]) {
  test(`ignores ${name}`, () => assert.equal(isEligible({ ...pull, ...change }, repository), false));
}

async function requestsFor(commits = [signedCommit], comments = [], mergeBase = 'old') {
  const writes = [];
  const api = async (path, body) => {
    if (body) { writes.push({ path, body }); return {}; }
    if (path.endsWith('/branches/main')) return { commit: { sha: 'new' } };
    if (path.includes('/pulls?')) return [pull];
    if (path.includes('/compare/')) return { merge_base_commit: { sha: mergeBase } };
    if (path.includes('/commits?')) return commits;
    if (path.includes('/comments?')) return comments;
    throw new Error(`Unexpected request: ${path}`);
  };
  await reconcile(api, repository, () => {});
  return writes;
}

test('delegates version and grouped-update checks to Dependabot without closing PRs itself', async () => {
  const writes = await requestsFor();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/repos/owner/project/issues/1/comments');
  assert.match(writes[0].body.body, /^@dependabot rebase\n/);
});

test('does not repeat a check for the same main commit', async () => {
  assert.deepEqual(await requestsFor([signedCommit], [{
    user: { login: 'github-actions[bot]' }, body: '<!-- dependabot-cleanup:new -->',
  }]), []);
});

test('uses the merge base instead of the current PR base tip to detect stale branches', async () => {
  assert.equal((await requestsFor()).length, 1);
  assert.deepEqual(await requestsFor([signedCommit], [], 'new'), []);
  assert.deepEqual(await requestsFor([signedCommit], [], null), []);
});

test('does not trust a duplicate marker posted by another user', async () => {
  assert.equal((await requestsFor([signedCommit], [{
    user: { login: 'someone' }, body: '<!-- dependabot-cleanup:new -->',
  }])).length, 1);
});

test('preserves PRs with human edits, unsigned commits, or no commits', async () => {
  for (const commits of [[], [{ ...signedCommit, author: { login: 'someone' } }], [{
    ...signedCommit, commit: { verification: { verified: false } },
  }]]) assert.deepEqual(await requestsFor(commits), []);
});
