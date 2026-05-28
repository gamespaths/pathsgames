export default function BookPageRight({ children }) {
  return (
    <div className="book-page book-page-right  ">
      <div className="page-corner page-corner-tr" />
      <div className="page-corner page-corner-bl" />
      <div className="page-inner">
        {children}
      </div>
    </div>
  )
}
