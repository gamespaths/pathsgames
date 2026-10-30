import { describe, it, expect } from 'vitest'
import policies from '../data/policies.json'
import en from '../i18n/en.json'
import itTexts from '../i18n/it.json'
import {
  POLICY_KINDS,
  SITE_URL,
  escapeHtml,
  missingKeys,
  renderPolicyPage,
  buildPolicyPages,
} from '../utils/policyPages'

const translations = { en, it: itTexts }
const lookup = (dict, path) => path.split('.').reduce((node, key) => node?.[key], dict)
const withoutKey = (dict, ns, key) => {
  const copy = structuredClone(dict)
  delete lookup(copy, ns)[key]
  return copy
}

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`))
      .toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;')
  })

  it('turns null and undefined into an empty string', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('missingKeys', () => {
  it('finds nothing missing in the real EN and IT texts', () => {
    expect(missingKeys(policies, translations)).toEqual([])
  })

  it('reports a section body missing in one language', () => {
    const broken = { en, it: withoutKey(itTexts, 'modals.privacy', 'dataBody') }
    expect(missingKeys(policies, broken)).toEqual(['it:modals.privacy.dataBody'])
  })

  it('reports blank texts and the title, intro and updated lines', () => {
    const blank = structuredClone(en)
    blank.modals.terms.intro = '   '
    delete blank.modals.cookies.title
    delete blank.modals.cookies.updated
    expect(missingKeys(policies, { en: blank, it: itTexts })).toEqual([
      'en:modals.terms.intro', 'en:modals.cookies.title', 'en:modals.cookies.updated',
    ])
  })

  it('reports a policy without structure and a missing language', () => {
    const partial = { privacy: policies.privacy, terms: { ns: 'modals.terms' } }
    const missing = missingKeys(partial, { en })
    expect(missing).toContain('policy:terms')
    expect(missing).toContain('policy:cookies')
    expect(missing).toContain('it:modals.privacy.title')
    expect(missing.some(key => key.startsWith('en:'))).toBe(false)
  })

  it('reports every key when there are no policies or translations at all', () => {
    expect(missingKeys(undefined, undefined)).toEqual(POLICY_KINDS.map(kind => `policy:${kind}`))
  })
})

describe('renderPolicyPage', () => {
  it.each(POLICY_KINDS)('%s: every section in English and Italian, in order', kind => {
    const { ns, sections } = policies[kind]
    const html = renderPolicyPage(kind, policies, translations)
    for (const dict of [en, itTexts]) {
      let from = 0
      for (const key of ['title', 'intro', ...sections.flat(), 'updated']) {
        const at = html.indexOf(escapeHtml(lookup(dict, `${ns}.${key}`)), from)
        expect(at, `${ns}.${key}`).toBeGreaterThan(-1)
        from = at
      }
    }
    expect(html.match(/<h2>/g)).toHaveLength(sections.length * 2)
  })

  it('is a complete page with canonical URL, language sections and the in-game link', () => {
    const html = renderPolicyPage('privacy', policies, translations)
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain(`<link rel="canonical" href="${SITE_URL}/privacy.html">`)
    expect(html).toContain(`<title>${escapeHtml(en.modals.privacy.title)} — Paths Games</title>`)
    expect(html).toContain('<section id="en" lang="en">')
    expect(html).toContain('<section id="it" lang="it">')
    expect(html).toContain('<a href="/?policy=privacy">Open in the game</a>')
    expect(html).toContain('<a href="/?policy=privacy">Apri nel gioco</a>')
    expect(html.indexOf('lang="en"', 20)).toBeLessThan(html.indexOf('lang="it"'))
  })

  it('shows the copyright line only when the policy has one', () => {
    expect(renderPolicyPage('terms', policies, translations))
      .toContain(`<p><strong>Paths Games</strong> ${escapeHtml(policies.terms.copyright)}</p>`)
    expect(renderPolicyPage('cookies', policies, translations)).not.toContain('<strong>Paths Games</strong>')
  })

  it('escapes the texts it prints', () => {
    const tricky = structuredClone(en)
    tricky.modals.cookies.intro = '<script>alert("x")</script>'
    const html = renderPolicyPage('cookies', policies, { en: tricky, it: itTexts })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  })
})

describe('buildPolicyPages', () => {
  it('builds the three pages from the real texts', () => {
    const pages = buildPolicyPages(policies, translations)
    expect(pages.map(page => page.file)).toEqual(['privacy.html', 'terms.html', 'cookies.html'])
    pages.forEach(page => expect(page.html).toContain('</html>'))
  })

  it('throws with the missing keys so the build fails', () => {
    const broken = { en: withoutKey(en, 'modals.terms', 'lawBody'), it: itTexts }
    expect(() => buildPolicyPages(policies, broken)).toThrow('Policy pages: missing texts en:modals.terms.lawBody')
  })
})
