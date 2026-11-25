import { BrowserRouter } from 'react-router-dom'
import Providers from './providers'
import AppRoutes from './routes'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import CookieConsentManager from '@/components/CookieConsentManager'
import TooltipLayer from '@/components/ui/TooltipLayer'

/** v1.13.0 — every page is the in-flow book of its route: no global overlay any more. */
export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <CookieConsentManager />
        <Navbar />
        <main className="app-main">
          <AppRoutes />
        </main>
        <Footer />
        <TooltipLayer />
      </BrowserRouter>
    </Providers>
  )
}
