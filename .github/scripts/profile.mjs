// Genera le card SVG del profilo (statistiche, linguaggi, attività) e aggiorna
// la lista dei repository pubblici nel README.
// Gira ogni giorno nella GitHub Action .github/workflows/profile.yml:
// nessun servizio esterno da cui dipendere, nessuna dipendenza npm (Node >= 20).
//
// Variabili d'ambiente:
//   GITHUB_TOKEN  token per l'API GraphQL di GitHub (in Actions: secrets.GITHUB_TOKEN)
//   GH_LOGIN      utente GitHub (default: proprietario del repository)
//   OUT_DIR       cartella in cui scrivere gli SVG (default: dist)
//   README_PATH   README da aggiornare (default: README.md)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LOGIN = process.env.GH_LOGIN || process.env.GITHUB_REPOSITORY_OWNER;
const TOKEN = process.env.GITHUB_TOKEN;
const OUT_DIR = process.env.OUT_DIR || 'dist';
const README_PATH = process.env.README_PATH || 'README.md';

const ACTIVITY_WEEKS = 52; // finestra del grafico attività
const TOP_LANGUAGES = 6;
const REPOS_START = '<!-- REPOS:START -->';
const REPOS_END = '<!-- REPOS:END -->';

const THEMES = {
  dark: {
    bg: '#0d1117', border: '#30363d', grid: '#21262d', text: '#e6edf3', muted: '#8b949e',
    accent: ['#7aa2f7', '#bb9af7'], fire: '#ff9e64', green: '#9ece6a', other: '#6e7681',
  },
  light: {
    bg: '#ffffff', border: '#d0d7de', grid: '#eaeef2', text: '#1f2328', muted: '#59636e',
    accent: ['#0969da', '#8250df'], fire: '#bc4c00', green: '#1a7f37', other: '#8c959f',
  },
};

const FONT = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif`;
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

// Octicons (MIT) — https://primer.style/octicons
const ICONS = {
  commit: 'M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z',
  flame: 'M9.533.753V.752c.217 2.385 1.463 3.626 2.653 4.81C13.37 6.74 14.498 7.863 14.498 10c0 3.5-3 6-6.5 6S1.5 13.512 1.5 10c0-1.298.536-2.56 1.425-3.286.376-.308.862 0 1.035.454C4.46 8.487 5.581 8.419 6 8c.282-.282.341-.811-.003-1.5C4.34 3.187 7.035.75 8.77.146c.39-.137.726.194.763.607ZM7.998 14.5c2.832 0 5-1.98 5-4.5 0-1.463-.68-2.19-1.879-3.383l-.036-.037c-1.013-1.008-2.3-2.29-2.834-4.434-.322.256-.63.579-.864.953-.432.696-.621 1.58-.046 2.73.473.947.67 2.284-.278 3.232-.61.61-1.545.84-2.403.633a2.79 2.79 0 0 1-1.436-.874A3.198 3.198 0 0 0 3 10c0 2.53 2.164 4.5 4.998 4.5Z',
  trophy: 'M3.217 6.962A3.75 3.75 0 0 1 0 3.25v-.5C0 1.784.784 1 1.75 1h1.356c.228-.585.796-1 1.462-1h6.864c.647 0 1.227.397 1.462 1h1.356c.966 0 1.75.784 1.75 1.75v.5a3.75 3.75 0 0 1-3.217 3.712 5.014 5.014 0 0 1-2.771 3.117l.144 1.446c.005.05.03.12.114.204.086.087.217.17.373.227.283.103.618.274.89.568.285.31.467.723.467 1.226v.75h1.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H4v-.75c0-.503.182-.916.468-1.226.27-.294.606-.465.889-.568.139-.048.266-.126.373-.227.084-.085.109-.153.114-.204l.144-1.446a5.015 5.015 0 0 1-2.77-3.117ZM4.5 1.568V5.5a3.5 3.5 0 1 0 7 0V1.568a.068.068 0 0 0-.068-.068H4.568a.068.068 0 0 0-.068.068Zm2.957 8.902-.12 1.204c-.093.925-.858 1.47-1.467 1.691a.766.766 0 0 0-.3.176c-.037.04-.07.093-.07.21v.75h5v-.75c0-.117-.033-.17-.07-.21a.766.766 0 0 0-.3-.176c-.609-.221-1.374-.766-1.466-1.69l-.12-1.204a5.064 5.064 0 0 1-1.087 0ZM13 2.5v2.872a2.25 2.25 0 0 0 1.5-2.122v-.5a.25.25 0 0 0-.25-.25H13Zm-10 0H1.75a.25.25 0 0 0-.25.25v.5c0 .98.626 1.813 1.5 2.122Z',
  repo: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z',
  star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z',
  people: 'M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z',
  calendar: 'M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 7.5v6.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V7.5Zm10.75-4H2.75a.25.25 0 0 0-.25.25V6h11V3.75a.25.25 0 0 0-.25-.25Z',
};

// ---------------------------------------------------------------- API GitHub

const PROFILE_QUERY = `
query ($login: String!, $after: String) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    repositories(first: 100, after: $after, ownerAffiliations: OWNER, privacy: PUBLIC,
                 isFork: false, orderBy: { field: PUSHED_AT, direction: DESC }) {
      pageInfo { hasNextPage endCursor }
      nodes {
        name
        url
        description
        homepageUrl
        stargazerCount
        isArchived
        pushedAt
        primaryLanguage { name }
        languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name color } }
        }
      }
    }
  }
}`;

const CALENDAR_QUERY = `
query ($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      contributionCalendar {
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': `${LOGIN}-profile-readme`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join('\n'));
  return json.data;
}

async function fetchProfile() {
  const repos = [];
  let user;
  let after = null;
  do {
    ({ user } = await gql(PROFILE_QUERY, { login: LOGIN, after }));
    if (!user) throw new Error(`Utente "${LOGIN}" non trovato`);
    repos.push(...user.repositories.nodes);
    const { hasNextPage, endCursor } = user.repositories.pageInfo;
    after = hasNextPage ? endCursor : null;
  } while (after);
  // Fuori dalla lista il repository del profilo (questo) e quello di servizio .github.
  const hidden = new Set([LOGIN.toLowerCase(), '.github']);
  return { user, repos: repos.filter((r) => !hidden.has(r.name.toLowerCase())) };
}

// L'API restituisce al massimo un anno per richiesta: un anno solare alla volta
// dalla creazione dell'account a oggi.
async function fetchContributions(createdAt) {
  const now = Date.now();
  const created = Date.parse(createdAt);
  const counts = new Map();
  for (let y = new Date(created).getUTCFullYear(); y <= new Date(now).getUTCFullYear(); y++) {
    const from = new Date(Math.max(Date.UTC(y, 0, 1), created)).toISOString();
    const to = new Date(Math.min(Date.UTC(y + 1, 0, 1) - 1000, now)).toISOString();
    const { user } = await gql(CALENDAR_QUERY, { login: LOGIN, from, to });
    for (const week of user.contributionsCollection.contributionCalendar.weeks) {
      for (const { date, contributionCount } of week.contributionDays) {
        counts.set(date, Math.max(counts.get(date) ?? 0, contributionCount));
      }
    }
  }
  const today = new Date(now).toISOString().slice(0, 10);
  return [...counts]
    .filter(([date]) => date <= today)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));
}

// ------------------------------------------------------------------ calcoli

function computeStreaks(days) {
  let longest = { length: 0 };
  let run = { length: 0 };
  for (const { date, count } of days) {
    run = count > 0 ? { start: run.length ? run.start : date, end: date, length: run.length + 1 } : { length: 0 };
    if (run.length > longest.length) longest = run;
  }
  // La streak di oggi non si interrompe finché la giornata non è finita.
  let i = days.length - 1;
  if (days[i]?.count === 0) i--;
  const current = { length: 0 };
  for (; i >= 0 && days[i].count > 0; i--) {
    current.end ??= days[i].date;
    current.start = days[i].date;
    current.length++;
  }
  return { current, longest };
}

function computeLanguages(repos) {
  const bytes = new Map();
  for (const repo of repos) {
    for (const { size, node } of repo.languages.edges) {
      const entry = bytes.get(node.name) ?? { name: node.name, color: node.color, size: 0 };
      entry.size += size;
      bytes.set(node.name, entry);
    }
  }
  const sorted = [...bytes.values()].sort((a, b) => b.size - a.size);
  const total = sorted.reduce((sum, l) => sum + l.size, 0);
  if (!total) return [];
  const top = sorted.length > TOP_LANGUAGES ? sorted.slice(0, TOP_LANGUAGES - 1) : sorted;
  const rest = sorted.slice(top.length).reduce((sum, l) => sum + l.size, 0);
  if (rest) top.push({ name: 'Altro · Other', color: null, size: rest });
  return top.map((l) => ({ ...l, share: l.size / total }));
}

// Somme su finestre mobili di 7 giorni: l'ultima termina oggi.
function weeklyActivity(days, weeks) {
  const recent = days.slice(-weeks * 7);
  const buckets = [];
  for (let end = recent.length; end > 0; end -= 7) {
    const slice = recent.slice(Math.max(0, end - 7), end);
    buckets.unshift({ start: slice[0].date, end: slice.at(-1).date, count: slice.reduce((s, d) => s + d.count, 0) });
  }
  return buckets;
}

// ------------------------------------------------------------ formattazione

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
const round = (n) => Math.round(n * 10) / 10;

function fmtDate(iso, withYear = false) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

function fmtRange({ start, end, length }, none) {
  if (!length) return none;
  const thisYear = String(new Date().getUTCFullYear());
  const withYear = !end.startsWith(thisYear);
  if (start === end) return fmtDate(end, withYear);
  return `${fmtDate(start, withYear && start.slice(0, 4) !== end.slice(0, 4))} – ${fmtDate(end, withYear)}`;
}

// ---------------------------------------------------------------- card SVG

// Stringe il testo (textLength) solo se la larghezza stimata supera lo spazio disponibile.
const fit = (text, fontSize, max) => (Array.from(text).length * fontSize * 0.56 > max ? ` textLength="${max}" lengthAdjust="spacingAndGlyphs"` : '');

const icon = (name, x, y, color, size = 14) =>
  `<path transform="translate(${x} ${y}) scale(${size / 16})" fill="${color}" d="${ICONS[name]}"/>`;

function svg({ width, height, title, theme: t, defs = '', css = '', body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${t.accent[0]}"/><stop offset="1" stop-color="${t.accent[1]}"/>
  </linearGradient>${defs}
</defs>
<style>
  text { font-family: ${FONT}; fill: ${t.text}; }
  .title { font-size: 11px; font-weight: 600; letter-spacing: .08em; fill: ${t.muted}; }
  .muted { fill: ${t.muted}; }
  .num { font-variant-numeric: tabular-nums; }
  .accent { fill: url(#accent); }
  .fade { animation: fade .7s ease-out both; }
  @keyframes fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }${css}
</style>
<rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>
${body}
</svg>
`;
}

function statsCard(s, t) {
  const hero = [
    { x: 22, icon: 'commit', color: t.accent[0], label: 'Contributi', value: s.total, sub: `totali dal ${s.since}` },
    { x: 150, icon: 'flame', color: t.fire, label: 'Streak attuale', value: s.current.length, unit: true, sub: fmtRange(s.current, 'nessuna in corso') },
    { x: 280, icon: 'trophy', color: t.accent[1], label: 'Streak record', value: s.longest.length, unit: true, sub: fmtRange(s.longest, '—') },
  ];
  const colWidth = (i) => (hero[i + 1]?.x ?? 404) - hero[i].x - 8;
  const mini = [
    { x: 22, icon: 'repo', value: s.repos, label: 'repo' },
    { x: 112, icon: 'star', value: s.stars, label: s.stars === 1 ? 'stella' : 'stelle' },
    { x: 202, icon: 'people', value: s.followers, label: 'follower' },
    { x: 296, icon: 'calendar', value: s.thisYear, label: `nel ${s.year}` },
  ];
  const body = `
<text x="22" y="32" class="title">STATISTICHE · GITHUB STATS</text>
${hero.map((h, i) => `<g class="fade" style="animation-delay:${i * 120}ms">
  ${icon(h.icon, h.x, 51, h.color)}
  <text x="${h.x + 20}" y="62" class="muted" font-size="12.5">${h.label}</text>
  <text x="${h.x}" y="100" class="num accent" font-size="30" font-weight="700">${num(h.value)}${h.unit ? `<tspan class="muted" font-size="12" font-weight="400" dx="5">${h.value === 1 ? 'giorno' : 'giorni'}</tspan>` : ''}</text>
  <text x="${h.x}" y="121" class="muted" font-size="11"${fit(h.sub, 11, colWidth(i))}>${esc(h.sub)}</text>
</g>`).join('\n')}
<line x1="22" y1="143" x2="398" y2="143" stroke="${t.grid}" stroke-width="1"/>
${mini.map((m, i) => `<g class="fade" style="animation-delay:${360 + i * 80}ms">
  ${icon(m.icon, m.x, 162, t.muted)}
  <text x="${m.x + 20}" y="174" font-size="12.5"${fit(`${num(m.value)} ${m.label}`, 12.5, (mini[i + 1]?.x ?? 404) - m.x - 26)}><tspan class="num" font-weight="600">${num(m.value)}</tspan><tspan class="muted"> ${esc(m.label)}</tspan></text>
</g>`).join('\n')}`;
  return svg({ width: 420, height: 195, title: 'Statistiche GitHub · GitHub stats', theme: t, body });
}

function languagesCard(langs, t) {
  const barX = 22;
  const barW = 376;
  let x = barX;
  const segments = langs.map((l, i) => {
    const w = l.share * barW;
    const rect = `<rect x="${round(x)}" y="48" width="${round(Math.max(w - (i < langs.length - 1 ? 2 : 0), 0))}" height="10" fill="${l.color ?? t.other}"/>`;
    x += w;
    return rect;
  });
  const legend = langs.map((l, i) => {
    const colX = i % 2 ? 216 : 22;
    const colEnd = i % 2 ? 398 : 194;
    const y = 92 + Math.floor(i / 2) * 32;
    const pct = `${(l.share * 100).toFixed(1).replace('.', ',')}%`;
    return `<g class="fade" style="animation-delay:${i * 80}ms">
  <circle cx="${colX + 5}" cy="${y - 4}" r="5" fill="${l.color ?? t.other}"/>
  <text x="${colX + 18}" y="${y}" font-size="13">${esc(l.name)}</text>
  <text x="${colEnd}" y="${y}" class="num muted" font-size="12" text-anchor="end">${pct}</text>
</g>`;
  });
  const body = `
<text x="22" y="32" class="title">LINGUAGGI · TOP LANGUAGES</text>
${langs.length ? `<g clip-path="url(#bar)">${segments.join('')}</g>\n${legend.join('\n')}` : `<text x="22" y="100" class="muted" font-size="13">Nessun dato · No data yet</text>`}`;
  const defs = `\n  <clipPath id="bar"><rect x="${barX}" y="48" width="${barW}" height="10" rx="5"/></clipPath>`;
  return svg({ width: 420, height: 195, title: 'Linguaggi più usati · Top languages', theme: t, defs, body });
}

// Curva monotona (niente oscillazioni sotto lo zero) come cubiche di Bézier.
function smoothPath(pts) {
  const n = pts.length;
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const slope = [];
  for (let i = 0; i < n - 1; i++) slope.push((pts[i + 1].y - pts[i].y) / (pts[i + 1].x - pts[i].x));
  const tangent = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : 2 / (1 / slope[i - 1] + 1 / slope[i]));
  }
  tangent.push(slope[n - 2]);
  let d = `M${round(pts[0].x)},${round(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (pts[i + 1].x - pts[i].x) / 3;
    d += `C${round(pts[i].x + h)},${round(pts[i].y + h * tangent[i])} ${round(pts[i + 1].x - h)},${round(pts[i + 1].y - h * tangent[i + 1])} ${round(pts[i + 1].x)},${round(pts[i + 1].y)}`;
  }
  return d;
}

function niceMax(max) {
  if (max <= 4) return { top: 4, step: 1 };
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw && Number.isInteger(s));
  return { top: Math.ceil(max / step) * step, step };
}

function activityCard(buckets, t, updated) {
  const W = 850;
  const H = 300;
  const x0 = 56;
  const x1 = 822;
  const yTop = 106;
  const yBase = 252;
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const [max = 0, second = 0] = buckets.map((b) => b.count).sort((a, b) => b - a);
  // Un picco isolato (es. un import massivo) schiaccerebbe tutto il resto sullo zero:
  // in quel caso la scala segue il secondo valore e il picco esce dal grafico con la sua etichetta.
  const clipped = second > 0 && max > 3 * second;
  const { top, step } = niceMax(clipped ? second * 1.15 : max);
  const xAt = (i) => (buckets.length > 1 ? x0 + (i * (x1 - x0)) / (buckets.length - 1) : (x0 + x1) / 2);
  const yAt = (v) => yBase - (v / top) * (yBase - yTop);
  const pts = buckets.map((b, i) => ({ x: xAt(i), y: yAt(b.count) }));
  const line = smoothPath(pts);
  const area = `${line}L${round(pts.at(-1).x)},${yBase}L${round(pts[0].x)},${yBase}Z`;

  const grid = [];
  for (let v = 0; v <= top; v += step) {
    const y = round(yAt(v));
    grid.push(`<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${t.grid}" stroke-width="1"${v ? ' stroke-dasharray="3 4"' : ''}/>`);
    grid.push(`<text x="${x0 - 12}" y="${y + 4}" class="num muted" font-size="11" text-anchor="end">${num(v)}</text>`);
  }

  // Un'etichetta per ogni mese, sotto la settimana che ne contiene il primo giorno.
  const months = [];
  buckets.forEach((b, i) => {
    const [y, m] = b.end.split('-').map(Number);
    const monthChanged = i === 0 ? false : b.end.slice(0, 7) !== buckets[i - 1].end.slice(0, 7);
    if (!monthChanged) return;
    const label = m === 1 ? `${MONTHS[0]} ’${String(y).slice(2)}` : MONTHS[m - 1];
    months.push(`<text x="${round(xAt(i))}" y="${yBase + 22}" class="muted" font-size="11" text-anchor="middle">${label}</text>`);
  });

  const clipTop = yTop - 8;
  let peak = '';
  if (max > 0) {
    const i = buckets.findIndex((b) => b.count === max);
    const x = pts[i].x;
    const y = Math.max(pts[i].y, clipTop);
    const anchor = x > x1 - 60 ? 'end' : x < x0 + 60 ? 'start' : 'middle';
    peak = `<g class="fade" style="animation-delay:1.4s">
  <circle cx="${round(x)}" cy="${round(y)}" r="4" fill="${t.bg}" stroke="${t.accent[1]}" stroke-width="2"/>
  <text x="${round(x)}" y="${round(y) - 12}" font-size="11" text-anchor="${anchor}"><tspan class="muted">${clipped ? '↑ fuori scala · off scale ' : 'picco · peak '}</tspan><tspan class="num" font-weight="600">${num(max)}</tspan></text>
</g>`;
  }
  const last = pts.at(-1);

  const defs = `
  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${t.accent[1]}" stop-opacity=".35"/><stop offset="1" stop-color="${t.accent[0]}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="stroke" gradientUnits="userSpaceOnUse" x1="${x0}" y1="0" x2="${x1}" y2="0">
    <stop offset="0" stop-color="${t.accent[0]}"/><stop offset="1" stop-color="${t.accent[1]}"/>
  </linearGradient>
  <clipPath id="plot"><rect x="0" y="${clipTop}" width="${W}" height="${yBase - clipTop + 4}"/></clipPath>`;
  const css = `
  .line { animation: draw 1.6s ease-out both; }
  @keyframes draw { from { stroke-dasharray: 1; stroke-dashoffset: 1; } to { stroke-dasharray: 1; stroke-dashoffset: 0; } }
  .pulse { transform-origin: ${round(last.x)}px ${round(last.y)}px; animation: pulse 2s ease-out 1.6s infinite; opacity: 0; }
  @keyframes pulse { from { transform: scale(1); opacity: .6; } to { transform: scale(3.2); opacity: 0; } }`;
  const body = `
<text x="24" y="38" font-size="17" font-weight="600">Attività su GitHub · Contribution activity</text>
<text x="24" y="60" class="muted" font-size="12">Contributi a settimana, ultimi 12 mesi · weekly, last 12 months</text>
<text x="${W - 28}" y="40" class="num accent" font-size="24" font-weight="700" text-anchor="end">${num(total)}</text>
<text x="${W - 28}" y="60" class="muted" font-size="12" text-anchor="end">contributi · contributions</text>
${grid.join('\n')}
${months.join('\n')}
<g clip-path="url(#plot)">
  <path d="${area}" fill="url(#fill)" class="fade" style="animation-delay:.6s"/>
  <path d="${line}" pathLength="1" fill="none" stroke="url(#stroke)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="line"/>
</g>
${peak}
<circle cx="${round(last.x)}" cy="${round(last.y)}" r="4" fill="${t.accent[1]}" class="pulse"/>
<circle cx="${round(last.x)}" cy="${round(last.y)}" r="4" fill="${t.accent[1]}"/>
<text x="${W - 28}" y="${H - 10}" class="muted" font-size="10" text-anchor="end">aggiornato il ${fmtDate(updated, true)} · updated daily</text>`;
  return svg({ width: W, height: H, title: 'Attività su GitHub · Contribution activity', theme: t, defs, css, body });
}

// ---------------------------------------------------------- README: repo

const mdText = (s) => s.replace(/\s+/g, ' ').trim().replace(/[\\|]/g, '\\$&').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Taglia a fine parola, senza spezzare emoji o caratteri composti.
function truncate(s, max) {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  const cut = chars.slice(0, max).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:·—–-]+$/, '')}…`;
}

function reposMarkdown(repos) {
  if (!repos.length) return '_Ancora nessun repository pubblico · No public repositories yet._';
  const sorted = [...repos].sort((a, b) => a.isArchived - b.isArchived || (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''));
  const rows = sorted.map((r) => {
    let name = `[**${r.name}**](${r.url})`;
    if (r.homepageUrl) name += ` [🔗](<${/^https?:\/\//.test(r.homepageUrl) ? r.homepageUrl : `https://${r.homepageUrl}`}>)`;
    if (r.stargazerCount) name += ` <sub>⭐ ${r.stargazerCount}</sub>`;
    if (r.isArchived) name += ' <sub>archiviato · archived</sub>';
    const description = r.description ? mdText(truncate(r.description, 130)) : '—';
    const language = r.primaryLanguage ? mdText(r.primaryLanguage.name) : '—';
    const pushed = r.pushedAt ? `${MONTHS[Number(r.pushedAt.slice(5, 7)) - 1]} ${r.pushedAt.slice(0, 4)}` : '—';
    return `| ${name} | ${description} | ${language} | ${pushed} |`;
  });
  return [
    '| Repository | Descrizione · Description | Linguaggio · Language | Ultimo push · Last push |',
    '| :-- | :-- | :-- | :-- |',
    ...rows,
  ].join('\n');
}

async function updateReadme(repos) {
  const readme = await readFile(README_PATH, 'utf8');
  const start = readme.indexOf(REPOS_START);
  const end = readme.indexOf(REPOS_END);
  if (start < 0 || end < start) {
    console.warn(`Marcatori ${REPOS_START} / ${REPOS_END} non trovati: README non aggiornato.`);
    return false;
  }
  const updated = `${readme.slice(0, start + REPOS_START.length)}\n\n${reposMarkdown(repos)}\n\n${readme.slice(end)}`;
  if (updated === readme) return false;
  await writeFile(README_PATH, updated);
  return true;
}

// ------------------------------------------------------------------- main

if (!LOGIN) throw new Error('Imposta GH_LOGIN (o GITHUB_REPOSITORY_OWNER).');
if (!TOKEN) throw new Error('Imposta GITHUB_TOKEN.');

const { user, repos } = await fetchProfile();
const days = await fetchContributions(user.createdAt);
const today = days.at(-1)?.date ?? new Date().toISOString().slice(0, 10);
const year = Number(today.slice(0, 4));
const stats = {
  total: days.reduce((s, d) => s + d.count, 0),
  thisYear: days.filter((d) => d.date.startsWith(`${year}-`)).reduce((s, d) => s + d.count, 0),
  year,
  since: new Date(user.createdAt).getUTCFullYear(),
  ...computeStreaks(days),
  repos: repos.length,
  stars: repos.reduce((s, r) => s + r.stargazerCount, 0),
  followers: user.followers.totalCount,
};
const languages = computeLanguages(repos);
const activity = weeklyActivity(days, ACTIVITY_WEEKS);

await mkdir(OUT_DIR, { recursive: true });
for (const [name, theme] of Object.entries(THEMES)) {
  await writeFile(join(OUT_DIR, `stats-${name}.svg`), statsCard(stats, theme));
  await writeFile(join(OUT_DIR, `languages-${name}.svg`), languagesCard(languages, theme));
  await writeFile(join(OUT_DIR, `activity-${name}.svg`), activityCard(activity, theme, today));
}
const readmeChanged = await updateReadme(repos);

console.log(`Utente: ${LOGIN}`);
console.log(`Contributi: ${stats.total} totali, ${stats.thisYear} nel ${year}`);
console.log(`Streak: attuale ${stats.current.length}, record ${stats.longest.length}`);
console.log(`Repository pubblici: ${repos.length} · stelle: ${stats.stars} · follower: ${stats.followers}`);
console.log(`Linguaggi: ${languages.map((l) => `${l.name} ${(l.share * 100).toFixed(1)}%`).join(', ') || '—'}`);
console.log(`SVG scritti in ${OUT_DIR}/ · README ${readmeChanged ? 'aggiornato' : 'invariato'}`);
