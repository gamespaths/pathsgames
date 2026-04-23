import Navbar from './Navbar'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Navbar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="pg-content">
          {children}
        </main>
      </div>
    </div>
  )
}
