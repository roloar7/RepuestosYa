import { Link } from "react-router-dom"
import { BiPulse, BiPackage, BiClipboard, BiTime, BiLayer } from "react-icons/bi"
import { useAuthContext } from "../../hooks/useAuthContext.js"
import { useProfile } from "../../hooks/useProfile.js"
import styles from "./Inicio.module.css"

const stats = [
  {
    id: "printers",
    label: "Impresoras activas",
    value: "12",
    delta: "3 imprimiendo",
    tone: "primary",
    icon: <BiLayer />,
  },
  {
    id: "queue",
    label: "Trabajos en cola",
    value: "8",
    delta: "2 en pausa",
    tone: "accent",
    icon: <BiTime />,
  },
  {
    id: "stock",
    label: "Repuestos en stock",
    value: "1.248",
    delta: "+36 esta semana",
    tone: "success",
    icon: <BiPackage />,
  },
  {
    id: "orders",
    label: "Pedidos del mes",
    value: "156",
    delta: "ARS 2,4M vendidos",
    tone: "info",
    icon: <BiClipboard />,
  },
]

const activity = [
  { id: 1, text: "Se completó la impresión de «Soporte puerta lavarropas»", meta: "A1 mini · hace 12 min", tone: "success" },
  { id: 2, text: "Trabajo enviado a «P1S · Nave 1»", meta: "Perfil PETG · hace 34 min", tone: "accent" },
  { id: 3, text: "Stock repuesto de «Filtro bomba» sincronizado", meta: "Tienda online · hace 1 h", tone: "info" },
  { id: 4, text: "Impresora «X1C · Nave 2» en mantenimiento", meta: "Requiere calibración · hace 3 h", tone: "warning" },
]

function Inicio() {
  const { user } = useAuthContext()
  const { profile } = useProfile(user?.id)

  const username = profile?.username || ""

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroKicker}>Panel de administración ALPHA BETA V0.1</p>
          <h2 className={styles.heroTitle}>Buen día, {username} 👋</h2>
          <p className={styles.heroText}>
            Gestioná la producción 3D, el inventario y las ventas de RepuestosYa desde un solo lugar.
          </p>
          <div className={styles.heroActions}>
            <Link to="/impresion-3d/granja" className={styles.primaryBtn}>
              Ir a la granja 3D
            </Link>
            <button type="button" className={styles.ghostBtn}>
              Ver reportes
            </button>
          </div>
        </div>
      </section>

      <section className={styles.stats}>
        {stats.map((stat) => (
          <article key={stat.id} className={styles.statCard}>
            <span className={`${styles.statIcon} ${styles[`tone_${stat.tone}`]}`}>
              {stat.icon}
            </span>
            <div className={styles.statBody}>
              <p className={styles.statLabel}>{stat.label}</p>
              <p className={styles.statValue}>{stat.value}</p>
              <p className={styles.statDelta}>{stat.delta}</p>
            </div>
          </article>
        ))}
      </section>

      <section className={styles.grid}>
        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Actividad reciente</h3>
            <button type="button" className={styles.linkBtn}>
              Ver todo
            </button>
          </header>
          <ul className={styles.list}>
            {activity.map((item) => (
              <li key={item.id} className={styles.listItem}>
                <span className={`${styles.listDot} ${styles[`tone_${item.tone}`]}`} />
                <span className={styles.listText}>
                  <span className={styles.listTitle}>{item.text}</span>
                  <span className={styles.listMeta}>{item.meta}</span>
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.panel}>
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Producción 3D</h3>
            <span className={styles.tag}>Hoy</span>
          </header>

          <div className={styles.productionTop}>
            <div>
              <p className={styles.productionValue}>3 / 12</p>
              <p className={styles.productionLabel}>impresoras en uso</p>
            </div>
            <span className={`${styles.statIcon} ${styles.tone_primary}`}>
              <BiPulse />
            </span>
          </div>

          <div className={styles.barTrack}>
            <span className={styles.barFill} style={{ width: "25%" }} />
          </div>

          <ul className={styles.miniStats}>
            <li>
              <span className={styles.miniValue}>3</span>
              <span className={styles.miniLabel}>Imprimiendo</span>
            </li>
            <li>
              <span className={styles.miniValue}>7</span>
              <span className={styles.miniLabel}>Disponibles</span>
            </li>
            <li>
              <span className={styles.miniValue}>2</span>
              <span className={styles.miniLabel}>Mantenimiento</span>
            </li>
          </ul>

          <Link to="/impresion-3d/granja" className={styles.panelAction}>
            Gestionar granja
          </Link>
        </article>
      </section>
    </div>
  )
}

export default Inicio
