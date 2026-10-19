import { NavLink, Outlet } from "react-router-dom"
import styles from "./Impresion3DLayout.module.css"

const tabs = [
  { to: "/impresion-3d/granja", label: "Granja" },
  { to: "/impresion-3d/calculadora", label: "Calculadora" },
  { to: "/impresion-3d/trabajos", label: "Trabajos", disabled: true },
  { to: "/impresion-3d/archivos", label: "Archivos", disabled: true },
  { to: "/impresion-3d/materiales", label: "Materiales", disabled: true },
]

function Impresion3DLayout() {
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Impresión 3D</h2>
          <p className={styles.subtitle}>
            Administrá impresoras, archivos .gcode y trabajos de producción.
          </p>
        </div>
      </header>

      <nav className={styles.tabs}>
        {tabs.map((tab) =>
          tab.disabled ? (
            <span key={tab.to} className={`${styles.tab} ${styles.tabDisabled}`}>
              {tab.label}
              <span className={styles.tabSoon}>Pronto</span>
            </span>
          ) : (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabActive : ""}`}
            >
              {tab.label}
            </NavLink>
          ),
        )}
      </nav>

      <div className={styles.outlet}>
        <Outlet />
      </div>
    </div>
  )
}

export default Impresion3DLayout
