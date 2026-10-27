import { AuthProvider } from "./contexts/AuthContext.jsx"
import { ProtectedRoute } from "./components/auth/ProtectedRoute.jsx"
import AdminLayout from "./components/layout/AdminLayout.jsx"
import Login from "./pages/auth/Login.jsx"
import Perfil from "./pages/perfil/Perfil.jsx"
import Inicio from "./pages/inicio/Inicio.jsx"
import Impresion3DLayout from "./pages/impresion3d/Impresion3DLayout.jsx"
import Granja from "./pages/impresion3d/granja/Granja.jsx"
import Calculadora from "./pages/impresion3d/calculadora/Calculadora.jsx"
import GestionarReleases from "./pages/administrador/GestionarReleases.jsx"
import { Navigate, Route, Routes } from "react-router-dom"

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Inicio />} />
          <Route path="impresion-3d" element={<Impresion3DLayout />}>
            <Route index element={<Navigate to="granja" replace />} />
            <Route path="granja" element={<Granja />} />
            <Route path="calculadora" element={<Calculadora />} />
          </Route>
          <Route path="administrador/releases" element={<GestionarReleases />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

export default App
