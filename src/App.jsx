import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

import LoginPage from "./pages/seguridad/LoginPage";
import RecuperarContrasenaPage from "./pages/seguridad/RecuperarContrasenaPage";
import RecuperarUsuarioPage from "./pages/seguridad/RecuperarUsuarioPage";

import GestionPacientes from "./pages/pacientes/GestionPacientes";

import TecnicoLayout from "./components/layout/TecnicoLayout";
import AsistenteLayout from "./components/layout/Asistentelayout"; 

import DashboardTecnico from "./pages/tecnico/DashboardTecnico";
import GestionUsuarios from "./pages/tecnico/GestionUsuarios";
import ConfiguraciónSistema from "./pages/tecnico/ConfiguracionSistema"; 
import ParametrosExamenes from "./pages/tecnico/ParametrosExamenes";
import PerfilTecnico from "./pages/tecnico/PerfilTecnico";

import DashboardAsistente from "./pages/asistente_analista/Dashboardasistente"; 
import GestionOrdenes from "./pages/asistente_analista/Gestionordenes"; 
import Modulocaja from "./pages/asistente_analista/Modulocaja"; 
import Modulomuestra from "./pages/asistente_analista/Modulomuestra"; 
import PerfilAnalista from "./pages/asistente_analista/PerfilAnalista";

import AdminLayout from "./components/layout/AdminLayout";
import AdminDashboard from "./pages/admin/Admindashboard";
import AdminInventario from "./pages/admin/Admininventario";
import AdminPerfil from "./pages/admin/Adminperfil";
import AdminResultados from "./pages/admin/Adminresultados";


// Layout del Especialista
import EspecialistaLayout from "./components/layout/EspecialistaLayout";

// Páginas del Especialista
import DashboardEspecialista from "./pages/especialista/DashboardEspecialista";
import EspecialistaResultados from "./pages/especialista/EspecialistaResultados";
import PerfilEspecialista from "./pages/especialista/PerfilEspecialista";

// GUARDIÁN TOLERANTE A TILDES: Valida las credenciales sin importar acentos
function RutaProtegida({ children, rolesPermitidos }) {
  const token = localStorage.getItem("token");
  const rolActivo = localStorage.getItem("rolActivo");
  
  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (rolesPermitidos) {
    // Convierte a minúsculas, remueve espacios y elimina tildes/acentos
    const normalizar = (str) => 
      str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

    const rolActivoNormalizado = normalizar(rolActivo);
    const rolesPermitidosNormalizados = rolesPermitidos.map(rol => normalizar(rol));

    if (!rolesPermitidosNormalizados.includes(rolActivoNormalizado)) {
      console.warn(`[Guardia] Acceso denegado para el perfil activo: "${rolActivo}".`);
      return <Navigate to="/" replace />;
    }
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas Públicas */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/recuperar-contrasena" element={<RecuperarContrasenaPage />} />
        <Route path="/recuperar-usuario" element={<RecuperarUsuarioPage />} />

        <Route 
          path="/tecnico" 
          element={
            <RutaProtegida rolesPermitidos={["Tecnico"]}>
              <TecnicoLayout />
            </RutaProtegida>
          }
        >
          <Route path="dashboard" element={<DashboardTecnico />} />
          <Route path="usuarios" element={<GestionUsuarios />} />
          <Route path="pacientes" element={<GestionPacientes />} />
          <Route path="configuracion" element={<ConfiguraciónSistema />} />
          <Route path="parametros-examenes" element={<ParametrosExamenes />} />
          <Route path="perfil" element={<PerfilTecnico />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Sección Asistente */}
        <Route 
          path="/asistente" 
          element={
            <RutaProtegida rolesPermitidos={["Asistente Analista", "Administrador"]}>
              <AsistenteLayout />
            </RutaProtegida>
          }
        >
          <Route path="dashboard" element={<DashboardAsistente />} />
          <Route path="pacientes" element={<GestionPacientes />} />
          <Route path="ordenes" element={<GestionOrdenes />} />
          <Route path="caja" element={<Modulocaja />} />
          <Route path="muestras" element={<Modulomuestra />} />
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="perfil" element={<PerfilAnalista />} />
        </Route>

        {/* Sección Administrador (Ruta Protegida para Administradores) */}
        <Route 
          path="/admin" 
          element={
            <RutaProtegida rolesPermitidos={["Administrador"]}>
              <AdminLayout />
            </RutaProtegida>
          }
        >
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="pacientes" element={<GestionPacientes />} />
          <Route path="ordenes" element={<GestionOrdenes />} />
          <Route path="inventario" element={<AdminInventario />} />
          <Route path="resultados" element={<AdminResultados />} />
          <Route path="perfil" element={<AdminPerfil />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Sección Especialista (Ruta Protegida) */}
        <Route 
          path="/especialista" 
          element={
            <RutaProtegida rolesPermitidos={["Especialista"]}>
              <EspecialistaLayout />
            </RutaProtegida>
          }
        >
          <Route path="dashboard" element={<DashboardEspecialista />} />
          <Route path="resultados" element={<EspecialistaResultados />} />
          <Route path="perfil" element={<PerfilEspecialista />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;