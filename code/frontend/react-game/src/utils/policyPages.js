/**
 * policyPages — v1.2.0 static privacy / terms / cookies pages built from the i18n texts, EN and IT.
 * Pure functions: the postbuild script `scripts/generate-policy-pages.mjs` writes the files into dist.
 */

export const POLICY_KINDS = ['privacy', 'terms', 'cookies']
export const SITE_URL = 'https://paths.games'

const LANGS = [
  { code: 'en', name: 'English', open: 'Open in the game' },
  { code: 'it', name: 'Italiano', open: 'Apri nel gioco' },
]

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

const STYLE = `
  body { margin: 0; background: #1b1511; color: #e8dcc0; font: 16px/1.6 Georgia, 'Times New Roman', serif; }
  header { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding: 16px; border-bottom: 1px solid #5a4630; }
  header a, main a { color: #d4af37; }
  main { max-width: 760px; margin: 0 auto; padding: 16px; }
  section + section { margin-top: 48px; padding-top: 24px; border-top: 1px solid #5a4630; }
  h1, h2 { color: #d4af37; line-height: 1.3; }
  h1 { font-size: 1.8rem; }
  h2 { font-size: 1.15rem; margin-top: 28px; }
  .updated { color: #b8a888; font-style: italic; }`

/** Text made safe for HTML content and double- or single-quoted attributes. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ESCAPES[ch])
}

function lookup(dict, path) {
  return path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), dict)
}

function requiredKeys(policy) {
  return ['title', 'intro', 'updated', ...policy.sections.flat()]
}

/** Every `lang:key` the pages need and the translations lack; an empty list means complete. */
export function missingKeys(policies, translations) {
  const missing = []
  for (const kind of POLICY_KINDS) {
    const policy = policies?.[kind]
    if (!policy?.ns || !Array.isArray(policy.sections)) {
      missing.push(`policy:${kind}`)
      continue
    }
    for (const { code } of LANGS) {
      for (const key of requiredKeys(policy)) {
        const value = lookup(translations?.[code], `${policy.ns}.${key}`)
        if (typeof value !== 'string' || !value.trim()) missing.push(`${code}:${policy.ns}.${key}`)
      }
    }
  }
  return missing
}

function renderLanguage(kind, policy, dict, lang) {
  const text = key => escapeHtml(lookup(dict, `${policy.ns}.${key}`))
  const copyright = policy.copyright
    ? `\n    <p><strong>Paths Games</strong> ${escapeHtml(policy.copyright)}</p>` : ''
  const sections = policy.sections
    .map(([titleKey, bodyKey]) => `    <h2>${text(titleKey)}</h2>\n    <p>${text(bodyKey)}</p>`)
    .join('\n')
  return `  <section id="${lang.code}" lang="${lang.code}">
    <h1>${text('title')}</h1>${copyright}
    <p>${text('intro')}</p>
${sections}
    <p class="updated">${text('updated')}</p>
    <p><a href="/?policy=${kind}">${lang.open}</a></p>
  </section>`
}

/** One complete HTML page for a policy kind, English first and then Italian. */
export function renderPolicyPage(kind, policies, translations) {
  const policy = policies[kind]
  const title = escapeHtml(lookup(translations.en, `${policy.ns}.title`))
  const nav = LANGS.map(lang => `<a href="#${lang.code}">${lang.name}</a>`).join(' · ')
  const body = LANGS.map(lang => renderLanguage(kind, policy, translations[lang.code], lang)).join('\n')
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Paths Games</title>
  <meta name="description" content="${escapeHtml(lookup(translations.en, `${policy.ns}.intro`))}">
  <link rel="canonical" href="${SITE_URL}/${kind}.html">
  <style>${STYLE}
  </style>
</head>
<body>
  <header><a href="/">Paths Games</a><nav>${nav}</nav></header>
  <main>
${body}
  </main>
</body>
</html>
`
}

/** The three pages as `{ file, html }`; throws when any text is missing so the build fails. */
export function buildPolicyPages(policies, translations) {
  const missing = missingKeys(policies, translations)
  if (missing.length > 0) {
    throw new Error(`Policy pages: missing texts ${missing.join(', ')}`)
  }
  return POLICY_KINDS.map(kind => ({ file: `${kind}.html`, html: renderPolicyPage(kind, policies, translations) }))
}
