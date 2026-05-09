const GITHUB_API = 'https://api.github.com';

function ghHeaders() {
  const h = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'urcooked.lol',
  };
  if (process.env.GITHUB_TOKEN) {
    h['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function ghFetch(url) {
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) {
    const err = new Error('not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (res.status === 403 || res.status === 429) {
    const err = new Error('github rate limited');
    err.code = 'RATE_LIMITED';
    throw err;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`github ${res.status}: ${body.slice(0, 200)}`);
    err.code = 'GITHUB_ERROR';
    throw err;
  }
  return res.json();
}

/**
 * Find the longest gap (in days) between any two consecutive pushes
 * across the user's repos. Sort all push timestamps, walk pairs, max diff.
 */
function longestGapDays(repos) {
  const pushes = repos
    .map((r) => r.pushed_at && new Date(r.pushed_at).getTime())
    .filter(Boolean)
    .sort((a, b) => a - b);
  if (pushes.length < 2) return 0;
  let max = 0;
  for (let i = 1; i < pushes.length; i++) {
    const gap = pushes[i] - pushes[i - 1];
    if (gap > max) max = gap;
  }
  return Math.floor(max / (1000 * 60 * 60 * 24));
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function yearsSince(iso) {
  if (!iso) return 0;
  return ((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);
}

const CRINGE_REPO_PATTERNS = [
  /^test\d*$/i,
  /^hello-?world$/i,
  /^todo-?app$/i,
  /^my-?portfolio$/i,
  /^new-?repo/i,
  /^untitled/i,
  /^learning-/i,
  /^learn-/i,
  /tutorial$/i,
  /^practice/i,
  /-clone$/i,
  /^my-first/i,
];

function flagCringeRepos(repos) {
  return repos
    .filter((r) => CRINGE_REPO_PATTERNS.some((re) => re.test(r.name)))
    .map((r) => r.name);
}

export function computeCookedScore(githubData) {
  let score = 0;
  score += Math.min(30, Math.floor((githubData.days_since_last_push ?? 0) / 12));
  score += Math.min(20, githubData.cringe_repo_names.length * 4);
  if (githubData.public_repos > 0) {
    score += Math.floor((githubData.fork_count / githubData.public_repos) * 15);
    score += Math.floor((githubData.repos_with_no_description / githubData.public_repos) * 15);
  }
  score += Math.min(10, Math.floor(githubData.longest_gap_between_pushes_days / 36));
  if (githubData.follower_ratio !== null && githubData.follower_ratio < 0.5) {
    score += Math.min(10, Math.floor((0.5 - githubData.follower_ratio) * 20));
  }
  return Math.min(100, score);
}

/**
 * Fetch GitHub data and reduce it down to a structured payload for the prompt.
 * Returns null-ish things rather than failing on optional fields.
 */
export async function fetchGithubProfile(username) {
  const [profile, repos] = await Promise.all([
    ghFetch(`${GITHUB_API}/users/${encodeURIComponent(username)}`),
    ghFetch(`${GITHUB_API}/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100&type=owner`),
  ]);

  // Aggregate from repos
  const totalStars = repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const totalForks = repos.reduce((sum, r) => sum + (r.forks_count || 0), 0);

  const langCounts = {};
  for (const r of repos) {
    if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1;
  }
  const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0];

  const reposNoDescription = repos.filter((r) => !r.description || !r.description.trim()).length;
  const cringeRepos = flagCringeRepos(repos);
  const forkCount = repos.filter((r) => r.fork).length;
  const archivedCount = repos.filter((r) => r.archived).length;

  // Top repos by stars (filtered out forks since stars on forks barely count)
  const topRepos = repos
    .filter((r) => !r.fork)
    .sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0))
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      stars: r.stargazers_count,
      language: r.language,
      description: r.description,
    }));

  // Recent repos by push date
  const recentRepos = repos
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      stars: r.stargazers_count,
      language: r.language,
      pushed_at: r.pushed_at,
      days_since_push: daysSince(r.pushed_at),
    }));

  return {
    username: profile.login,
    name: profile.name,
    bio: profile.bio,
    company: profile.company,
    location: profile.location,
    blog: profile.blog,
    twitter: profile.twitter_username,
    has_bio: Boolean(profile.bio && profile.bio.trim()),
    followers: profile.followers,
    following: profile.following,
    follower_ratio: profile.following > 0
      ? +(profile.followers / profile.following).toFixed(2)
      : null,
    public_repos: profile.public_repos,
    public_gists: profile.public_gists,
    account_age_years: +yearsSince(profile.created_at),
    days_since_account_created: daysSince(profile.created_at),
    total_stars: totalStars,
    total_forks: totalForks,
    top_language: topLang ? topLang[0] : null,
    top_language_repo_count: topLang ? topLang[1] : 0,
    repos_with_no_description: reposNoDescription,
    fork_count: forkCount,
    archived_count: archivedCount,
    cringe_repo_names: cringeRepos,
    longest_gap_between_pushes_days: longestGapDays(repos),
    days_since_last_push: recentRepos[0]?.days_since_push ?? null,
    top_repos: topRepos,
    recent_repos: recentRepos,
    all_repo_names: repos.slice(0, 20).map((r) => r.name),
    avatar_url: profile.avatar_url,
    html_url: profile.html_url,
  };
}
