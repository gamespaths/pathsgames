import { Routes, Route } from 'react-router-dom'
import HomePage from '@/pages/HomePage'
import StartMatchPage from '@/pages/StartMatchPage'
import GamePage from '@/pages/GamePage'

/**
 * AppRoutes — the application route table. New routes (e.g. the future
 * multiplayer lobby) are added here so App.jsx stays focused on chrome.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/start-match/:storyId" element={<StartMatchPage />} />
      <Route path="/play/:storyId" element={<GamePage />} />
    </Routes>
  )
}
