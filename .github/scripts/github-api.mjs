/** Minimal GitHub REST client shared by the automation scripts (token from GH_TOKEN). */
export async function githubApi(path, body = null, paginate = false, method = body ? 'POST' : 'GET') {
  const response = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const error = new Error(`GitHub API returned ${response.status} for ${path}: ${await response.text()}`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const result = await response.json();
  if (paginate && /rel="next"/.test(response.headers.get('link') || '')) {
    const page = Number(new URL(path, 'https://api.github.com').searchParams.get('page') || 1);
    const next = new URL(path, 'https://api.github.com');
    next.searchParams.set('page', String(page + 1));
    result.push(...await githubApi(`${next.pathname}${next.search}`, null, true));
  }
  return result;
}
