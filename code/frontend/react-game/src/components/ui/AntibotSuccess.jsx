import { useTranslation } from '@/i18n/context'

/* AntibotSuccess — step 15: "Success! You are human." under the left card's text (Home, start match); main.css fades it. */
export default function AntibotSuccess() {
  const { t } = useTranslation()
  return (
    <p className="home-antibot-success" data-testid="antibot-success">
      <i className="fas fa-check-circle me-2" aria-hidden="true" />{t('antibot.success')}
    </p>
  )
}
