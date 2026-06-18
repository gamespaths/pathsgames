import { useTranslation } from '../../i18n/context'
import Card from '../layout/Card'
import images from '../../mock/images.json'

/**
 * CreditsModal — image-credits modal.
 *
 * Renders every entry from `src/mock/images.json` as a Card inside a
 * responsive grid (3 columns on desktop, 2 on tablet, 1 on phone).
 * `images.json` mixes two shapes — `{urlImage, copyrightText, linkCopyright,
 * description}` and `{url, author, authorLink}` — so each entry is normalised
 * into a single Card `card` payload.
 *
 * Triggered from the footer "Credits / Crediti" link via
 * `data-bs-target="#creditsModal"`.
 */
export default function CreditsModal() {
  const { t } = useTranslation()

  function toCard(img) {
    const urlImage = img.urlImage ?? img.url ?? null
    const copyrightText = img.copyrightText ?? img.author ?? null
    const linkCopyright = img.linkCopyright ?? img.authorLink ?? null
    const description = img.description
      ?? (img.author ? `Photo by ${img.author}` : null)
    return {
      urlImage,
      title: img.id,
      copyrightText,
      linkCopyright,
      description,
      styleImageLarge: img.styleImageLarge ?? '',
    }
  }

  return (
    <div className="modal fade" id="creditsModal" tabIndex="-1" aria-hidden="true">
      <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="fas fa-images me-2" />{t('modals.credits.title')}
            </h5>
            <button type="button" className="modal-custom-close" data-bs-dismiss="modal">
              <i className="fas fa-times" />
            </button>
          </div>
          <div className="modal-body">
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {t('modals.credits.body')}
            </p>
            <div className="credits-grid">
              {images.map(img => (
                <Card
                  key={img.id}
                  variant="little"
                  card={toCard(img)}
                  name={img.id}
                  imageAlt={img.id}
                  showLinkCopyright
                />
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="modal-close-btn" data-bs-dismiss="modal">
              {t('modals.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
