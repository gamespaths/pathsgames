import { NavLink } from 'react-router-dom'

const MENU = [
  { section: 'Overview' },
  { to: '/',          icon: 'fas fa-tachometer-alt', label: 'Dashboard'    },
  { section: 'Guests' },
  { to: '/guests',    icon: 'fas fa-user-secret',    label: 'Guest Users'  },
  { section: 'Stories' },
  { to: '/stories',   icon: 'fas fa-book-open',      label: 'Stories'      },
  { to: '/stories/import', icon: 'fas fa-file-import', label: 'Import Story' },
  { section: 'System' },
  { to: '/echo',      icon: 'fas fa-heartbeat',      label: 'Server Status'},
]

export default function Sidebar() {
  return (
    <aside className="pg-sidebar">
      {MENU.map((item, i) =>
        item.section
          ? <p key={i} className="pg-card-title ml-2">{item.section}</p>
          : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `pg-sidebar-link${isActive ? ' active' : ''}`}
            >
              <i className={item.icon} />
              {item.label}
            </NavLink>
          )
      )}
      <hr />
        <div className="pg-sidebar-footer mt-2">
            <div className=" text-center pg-card-title">
                Paths Games Admin Panel<br />
                Version: 0.17.0
            </div>
        </div>
    </aside>
  )
}
