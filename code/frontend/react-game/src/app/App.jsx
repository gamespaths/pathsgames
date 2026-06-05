import { BrowserRouter } from 'react-router-dom'
import Providers from './providers'
import AppRoutes from './routes'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CookieConsentManager from '@/components/CookieConsentManager'
import PrivacyModal from '@/components/modals/PrivacyModal'
import TermsModal from '@/components/modals/TermsModal'
import CookiesModal from '@/components/modals/CookiesModal'
import CreditsModal from '@/components/modals/CreditsModal'
import GuestUserModal from '@/features/guest-user/GuestUserModal'

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <CookieConsentManager />
        <Navbar />
        <main>
          <AppRoutes />
        </main>
        <Footer />

        {/* Global modals (Bootstrap, triggered by data-bs-target) */}
        <PrivacyModal />
        <TermsModal />
        <CookiesModal />
        <CreditsModal />
        <GuestUserModal />
      </BrowserRouter>
    </Providers>
  )
}
