import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './i18n/context'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import PrivacyModal from './components/modals/PrivacyModal'
import TermsModal from './components/modals/TermsModal'
import CookiesModal from './components/modals/CookiesModal'
import HomePage from './pages/HomePage'
import GamePage from './pages/GamePage'

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/play/:storyId" element={<GamePage />} />
          </Routes>
        </main>
        <Footer />

        {/* Global modals (Bootstrap, triggered by data-bs-target) */}
        <PrivacyModal />
        <TermsModal />
        <CookiesModal />
      </BrowserRouter>
    </LanguageProvider>
  )
}
