import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import marcaAgua from "../../assets/marcaAgua.png";

const menus = {
  administrador: [
    { label: "Dashboard",           path: "/admin/dashboard",           icon: "⊞" },
    { label: "Pacientes",           path: "/admin/pacientes",           icon: "👤" },
    { label: "Órdenes Médicas",     path: "/admin/ordenes",             icon: "📋" },
    { label: "Inventario",          path: "/admin/inventario",          icon: "📦" },
    { label: "Resultados Clínicos", path: "/admin/resultados",          icon: "✅" },
    { label: "Perfil",              path: "/admin/perfil",              icon: "⚙️" },
  ],
  tecnico: [
    { label: "Dashboard",              path: "/tecnico/dashboard",           icon: "⊞" },
    { label: "Gestión de Personal",    path: "/tecnico/usuarios",            icon: "👥" },
    { label: "Gestión de Pacientes",   path: "/tecnico/pacientes",           icon: "👤" },
    { label: "Configuración Sistema",  path: "/tecnico/configuracion",       icon: "⚙️" },
    { label: "Parámetros Exámenes",    path: "/tecnico/parametros-examenes", icon: "🔬" },
    { label: "Perfil",                 path: "/tecnico/perfil",              icon: "👤" }
  ],
"asistente analista": [
    { label: "Dashboard",            path: "/asistente/dashboard",         icon: "⊞" },
    { label: "Gestión de Pacientes", path: "/asistente/pacientes",         icon: "👤" },
    { label: "Gestión de Órdenes",   path: "/asistente/ordenes",           icon: "📋" },
    { label: "Caja y Facturación",   path: "/asistente/caja",              icon: "💵" },
    { label: "Toma de Muestras",     path: "/asistente/muestras",          icon: "🧪" },
    { label: "Perfil",              path: "/asistente/perfil",     icon: "👤" }
  ],
  // 💡 ESPECIALISTA: Solo Dashboard, Resultados Clínicos y Perfil (Sin pacientes ni parámetros)
  especialista: [
    { label: "Dashboard",           path: "/especialista/dashboard",  icon: "⊞" },
    { label: "Resultados Clínicos", path: "/especialista/resultados", icon: "✅" }, 
    { label: "Perfil",              path: "/especialista/perfil",     icon: "👤" }
  ]
};

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [rolVisual, setRolVisual] = useState("");

  useEffect(() => {
    // Escucha de manera reactiva el rol activo de la sesión actual
    const rolActual = localStorage.getItem("rolActivo") || "";
    setRolVisual(rolActual);
  }, [location]);

  // Normalizador estricto para evitar fallos por minúsculas, mayúsculas o acentos de la BD
  const normalizarTexto = (str) => 
    str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

  const rolNormalizado = normalizarTexto(rolVisual);
  
  // Si no encuentra el rol por un problema externo, usa "tecnico" como contingencia
  const menuItems = menus[rolNormalizado] || menus["tecnico"];

  return (
    <div style={{
      width: collapsed ? "70px" : "240px",
      minHeight: "100vh",
      background: "#1E293B",
      color: "#FFF",
      position: "fixed",
      top: 0,
      left: 0,
      transition: "width 0.3s ease",
      zIndex: 100,
      display: "flex",
      flexDirection: "column",
      boxShadow: "2px 0 10px rgba(0,0,0,0.1)"
    }}>
      {/* Cabecera del Laboratorio */}
      <div style={{ display: "flex", alignItems: "center", padding: "1.25rem 1rem", minHeight: "70px", justifyContent: collapsed ? "center" : "space-between" }}>
        {!collapsed && (
          <div>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem", fontWeight: 800, color: "#E88B3A", margin: 0, letterSpacing: "0.05em" }}>
              LABORATORIO
            </h1>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.6rem", letterSpacing: "0.15em", color: "#94A3B8", margin: 0, textTransform: "uppercase" }}>
              Validación QR
            </p>
          </div>
        )}
        <button onClick={onToggle} style={{ background: "none", border: "none", color: "#E88B3A", cursor: "pointer", fontSize: "1.2rem" }}>
          {collapsed ? "❯" : "❮"}
        </button>
      </div>

      <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "0 1rem" }} />

      {/* Identificador de Perfil Activo */}
      {!collapsed && rolVisual && (
        <div style={{ margin: "0.75rem 1rem", padding: "0.4rem 0.75rem", background: "rgba(232,139,58,0.1)", borderRadius: "6px", border: "1px solid rgba(232,139,58,0.2)", textAlign: "center" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color: "#E88B3A", textTransform: "uppercase" }}>
            Perfil: {rolVisual}
          </span>
        </div>
      )}

      {/* Renderizado de Opciones de Menú */}
      <nav style={{ flex: 1, padding: "1rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {menuItems.map((item, index) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={index}
              onClick={() => navigate(item.path)}
              style={{
                width: "100%",
                border: "none",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                padding: "0.75rem 1rem",
                background: isActive ? "#E88B3A" : "transparent",
                color: isActive ? "#FFFFFF" : "#94A3B8",
                cursor: "pointer",
                transition: "all 0.2s ease",
                textAlign: "left",
                gap: "0.75rem"
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "#FFFFFF";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94A3B8";
                }
              }}
            >
              <span style={{ fontSize: "1.1rem" }}>{item.icon}</span>
              {!collapsed && (
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", fontWeight: isActive ? 600 : 500 }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div style={{ padding: "1rem", textAlign: "center", opacity: 0.15 }}>
          <img src={marcaAgua} alt="Watermark" style={{ maxWidth: "80px" }} />
        </div>
      )}
    </div>
  );
}