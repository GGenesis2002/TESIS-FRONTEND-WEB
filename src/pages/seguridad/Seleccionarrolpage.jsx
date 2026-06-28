import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import LogoHeader from "../../components/auth/LogoHeader";
import WatermarkBg from "../../components/auth/WatermarkBg";

// ─── REDIRECCIÓN POR ROL (misma lógica que LoginPage) ────────────────────────
function ejecutarRedireccion(navigate, rol) {
  const rolNormalizado = rol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (rolNormalizado === "tecnico") {
    navigate("/tecnico/dashboard");
  } else if (rolNormalizado === "asistente analista") {
    navigate("/asistente/dashboard");
  } else if (rolNormalizado === "administrador" || rolNormalizado === "admin") {
    navigate("/admin/dashboard");
  } else if (rolNormalizado === "especialista") {
    navigate("/especialista/dashboard");
  } else {
    console.warn(`[CambiarRol] Rol "${rol}" no reconocido en el enrutamiento. Redirigiendo a raíz.`);
    navigate("/");
  }
}

export default function SeleccionarRolPage() {
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [rolActivoActual, setRolActivoActual] = useState("");
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    let user = {};
    try { user = JSON.parse(localStorage.getItem("user") || "{}"); } catch { /* noop */ }

    const listaRoles = Array.isArray(user.roles) ? user.roles : [];

    if (listaRoles.length < 2) {
      // El usuario solo tiene un rol: no tiene sentido mostrar el selector.
      navigate(-1);
      return;
    }

    setRoles(listaRoles);
    setRolActivoActual(localStorage.getItem("rolActivo") || "");
    setListo(true);
  }, [navigate]);

  const seleccionarRol = (rol) => {
    localStorage.setItem("rolActivo", rol);

    const userStr = localStorage.getItem("user");
    if (userStr) {
      const parsed = JSON.parse(userStr);

      // Buscar el id_usuario_rol que corresponde al rol elegido
      const rolesConId = parsed.rolesConId || [];
      const rolObj = rolesConId.find(r => r.nombre === rol);
      if (rolObj) {
        parsed.id_usuario_rol = rolObj.id_usuario_rol;
        // ← clave separada que usa el Navbar para filtrar notificaciones por rol
        localStorage.setItem("idUsuarioRol", rolObj.id_usuario_rol);
      }

      parsed.rol = rol;
      localStorage.setItem("user", JSON.stringify(parsed));
    }

    ejecutarRedireccion(navigate, rol);
  };

  // Evita el parpadeo mientras se valida sesión / roles
  if (!listo) return null;

  return (
    <div style={containerStyle}>
      <WatermarkBg />
      <div style={cardStyle}>
        <LogoHeader subtitle="Cambiar de Perfil" />

        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#6B7280", margin: 0 }}>
            Tu cuenta tiene varios perfiles asignados. Elige con cuál deseas continuar:
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {roles.map((rol, index) => {
            const esActual = rol === rolActivoActual;
            return (
              <button
                key={index}
                style={{
                  width: "100%",
                  padding: "1rem",
                  background: esActual ? "#FFF7ED" : "#F3F4F6",
                  border: esActual ? "1px solid #E88B3A" : "1px solid #E5E7EB",
                  borderRadius: "8px",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                  color: "#374151",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#1F2937";
                  e.currentTarget.style.color = "#FFFFFF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = esActual ? "#FFF7ED" : "#F3F4F6";
                  e.currentTarget.style.color = "#374151";
                }}
                onClick={() => seleccionarRol(rol)}
              >
                <span>{rol}{esActual ? "  ·  Perfil actual" : ""}</span>
                <span>➔</span>
              </button>
            );
          })}
        </div>

        <button style={btnVolverStyle} onClick={() => navigate(-1)}>
          ← Volver sin cambiar
        </button>
      </div>
    </div>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const containerStyle = { position: "relative", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#F9FAFB", padding: "1.5rem" };
const cardStyle = { position: "relative", zIndex: 10, width: "100%", maxWidth: "420px", background: "#FFFFFF", padding: "2.5rem 2rem", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)" };
const btnVolverStyle = {
  width: "100%",
  padding: "0.75rem",
  background: "transparent",
  border: "1px dashed #9CA3AF",
  borderRadius: "8px",
  fontFamily: "'Barlow', sans-serif",
  fontSize: "0.8rem",
  color: "#6B7280",
  cursor: "pointer",
};