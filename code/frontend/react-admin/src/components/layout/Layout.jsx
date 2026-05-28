import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'
import FooterBar from './FooterBar'

export default function Layout({ children }) {
  const location = useLocation()
  const isDashboard = location.pathname === '/'
  const [isSidebarVisible, setIsSidebarVisible] = useState(true)

  useEffect(() => {
    if (isDashboard) {
      setIsSidebarVisible(true)
    }
  }, [isDashboard])

  const handleToggleSidebar = () => {
    if (isDashboard) return
    setIsSidebarVisible(prev => !prev)
  }

  const handleSidebarNavigation = (to) => {
    if (to === '/') {
      setIsSidebarVisible(true)
      return
    }
    setIsSidebarVisible(false)
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div className="flex flex-1 pg-layout-main">
        {isSidebarVisible && (
          <Sidebar onNavigate={handleSidebarNavigation} />
        )}
        <main className="pg-content">
          {children}
        </main>
      </div>
      <FooterBar
        isSidebarVisible={isSidebarVisible}
        onToggleSidebar={handleToggleSidebar}
        canToggleSidebar={!isDashboard}
      />
    </div>
  )
}
