import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/context'
import { ServerProvider } from './context/ServerContext'
import { GuestUserProvider } from './context/GuestUserContext'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import CookieConsentManager from './components/CookieConsentManager'
import PrivacyModal from './components/modals/PrivacyModal'
import TermsModal from './components/modals/TermsModal'
import CookiesModal from './components/modals/CookiesModal'
import CreditsModal from './components/modals/CreditsModal'
import GuestUserModal from './components/modals/user/GuestUserModal'
import HomePage from './pages/HomePage'
import StartMatchPage from './pages/StartMatchPage'
import GamePage from './pages/GamePage'

export default function App() {
  return (
    <ServerProvider>
    <LanguageProvider>
      <GuestUserProvider>
      <BrowserRouter>
        <CookieConsentManager />
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/start-match/:storyId" element={<StartMatchPage />} />
            <Route path="/play/:storyId" element={<GamePage />} />
          </Routes>
        </main>
        <Footer />

        {/* Global modals (Bootstrap, triggered by data-bs-target) */}
        <PrivacyModal />
        <TermsModal />
        <CookiesModal />
        <CreditsModal />
        <GuestUserModal />
      </BrowserRouter>
      </GuestUserProvider>
    </LanguageProvider>
    </ServerProvider>
  )
}
