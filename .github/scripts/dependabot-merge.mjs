import { pathToFileURL } from 'node:url';
import { isEligible } from './dependabot-cleanup.mjs';
import { githubApi } from './github-api.mjs';

/** Applied by dependabot-auto-merge.yml to updates allowed to merge without review. */
export const LABEL = 'automerge';
const MERGEABLE = new Set(['clean', 'has_hooks']);

export const isLabeled = pull => pull.labels?.some(label => label.name === LABEL) ?? false;

/** Only untouched Dependabot history: every commit authored by Dependabot and signature-verified. */
export function isTrustedHistory(commits) {
  return commits.length > 0 && commits.every(commit =>
    commit.author?.login === 'dependabot[bot]' && commit.commit?.verification?.verified === true);
}

async function requestRebase(api, prefix, number, mainSha, log) {
  const marker = `<!-- dependabot-merge:${mainSha} -->`;
  const comments = await api(`${prefix}/issues/${number}/comments?per_page=100`, null, true);
  if (comments.some(comment => comment.body?.includes(marker))) return;
  await api(`${prefix}/issues/${number}/comments`, {
    body: `@dependabot rebase\n\nBring this update up to date with main so it can merge automatically.\n${marker}`,
  });
  log(`Requested a rebase of PR #${number}.`);
}

/**
 * Called after CI succeeds for a commit: merges the labeled Dependabot PR whose head is that commit.
 * `dispatchDeploy` runs the post-merge pipeline when the merge was made with GITHUB_TOKEN,
 * because such merges do not trigger push workflows.
 */
export async function mergeAfterCi(api, repository, headSha, {
  dispatchDeploy = false, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log,
} = {}) {
  const prefix = `/repos/${repository}`;
  const pulls = await api(`${prefix}/commits/${headSha}/pulls`);
  const pull = pulls.find(item => item.head?.sha === headSha && isEligible(item, repository) && isLabeled(item));
  if (!pull) { log('No auto-mergeable Dependabot PR for this commit.'); return 'skipped'; }

  const commits = await api(`${prefix}/pulls/${pull.number}/commits?per_page=100`, null, true);
  if (!isTrustedHistory(commits)) { log(`PR #${pull.number} has commits not made by Dependabot; leaving it for review.`); return 'untrusted'; }

  // GitHub computes mergeability asynchronously; give it a moment after the checks finish.
  let detail;
  for (let attempt = 0; attempt < 6; attempt++) {
    detail = await api(`${prefix}/pulls/${pull.number}`);
    if (detail.mergeable_state && detail.mergeable_state !== 'unknown') break;
    await wait(5000);
  }
  if (detail.head?.sha !== headSha) { log(`PR #${pull.number} moved on; a newer CI run will handle it.`); return 'outdated'; }
  const main = await api(`${prefix}/branches/main`);
  if (detail.mergeable_state === 'behind') {
    await requestRebase(api, prefix, pull.number, main.commit.sha, log);
    return 'rebase-requested';
  }
  if (!MERGEABLE.has(detail.mergeable_state)) {
    log(`PR #${pull.number} is ${detail.mergeable_state}; other checks are still pending or failing.`);
    return 'blocked';
  }

  let merged;
  try {
    merged = await api(`${prefix}/pulls/${pull.number}/merge`, { merge_method: 'merge', sha: headSha }, false, 'PUT');
  } catch (error) {
    // Another update merged first (strict protection): bring this one up to date instead.
    if (error.status === 405 && !/workflow/i.test(error.message)) {
      await requestRebase(api, prefix, pull.number, main.commit.sha, log);
      return 'rebase-requested';
    }
    // GITHUB_TOKEN may not change workflow files; tell the owner once instead of failing silently.
    if (!/workflow/i.test(error.message)) throw error;
    const marker = '<!-- dependabot-merge:workflows -->';
    const comments = await api(`${prefix}/issues/${pull.number}/comments?per_page=100`, null, true);
    if (!comments.some(comment => comment.body?.includes(marker))) {
      await api(`${prefix}/issues/${pull.number}/comments`, {
        body: `This update changes workflow files, which the default token cannot merge. Merge it manually or add the \`AUTOMATION_TOKEN\` secret.\n${marker}`,
      });
    }
    log(`PR #${pull.number} changes workflows and needs AUTOMATION_TOKEN or a manual merge.`);
    return 'needs-token';
  }
  log(`Merged PR #${pull.number}.`);
  if (dispatchDeploy) {
    await api(`${prefix}/actions/workflows/deploy.yml/dispatches`, { ref: 'main' });
    log('Started the post-merge pipeline on main.');
  }

  // Strict branch protection: bring the next pending update up to date, one at a time.
  const open = await api(`${prefix}/pulls?state=open&base=main&sort=created&direction=asc&per_page=100`, null, true);
  const next = open.find(item => item.number !== pull.number && isEligible(item, repository) && isLabeled(item));
  if (next) await requestRebase(api, prefix, next.number, merged?.sha ?? headSha, log);
  return 'merged';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { GITHUB_REPOSITORY: repository = '', HEAD_SHA: sha = '', GH_TOKEN, DISPATCH_DEPLOY } = process.env;
  if (!GH_TOKEN || !/^[\w.-]+\/[\w.-]+$/.test(repository) || !/^[0-9a-f]{40}$/.test(sha)) {
    throw new Error('A GitHub token, repository and full head SHA are required.');
  }
  await mergeAfterCi(githubApi, repository, sha, { dispatchDeploy: DISPATCH_DEPLOY === 'true' });
}
