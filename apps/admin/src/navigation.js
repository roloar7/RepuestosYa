export const navSections = [
  {
    id: "principal",
    label: "Principal",
    items: [{ to: "/", label: "Inicio", icon: "home", end: true }],
  },
  {
    id: "produccion",
    label: "Producción",
    items: [
      {
        to: "/impresion-3d",
        label: "Impresión 3D",
      },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    items: [
      { to: "/tienda", label: "Tienda", icon: "cart", disabled: true },
      { to: "/mercado-libre", label: "Mercado Libre", icon: "tag", disabled: true },
      { to: "/ventas", label: "Ventas", icon: "clipboard", disabled: true },
      { to: "/inventario", label: "Inventario", icon: "box", disabled: true },
      { to: "/clientes", label: "Clientes", icon: "users", disabled: true },
      { to: "/configuracion", label: "Configuración", icon: "settings", disabled: true },
    ],
  },
  {
    id: "administrador",
    label: "Administrador",
    items: [
      { to: "/administrador/releases", label: "Gestionar Releases", icon: "download" },
    ],
  },
]

function matches(item, pathname) {
  if (item.end) return pathname === item.to
  if (item.to === "/") return pathname === "/"
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}

export function findTrail(pathname) {
  for (const section of navSections) {
    for (const item of section.items) {
      if (item.disabled) continue
      if (item.children) {
        const child = item.children.find((c) => matches(c, pathname))
        if (child) return { section: section.label, parent: item, current: child }
        if (matches(item, pathname)) {
          return { section: section.label, parent: item, current: null }
        }
      } else if (matches(item, pathname)) {
        return { section: section.label, parent: null, current: item }
      }
    }
  }
  return { section: "Panel", parent: null, current: null }
}

export function resolveTitle(pathname) {
  const trail = findTrail(pathname)
  return trail.current?.label ?? trail.parent?.label ?? "Inicio"
}
