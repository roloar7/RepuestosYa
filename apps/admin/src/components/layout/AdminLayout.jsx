import { useEffect, useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import useMediaQuery from "../../hooks/useMediaQuery.js"
import { useAuthContext } from "../../hooks/useAuthContext.js"
import { CompleteProfile } from "../../pages/auth/CompleteProfile.jsx"
import Sidebar from "./Sidebar.jsx"
import Navbar from "./Navbar.jsx"
import styles from "./AdminLayout.module.css"

const COMPACT_QUERY = "(max-width: 1024px)"

function AdminLayout() {
  const location = useLocation()
  const { needsProfile, user } = useAuthContext()
  const isCompact = useMediaQuery(COMPACT_QUERY)
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [lastPath, setLastPath] = useState(location.pathname)
  const [lastCompact, setLastCompact] = useState(isCompact)
  const [showCompleteProfile, setShowCompleteProfile] = useState(false)
  const [lastNeedsProfile, setLastNeedsProfile] = useState(needsProfile)

  // Actualizar showCompleteProfile cuando needsProfile cambia (render-adjustment pattern)
  if (lastNeedsProfile !== needsProfile) {
    setLastNeedsProfile(needsProfile)
    setShowCompleteProfile(needsProfile)
  }

  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setDrawerOpen(false)
  }

  if (lastCompact !== isCompact) {
    setLastCompact(isCompact)
    if (isCompact) setCollapsed(false)
    else setDrawerOpen(false)
  }

  useEffect(() => {
    if (!drawerOpen || !isCompact) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen, isCompact])

  const handleToggle = () => {
    if (isCompact) setDrawerOpen((value) => !value)
    else setCollapsed((value) => !value)
  }

  const sidebarCollapsed = collapsed && !isCompact

  return (
    <>
      <div className={`${styles.layout} ${sidebarCollapsed ? styles.layoutCollapsed : ""}`}>
        <Sidebar collapsed={sidebarCollapsed} drawerOpen={drawerOpen} />
        <div className={styles.main}>
          <Navbar onToggle={handleToggle} isCompact={isCompact} drawerOpen={drawerOpen} />
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
        {isCompact && drawerOpen && (
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Cerrar menú"
            onClick={() => setDrawerOpen(false)}
          />
        )}
      </div>

      {showCompleteProfile && user?.id && (
        <CompleteProfile
          userId={user.id}
          onComplete={() => setShowCompleteProfile(false)}
        />
      )}
    </>
  )
}

export default AdminLayout
