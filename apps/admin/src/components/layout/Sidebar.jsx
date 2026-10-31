import { useState } from "react"
import { NavLink, useLocation } from "react-router-dom"
import { navSections } from "../../navigation.js"
import { icons } from "../iconMap.js"
import { BiChevronDown } from "react-icons/bi"
import logoSrc from "../../assets/Logo.svg"
import styles from "./Sidebar.module.css"

function Sidebar({ collapsed, drawerOpen }) {
  const location = useLocation()
  const [manuallyOpen, setManuallyOpen] = useState({})

  const isParentOpen = (item) =>
    manuallyOpen[item.to] ?? location.pathname.startsWith(item.to)

  const sidebarClass = [
    styles.sidebar,
    collapsed ? styles.collapsed : "",
    drawerOpen ? styles.drawerOpen : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <aside className={sidebarClass} id="admin-sidebar">
      <div className={styles.brand}>
        <img src={logoSrc} alt="RepuestosYa" className={styles.brandLogo} />
        <span className={styles.brandText}>
          <span className={styles.brandName}>RepuestosYa</span>
          <span className={styles.brandSub}>Panel</span>
        </span>
      </div>

      <nav className={styles.nav}>
        {navSections.map((section) => (
          <div key={section.id} className={styles.section}>
            <p className={styles.sectionLabel}>{section.label}</p>

            {section.items.map((item) => {
              const Icon = icons[item.icon]

              if (item.disabled) {
                return (
                  <span key={item.to} className={`${styles.link} ${styles.disabled}`}>
                    <span className={styles.icon}>
                      <Icon />
                    </span>
                    <span className={styles.linkLabel}>{item.label}</span>
                    <span className={styles.soon}>Pronto</span>
                  </span>
                )
              }

              if (item.children) {
                const open = isParentOpen(item)
                const isActive = location.pathname.startsWith(item.to)

                return (
                  <div key={item.to}>
                    <button
                      type="button"
                      className={`${styles.link} ${styles.parent} ${
                        isActive ? styles.linkActive : ""
                      }`}
                      onClick={() =>
                        setManuallyOpen((state) => ({ ...state, [item.to]: !open }))
                      }
                    >
                      {Icon && (
                        <span className={styles.icon}>
                          <Icon />
                        </span>
                      )}
                      <span className={styles.linkLabel}>{item.label}</span>
                      <span className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}>
                        <BiChevronDown size={16} />
                      </span>
                    </button>

                    {open && (
                      <div className={styles.subnav}>
                        {item.children.map((child) => {
                          const ChildIcon = icons[child.icon]
                          return (
                            <NavLink
                              key={child.to}
                              to={child.to}
                              className={({ isActive: active }) =>
                                `${styles.sublink} ${active ? styles.sublinkActive : ""}`
                              }
                            >
                              {ChildIcon && (
                                <span className={styles.icon}>
                                  <ChildIcon size={16} />
                                </span>
                              )}
                              {child.label}
                            </NavLink>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `${styles.link} ${isActive ? styles.linkActive : ""}`
                  }
                >
                  {Icon && (
                    <span className={styles.icon}>
                      <Icon />
                    </span>
                  )}
                  <span className={styles.linkLabel}>{item.label}</span>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div className={styles.footerCard}>
          <span className={styles.footerDot} />
          <span className={styles.footerText}>
            <strong> Puente </strong>
            <span> Desconectado </span>
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
