import { useState } from 'react'
import { useTranslation } from '@/i18n/context'
import { usePolicyBook } from '@/context/PolicyBookContext'
import { openCookiePreferences } from '@/consent/cookieConsent'
import Book from '@/components/book/Book'
import Card from '@/components/layout/Card'
import { buildImageCard } from '@/utils/loadoutCards'
import images from '@/data/images.json'

/**
 * PolicyBook — the Privacy / Terms / Cookies / Credits book opened from the footer links.
 * Left page: the matching `home-*` card of images.json; right page: the policy title and text,
 * or (credits) the grid of image cards.
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
}

// images.json mixes {urlImage, copyrightText, linkCopyright, description} and {url, author, authorLink}.
export function creditCard(img) {
  return {
    urlImage: img.urlImage ?? img.url ?? null,
    title: img.title ?? img.id,
    copyrightText: img.copyrightText ?? img.author ?? null,
    linkCopyright: img.linkCopyright ?? img.authorLink ?? null,
    description: img.description ?? (img.author ? `Photo by ${img.author}` : null),
    styleImageLarge: img.styleImageLarge ?? '',
  }
}

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

// The credits page: the grid of image cards, laid out as MissionStepsCards lays out the steps.
function CreditsCards({ onPreview }) {
  return (
    <div className="config-view-wrap config-view--config">
      <div className="config-cards-area selection-list credits-cards">
        {images.map(img => (
          <Card key={img.id} card={creditCard(img)} name={img.title ?? img.id} imageAlt={img.id}
             flagInformationCard onPreview={() => onPreview(img)} />
        ))}
      </div>
    </div>
  )
}

export default function PolicyBook() {
  const { t } = useTranslation()
  const { policyBook, closePolicyBook } = usePolicyBook()
  // Credits only: the image whose (i) was pressed reads on the right page, the arrow turns back.
  const [preview, setPreview] = useState(null)

  const policy = POLICIES[policyBook]
  if (!policy) return null

  // Left: the home-* image with the paths.games manifesto; right: the policy's own title.
  const leftCard = buildImageCard(policy.imgId, t('modals.policyBook.title'), t('modals.policyBook.body'))
  const title = buildImageCard(policy.imgId).title
  const leftPage = <Card variant="page" card={leftCard} loading={false} />

  let rightPage
  if (policyBook === 'credits') {
    rightPage = preview
      ? <Card variant="page" card={creditCard(preview)} loading={false} onClose={() => setPreview(null)} />
      : <CreditsCards onPreview={setPreview} />
  } else {
    const manage = policyBook === 'cookies'
      ? { onAction: openCookiePreferences, actionLabel: t('modals.cookies.manage'), actionIcon: 'fa-cog' }
      : {}
    rightPage = <Card variant="page" card={{ title, description: <PolicyText policy={policy} t={t} /> }}
      loading={false} {...manage} />
  }

  function close() { setPreview(null); closePolicyBook() }

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
