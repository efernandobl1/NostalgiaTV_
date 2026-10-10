import { pathToFileURL } from 'node:url';

export function isEligible(pull, repository) {
  return pull.state === 'open' && !pull.draft &&
    pull.user?.login === 'dependabot[bot]' &&
    pull.head?.repo?.full_name === repository &&
    pull.base?.repo?.full_name === repository &&
    pull.base.ref === 'main';
}

export async function reconcile(api, repository, log = console.log) {
  const main = await api(`/repos/${repository}/branches/main`);
  const pulls = await api(`/repos/${repository}/pulls?state=open&base=main&per_page=100`, null, true);
  for (const pull of pulls.filter(item => isEligible(item, repository))) {
    const prefix = `/repos/${repository}`;
    // PR base.sha is the current branch tip, not the commit it originally forked from.
    const comparison = await api(`${prefix}/compare/${main.commit.sha}...${pull.head.sha}`);
    if (!comparison.merge_base_commit?.sha || comparison.merge_base_commit.sha === main.commit.sha) continue;
    const commits = await api(`${prefix}/pulls/${pull.number}/commits?per_page=100`, null, true);
    // Do not rebase PRs edited by a person or with unverified commits.
    if (!commits.length || commits.some(commit =>
      commit.author?.login !== 'dependabot[bot]' || !commit.commit?.verification?.verified)) continue;

    const marker = `<!-- dependabot-cleanup:${main.commit.sha} -->`;
    const comments = await api(`${prefix}/issues/${pull.number}/comments?per_page=100`, null, true);
    if (comments.some(comment => comment.user?.login === 'github-actions[bot]' &&
      comment.body?.includes(marker))) continue;

    // Dependabot checks actual manifests, versions, folders and grouped updates.
    // It closes only updates already covered by main; otherwise it rebases them.
    await api(`${prefix}/issues/${pull.number}/comments`, {
      body: `@dependabot rebase\n\nRecheck this update against main; close it only if it is no longer needed.\n${marker}`,
    });
    log(`Requested an obsolete-update check for PR #${pull.number}.`);
  }
}

async function githubApi(path, body, paginate = false) {
  const response = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`GitHub API returned ${response.status} for ${path}`);
  const result = await response.json();
  if (paginate && /rel="next"/.test(response.headers.get('link') || '')) {
    const page = Number(new URL(path, 'https://api.github.com').searchParams.get('page') || 1);
    const next = new URL(path, 'https://api.github.com');
    next.searchParams.set('page', String(page + 1));
    result.push(...await githubApi(`${next.pathname}${next.search}`, null, true));
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(process.env.GITHUB_REPOSITORY || '')) {
    throw new Error('A GitHub token and repository are required.');
  }
  await reconcile(githubApi, process.env.GITHUB_REPOSITORY);
}
