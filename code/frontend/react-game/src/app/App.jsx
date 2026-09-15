import { BrowserRouter } from 'react-router-dom'
import Providers from './providers'
import AppRoutes from './routes'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CookieConsentManager from '@/components/CookieConsentManager'
import PolicyBook from '@/components/modals/PolicyBook'
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

        {/* Global overlays: the policy book (footer links) and the guest book */}
        <PolicyBook />
        <GuestUserModal />
      </BrowserRouter>
    </Providers>
  )
}
