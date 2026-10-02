import { useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { usePolicyBook } from '@/context/PolicyBookContext'
import { openCookiePreferences } from '@/consent/cookieConsent'
import Book from '@/components/book/Book'
import Card from '@/components/layout/Card'
import { buildImageCard } from '@/utils/loadoutCards'
import { creditsEntries } from '@/utils/credits'
import { getStoriesCatalog } from '@/api/stories'
import roadmap from '@/data/roadmap.json'
import { roadmapCard, roadmapStatus, sortRoadmap } from '@/utils/roadmap'

/**
 * PolicyBook — the Privacy / Terms / Cookies / Credits book opened from the footer links.
 * Left page: the matching `home-*` card of images.json; right page: the policy title and text,
 * or (credits) the grid of story and image cards, or (roadmap) the version cards.
 */
const POLICIES = {
  privacy: {
    imgId: 'home-privacy-policy', ns: 'modals.privacy', copyright: '© 2026',
    sections: [
      ['controllerTitle', 'controllerBody'], ['dataTitle', 'dataBody'], ['purposesTitle', 'purposesBody'],
      ['cookiesTitle', 'cookiesBody'], ['sharingTitle', 'sharingBody'], ['transfersTitle', 'transfersBody'],
      ['retentionTitle', 'retentionBody'], ['rightsTitle', 'rightsBody'], ['childrenTitle', 'childrenBody'],
      ['securityTitle', 'securityBody'], ['changesTitle', 'changesBody'],
    ],
  },
  terms: {
    imgId: 'home-terms-conditions', ns: 'modals.terms', copyright: '© paths.games',
    sections: [
      ['acceptanceTitle', 'acceptanceBody'], ['serviceTitle', 'serviceBody'], ['guestTitle', 'guestBody'],
      ['useTitle', 'useBody'], ['ipTitle', 'ipBody'], ['disclaimerTitle', 'disclaimerBody'],
      ['liabilityTitle', 'liabilityBody'], ['availabilityTitle', 'availabilityBody'],
      ['thirdPartyTitle', 'thirdPartyBody'], ['privacyRefTitle', 'privacyRefBody'],
      ['lawTitle', 'lawBody'], ['changesTitle', 'changesBody'],
    ],
  },
  cookies: {
    imgId: 'home-cookies-policy', ns: 'modals.cookies', copyright: null,
    sections: [
      ['necessaryTitle', 'necessaryBody'], ['analyticsTitle', 'analyticsBody'], ['legalTitle', 'legalBody'],
      ['manageTitle', 'manageBody'], ['thirdPartyTitle', 'thirdPartyBody'], ['rightsTitle', 'rightsBody'],
    ],
  },
  credits: { imgId: 'home-credits', ns: 'modals.credits' },
  // Step 40 — the Devlog: project intro on the left, one small card per version on the right.
  roadmap: { imgId: 'home', ns: 'modals.roadmap' },
}

/** Step 40 — the repository the Devlog intro links to. */
export const REPO_URL = 'https://github.com/gamespaths/pathsgames'

function PolicyText({ policy, t }) {
  const { ns, sections, copyright } = policy
  return (
    <div className="policy-book-text">
      {copyright && <p><strong className="gold-light">Paths Games</strong> {copyright}</p>}
      <p>{t(`${ns}.intro`)}</p>
      {sections.map(([titleKey, bodyKey]) => (
        <div key={titleKey}>
          <h6>{t(`${ns}.${titleKey}`)}</h6>
          <p>{t(`${ns}.${bodyKey}`)}</p>
        </div>
      ))}
      <p className="policy-book-updated">{t(`${ns}.updated`)}</p>
    </div>
  )
}

/**
 * The credits page: one small card per credited work, the stories first. Each carries its
 * type badge and its credit over the picture, and the credit button opens the original source.
 * The badges are the shared `.stat-badge.bonus-badge` pill every other stat badge wears —
 * `BonusBadgeList` puts both classes on each of its badges, and the credits carry no value,
 * so they are written as plain spans instead of going through that component (whose numeric
 * zero-filter would drop a credit name like "PathsGames"). `.credit-card-badge__text` is the
 * span the long credit is cut in: `.stat-badge` is a flex row, and an ellipsis needs a block
 * box of its own to work in.
 */
function CreditsCards({ entries, t }) {
  const badge = (testId, label, title) => (
    <span className="stat-badge bonus-badge credit-card-badge" data-testid={testId} title={title}>
      <span className="credit-card-badge__text">{label}</span>
    </span>
  )
  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list credits-cards">
        {entries.map(({ key, kind, card }) => (
          <Card key={key} card={card} imageAlt={card.title} hidePreview
            childrenIntoImage={
              <div className="story-card-status credit-card-badges">
                {badge(`credit-type-${kind}`, t(`modals.credits.types.${kind}`))}
                {card.copyrightText && badge('credit-copy', card.copyrightText, card.copyrightText)}
              </div>
            }
            onAction={card.linkCopyright
              ? () => window.open(card.linkCopyright, '_blank', 'noopener,noreferrer') : undefined}
            actionLabel={t('modals.credits.openCredit')} actionIcon="fa-external-link-alt" />
        ))}
      </div>
    </div>
  )
}

/**
 * Step 40 — the Devlog left page: the intro text, with `{repo}` replaced by the repository
 * link (GitHub glyph), `{credits}` by the link that opens the credits book and each
 * `<br />` by a real line break, so a `<br /><br />` pair reads as an empty line.
 */
const INTRO_TOKEN = /(\{repo\}|\{credits\}|<br\s*\/?>)/i

export function RoadmapIntro({ intro, repoLabel, creditsLabel, onCredits }) {
  const parts = String(intro ?? '').split(INTRO_TOKEN).filter(part => part.trim() !== '')
  return (
    <p className="roadmap-intro">
      {parts.map((part, i) => {
        if (/^<br\s*\/?>$/i.test(part)) return <br key={i} />
        if (/^\{repo\}$/i.test(part))
          return <a key={i} href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <i className="fab fa-github me-1" aria-hidden="true" />{repoLabel}
          </a>
        if (/^\{credits\}$/i.test(part)) return <button key={i} type="button" onClick={onCredits}>{creditsLabel}</button>
        return part
      })}
    </p>
  )
}

/** Step 40 — one small card per version of data/roadmap.json, laid out like the credits. */
export function RoadmapCards({ entries = roadmap, t }) {
  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list roadmap-cards">
        {sortRoadmap(entries).map(entry => (
          <Card key={entry.id} card={roadmapCard(entry)} name={entry.title ?? entry.id}
            imageAlt={entry.id} hidePreview
            childrenIntoImage={roadmapStatus(entry) === 'current'
              ? <span className="story-card-status story-card-status--active story-card-status--center stat-badge bonus-badge"
                  data-testid="roadmap-current">
                  <i className="fas fa-play me-1" />{t('modals.roadmap.current')}</span>
              : null}
            onAction={() => window.open(entry.link, '_blank', 'noopener,noreferrer')}
            actionLabel={t('modals.roadmap.button')} actionIcon="fa-map-signs" />
        ))}
      </div>
    </div>
  )
}

export default function PolicyBook() {
  const { t, lang } = useTranslation()
  const { policyBook, openPolicyBook, closePolicyBook } = usePolicyBook()
  // Credits only: the catalog stories join the shipped ones. getStoriesCatalog is memoised,
  // so the home's answer is reused; a failure leaves the teasers alone, no error shown.
  const [serviceStories, setServiceStories] = useState([])
  useEffect(() => {
    if (policyBook !== 'credits') return undefined
    let cancelled = false
    getStoriesCatalog(lang)
      .then(list => { if (!cancelled) setServiceStories(Array.isArray(list) ? list : []) })
      .catch(() => { if (!cancelled) setServiceStories([]) })
    return () => { cancelled = true }
  }, [policyBook, lang])

  const policy = POLICIES[policyBook]
  if (!policy) return null

  // Left: the home-* image with the paths.games manifesto; right: the policy's own title.
  const leftCard = buildImageCard(policy.imgId, t('modals.policyBook.title'), t('modals.policyBook.body'))
  const title = buildImageCard(policy.imgId).title
  let leftPage = <Card variant="page" card={leftCard} loading={false} />

  let rightPage
  if (policyBook === 'roadmap') {
    leftPage = <Card variant="page" loading={false}
      card={buildImageCard('home', 'paths.games',
        <RoadmapIntro intro={t('modals.roadmap.intro')} repoLabel={t('modals.roadmap.introRepo')}
          creditsLabel={t('modals.roadmap.introCredits')} onCredits={() => openPolicyBook('credits')} />)} />
    rightPage = <RoadmapCards t={t} />
  } else if (policyBook === 'credits') {
    rightPage = <CreditsCards entries={creditsEntries({ stories: serviceStories, lang })} t={t} />
  } else {
    const manage = policyBook === 'cookies'
      ? { onAction: openCookiePreferences, actionLabel: t('modals.cookies.manage'), actionIcon: 'fa-cog' }
      : {}
    rightPage = <Card variant="page" card={{ title, description: <PolicyText policy={policy} t={t} /> }}
      loading={false} {...manage} />
  }

  function close() { closePolicyBook() }

  return (
    <Book
      onClose={close}
      overlayClass="book-overlay policy-book-overlay"
      left={leftPage}
      right={rightPage}
      mobile={<div className="book-mobile-layout">{leftPage}{rightPage}</div>}
    />
  )
}
