import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage       from './pages/LoginPage'
import DashboardPage   from './pages/DashboardPage'
import GuestsPage      from './pages/GuestsPage'
import StoriesPage     from './pages/StoriesPage'
import StoryImportPage from './pages/StoryImportPage'
import EchoPage        from './pages/EchoPage'

function ProtectedRoutes() {
  const { isLoggedIn } = useAuth()
  if (!isLoggedIn) return <Navigate to="/login" replace />
  return (
    <Layout>
      <Routes>
        <Route path="/"               element={<DashboardPage />}   />
        <Route path="/guests"         element={<GuestsPage />}      />
        <Route path="/stories"        element={<StoriesPage />}     />
        <Route path="/stories/import" element={<StoryImportPage />} />
        <Route path="/echo"           element={<EchoPage />}        />
        <Route path="*"               element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}

function AppRoutes() {
  const { isLoggedIn } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/*"     element={<ProtectedRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
