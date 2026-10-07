/* =============================================
   App — root component with routing + providers
   ============================================= */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { UIProvider } from './context/UIContext';
import Navbar from './layout/Navbar';
import Footer from './layout/Footer';
import ChoicePopup from './components/ChoicePopup';
import InfoModal from './components/InfoModal';
import HomePage from './pages/HomePage';
import GamePage from './pages/GamePage';

function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <UIProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/play/:storyId" element={<GamePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
            <ChoicePopup />
            <InfoModal />
          </div>
        </UIProvider>
      </GameProvider>
    </BrowserRouter>
  );
}

export default App;
