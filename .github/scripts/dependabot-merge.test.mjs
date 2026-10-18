import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrustedHistory, mergeAfterCi } from './dependabot-merge.mjs';

const repository = 'owner/project';
const sha = 'a'.repeat(40);
const pull = (number, extra = {}) => ({
  number, state: 'open', draft: false, user: { login: 'dependabot[bot]' }, labels: [{ name: 'automerge' }],
  head: { sha, repo: { full_name: repository } }, base: { ref: 'main', repo: { full_name: repository } }, ...extra,
});
const signed = { author: { login: 'dependabot[bot]' }, commit: { verification: { verified: true } } };

function fakeApi({ pulls = [pull(1)], commits = [signed], state = 'clean', open = [pull(1)], comments = [], mergeError } = {}) {
  const calls = [];
  const api = async (path, body, _paginate, method) => {
    calls.push({ path, body, method });
    if (path.endsWith(`/commits/${sha}/pulls`)) return pulls;
    if (path.includes('/pulls/1/commits')) return commits;
    if (path.endsWith('/pulls/1')) return { head: { sha }, mergeable_state: state };
    if (path.endsWith('/branches/main')) return { commit: { sha: 'main' } };
    if (path.endsWith('/merge')) {
      if (mergeError) throw Object.assign(new Error(mergeError), { status: mergeError.includes('workflow') ? 403 : 405 });
      return { sha: 'merge' };
    }
    if (path.includes('/pulls?state=open')) return open;
    if (path.includes('/comments?')) return comments;
    if (body) return null;
    throw new Error(`Unexpected request: ${path}`);
  };
  return { api, calls };
}
const run = (api, options = {}) => mergeAfterCi(api, repository, sha, { wait: async () => {}, log: () => {}, ...options });

test('trusts only untouched, signed Dependabot history', () => {
  assert.equal(isTrustedHistory([signed]), true);
  assert.equal(isTrustedHistory([]), false);
  assert.equal(isTrustedHistory([signed, { ...signed, author: { login: 'someone' } }]), false);
  assert.equal(isTrustedHistory([{ ...signed, commit: { verification: { verified: false } } }]), false);
});

test('merges a clean labeled update, starts the pipeline and nudges the next one', async () => {
  const { api, calls } = fakeApi({ open: [pull(1), pull(2)] });
  assert.equal(await run(api, { dispatchDeploy: true }), 'merged');
  assert.deepEqual(calls.find(c => c.path.endsWith('/merge')).body, { merge_method: 'merge', sha });
  assert.ok(calls.some(c => c.path.endsWith('/deploy.yml/dispatches') && c.body.ref === 'main'));
  assert.match(calls.find(c => c.path.endsWith('/issues/2/comments')).body.body, /@dependabot rebase/);
});

test('does not dispatch when a personal token merged (push triggers CI)', async () => {
  const { api, calls } = fakeApi();
  await run(api);
  assert.ok(!calls.some(c => c.path.includes('/dispatches')));
});

for (const [name, options, expected] of [
  ['unlabeled PR', { pulls: [pull(1, { labels: [] })] }, 'skipped'],
  ['human-authored PR', { pulls: [pull(1, { user: { login: 'someone' } })] }, 'skipped'],
  ['edited history', { commits: [signed, { author: { login: 'someone' }, commit: { verification: { verified: true } } }] }, 'untrusted'],
  ['pending checks', { state: 'blocked' }, 'blocked'],
  ['failing optional checks', { state: 'unstable' }, 'blocked'],
]) {
  test(`never merges: ${name}`, async () => {
    const { api, calls } = fakeApi(options);
    assert.equal(await run(api), expected);
    assert.ok(!calls.some(c => c.path.endsWith('/merge')));
  });
}

test('asks Dependabot to rebase an outdated update only once per main commit', async () => {
  const first = fakeApi({ state: 'behind' });
  assert.equal(await run(first.api), 'rebase-requested');
  assert.equal(first.calls.filter(c => c.path.endsWith('/issues/1/comments')).length, 1);
  const again = fakeApi({ state: 'behind', comments: [{ body: '<!-- dependabot-merge:main -->' }] });
  await run(again.api);
  assert.ok(!again.calls.some(c => c.path.endsWith('/issues/1/comments')));
});

test('explains workflow-file updates that need a stronger token', async () => {
  const { api, calls } = fakeApi({ mergeError: 'refusing to allow a GitHub App to create or update workflow' });
  assert.equal(await run(api), 'needs-token');
  assert.match(calls.find(c => c.path.endsWith('/issues/1/comments')).body.body, /AUTOMATION_TOKEN/);
});

test('requests a rebase when another update merged first', async () => {
  const { api, calls } = fakeApi({ mergeError: 'Head branch was modified' });
  assert.equal(await run(api), 'rebase-requested');
  assert.match(calls.find(c => c.path.endsWith('/issues/1/comments')).body.body, /@dependabot rebase/);
});
