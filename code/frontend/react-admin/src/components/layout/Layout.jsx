import Navbar from './Navbar'
import FooterBar from './FooterBar'

export default function Layout({ children }) {
  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Navbar />
      <main className="pg-content">
        {children}
      </main>
      <FooterBar />
    </div>
  )
}
