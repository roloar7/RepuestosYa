import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { resolveTitle } from "../../navigation.js"
import { useAuthContext } from "../../hooks/useAuthContext.js"
import { useProfile } from "../../hooks/useProfile.js"
import { USER_ROLE_LABELS } from "../../constants/userRoles.js"
import { BellIcon, MenuIcon, SearchIcon, UserCircleIcon } from "../icons.jsx"
import DownloadElectron from "../DownloadElectron.jsx"
import styles from "./Navbar.module.css"

function Navbar({ onToggle, isCompact, drawerOpen }) {
  const location = useLocation()
  const { user, logout } = useAuthContext()
  const { profile } = useProfile(user?.id)
  const [searchOpen, setSearchOpen] = useState(false)
  const title = resolveTitle(location.pathname)

  const userEmail = user?.email || "Usuario"
  const userInitials = userEmail.substring(0, 2).toUpperCase()
  const userRol = USER_ROLE_LABELS[profile?.role] || USER_ROLE_LABELS[""]


  const toggleLabel = isCompact
    ? drawerOpen
      ? "Cerrar menú"
      : "Abrir menú"
    : "Colapsar menú"

  return (
    <header className={styles.navbar}>
      <button
        type="button"
        className={styles.toggle}
        onClick={onToggle}
        aria-label={toggleLabel}
        aria-expanded={isCompact ? drawerOpen : undefined}
        aria-controls="admin-sidebar"
      >
        <MenuIcon />
      </button>

      <h1 className={styles.title}>{title}</h1>

      <div className={styles.spacer} />

      <label className={styles.search}>
        <SearchIcon size={18} />
        <input type="search" placeholder="Buscar repuestos, pedidos, impresoras..." />
      </label>

      <button
        type="button"
        className={`${styles.iconBtn} ${styles.searchToggle}`}
        onClick={() => setSearchOpen((value) => !value)}
        aria-label={searchOpen ? "Cerrar búsqueda" : "Abrir búsqueda"}
        aria-expanded={searchOpen}
        aria-controls="navbar-search-bar"
      >
        <SearchIcon />
      </button>

      <button type="button" className={styles.iconBtn} aria-label="Notificaciones">
        <BellIcon />
        <span className={styles.badgeDot} />
      </button>

      <DownloadElectron />

      <div className={styles.userDropdown}>
        <button type="button" className={styles.userBtn}>
          <span className={styles.avatar}>{userInitials}</span>
          <span className={styles.userMeta}>
            <span className={styles.userEmail}>{userEmail}</span>
            <span className={styles.userRole}>{userRol}</span>
          </span>
        </button>
        <div className={styles.dropdownMenu}>
          <Link to="/perfil" className={styles.dropdownLink}>
            <UserCircleIcon size={18} />
            Mi Perfil
          </Link>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={logout}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div
        id="navbar-search-bar"
        className={`${styles.searchBar} ${searchOpen ? styles.searchBarOpen : ""}`}
      >
        <label className={styles.mobileSearch}>
          <SearchIcon size={18} />
          <input
            type="search"
            placeholder="Buscar repuestos, pedidos, impresoras..."
            autoFocus={searchOpen}
          />
        </label>
      </div>
    </header>
  )
}

export default Navbar
