export default function BookPageLeft({ children }) {
  return (
    <div className="book-page book-page-left">
      <div className="page-corner page-corner-tl" />
      <div className="page-corner page-corner-br" />
      <div className="page-inner">
        {children}
      </div>
    </div>
  )
}
