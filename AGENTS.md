# AGENTS.md

## Project layout
pnpm monorepo. The repository root is a workspace (see `pnpm-workspace.yaml`).
- `apps/admin/` — Panel de administración (React + Vite SPA; luego empaquetado con Electron).
- `packages/config/` — configs compartidas (oxlint base).
- `packages/ui/` — componentes y design tokens compartidos (`src/tokens.css`).
- `packages/supabase/` — cliente Supabase y queries compartidas.
- `packages/printer-bridge/` — servicio Node que habla con las impresoras Bambu por LAN.

Future (not yet scaffolded): `apps/store`, `apps/mobile`, `supabase/`.

## Stack
- Vite + React 19 (plain JSX, **no TypeScript** despite `@types/*` deps).
- Package manager: **pnpm** workspaces. Don't use npm/yarn.
- Linting uses **oxlint**, not ESLint. Config: `apps/admin/.oxlintrc.json` (base in `packages/config/oxlint.base.json`).
- Styling: CSS Modules + design tokens (`@repuestos-ya/ui`).

## Commands
From the repo root:
- `pnpm dev` — Vite dev server for `apps/admin` with HMR
- `pnpm build` — build all workspaces
- `pnpm lint` — oxlint across all workspaces (this is the lint/verify step)
- `pnpm preview` — serve the built admin output

From `apps/admin/`: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm preview`.
From `packages/printer-bridge/`: `pnpm dev` — runs the local printer bridge scaffold.

## Responsive (tienda y admin)
- Enfoque: **desktop-first**. Base escritorio + ajustes con `@media (max-width: X)`.
- Escala canónica de breakpoints (usar estos valores en todo el ecosistema):
  - `--bp-sm: 480px` — teléfono
  - `--bp-md: 768px` — tablet vertical
  - `--bp-lg: 1024px` — tablet horizontal / cambio de layout
  - `--bp-2xl: 1280px` — escritorio
- No duplicar la escala: escribir los valores literales consistentemente. No se usan `@custom-media` (sin PostCSS).
- Reglas duras:
  - Grillas: `minmax(min(100%, Npx), 1fr)`; nada de `minmax(330px)` fijo que desborde en <360px.
  - Textos largos con `overflow-wrap: anywhere`; truncar con elipsis + `min-width: 0` en items flex/grid.
  - Nada de hover-only (máquinas táctiles); targets táctiles ≥ 44px.
  - Imágenes con `srcset`/`max-width: 100%`; skeleton/loading debe respetar el layout.
- Admin: sidebar = **drawer off-canvas** en `≤1024px` (estado en `AdminLayout` + `useMediaQuery`), con backdrop, bloqueo de scroll y cierre al cambiar de ruta. En desktop colapsa a riel de íconos.
- Base compartida: `@repuestos-ya/ui/responsive.css` (reset mínimo + `.container` + `prefers-reduced-motion`) y tokens fluidos `--text-*` / `--space-*` en `tokens.css`.
- Tienda futura: filtros en drawer, navegación/bottom-bar en móvil, grillas de producto fluidas.

## Notes
- No test framework is configured; there is no test script.
- Admin entrypoint: `src/main.jsx` → `src/App.jsx` (routes). Layout: `src/components/layout/` (`AdminLayout`, `Sidebar`, `Navbar`). Pages: `src/pages/`. Icons: `src/components/icons.jsx` (+ `iconMap.js`). Nav config: `src/navigation.js`.
- Backend is **Supabase** (Postgres + Auth + Storage + Realtime + RLS); no custom Node/Express core.
- Printer control (Bambu LAN) runs through `packages/printer-bridge`; browsers cannot open MQTT/FTPS sockets directly.
