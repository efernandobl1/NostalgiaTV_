import { pathToFileURL } from 'node:url';

export async function syncDevelop({ repository, sha, token, request = fetch, log = console.log }) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '') || !/^[a-f0-9]{40}$/.test(sha ?? '') || !token) {
    throw new Error('A repository, full commit SHA and GitHub token are required.');
  }

  async function api(path, body) {
    const response = await request(`https://api.github.com/repos/${repository}/${path}`, {
      method: body ? 'PATCH' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`GitHub ${path} returned ${response.status}. Check branch protection and token permissions; no forced update was attempted.`);
    }
    return response.json();
  }

  const main = await api('git/ref/heads/main');
  if (main.object.sha !== sha) {
    log('A newer main commit exists; its workflow will synchronize develop.');
    return 'superseded';
  }

  const develop = await api('git/ref/heads/develop');
  if (develop.object.sha === sha) {
    log('develop already matches main.');
    return 'unchanged';
  }

  const comparison = await api(`compare/${develop.object.sha}...${sha}`);
  if (comparison.status !== 'ahead') {
    throw new Error('develop contains commits outside main. Reconcile them before retrying; its history will not be overwritten.');
  }

  // Check again immediately before writing; older runs must not chase newer main commits.
  const latestMain = await api('git/ref/heads/main');
  if (latestMain.object.sha !== sha) {
    log('main changed during synchronization; the newer workflow will handle it.');
    return 'superseded';
  }

  await api('git/refs/heads/develop', { sha, force: false });
  log(`develop fast-forwarded to ${sha}.`);
  return 'updated';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  syncDevelop({
    repository: process.env.GITHUB_REPOSITORY,
    sha: process.env.GITHUB_SHA,
    token: process.env.GITHUB_TOKEN,
  }).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
