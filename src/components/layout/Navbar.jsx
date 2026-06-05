import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMisNotificaciones, marcarLeida, eliminarNotificacion } from "../../services/notificacionService";

export default function Navbar({ collapsed }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [notifs, setNotifs] = useState([]);
  const [totalNoLeidas, setTotalNoLeidas] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPerfil, setShowPerfil] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  // ── Rol activo: se lee en tiempo real desde localStorage ──
  const getRolActivoId = () => {
    const raw = localStorage.getItem("idUsuarioRol");
    return raw ? parseInt(raw) : null;
  };

  const notifRef = useRef(null);
  const perfilRef = useRef(null);

  // ── Cargar notificaciones filtradas por usuario + rol activo ──
  const cargarNotificaciones = async () => {
    setLoadingNotifs(true);
    try {
      const data = await getMisNotificaciones(getRolActivoId());
      setNotifs(data.notificaciones || []);
      setTotalNoLeidas(data.totalNoLeidas || 0);
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
      setNotifs([]);
      setTotalNoLeidas(0);
    } finally {
      setLoadingNotifs(false);
    }
  };

  // ── Recargar al montar + polling cada 30s ──
  useEffect(() => {
    cargarNotificaciones();
    const interval = setInterval(cargarNotificaciones, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── CORRECCIÓN: Escuchar el evento personalizado "rolCambiado" ──
  // localStorage no es reactivo en React. Cuando el usuario cambia de rol,
  // el componente que hace el cambio debe disparar: 
  //   window.dispatchEvent(new CustomEvent("rolCambiado"))
  // y este useEffect se encarga de recargar las notificaciones del nuevo rol.
  useEffect(() => {
    const handleRolCambiado = () => {
      cargarNotificaciones();
    };
    window.addEventListener("rolCambiado", handleRolCambiado);
    return () => window.removeEventListener("rolCambiado", handleRolCambiado);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cerrar dropdowns al click fuera ──
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
      if (perfilRef.current && !perfilRef.current.contains(e.target)) {
        setShowPerfil(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Marcar notificación como leída ──
  const handleMarcarLeida = async (id) => {
    try {
      await marcarLeida(id);
      setNotifs(prev =>
        prev.map(n =>
          n.id_notificacion === id ? { ...n, leido: true } : n
        )
      );
      setTotalNoLeidas(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error al marcar como leída:", error);
    }
  };

  // ── Eliminar notificación ──
  const handleEliminarNotif = async (id) => {
    try {
      await eliminarNotificacion(id);
      const notifEliminada = notifs.find(n => n.id_notificacion === id);
      setNotifs(prev => prev.filter(n => n.id_notificacion !== id));
      if (notifEliminada && !notifEliminada.leido) {
        setTotalNoLeidas(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error("Error al eliminar notificación:", error);
    }
  };

  // ── Logout ──
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("rolActivo");
    localStorage.removeItem("idUsuarioRol");
    navigate("/");
  };

  // ── Navegar a perfil según rol ACTIVO ──
  const handleIrAlPerfil = () => {
    const rolActivo = (localStorage.getItem("rolActivo") || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    const rutas = {
      administrador:        "/admin/perfil",
      tecnico:              "/tecnico/perfil",
      "asistente analista": "/asistente/perfil",
      especialista:         "/especialista/perfil",
    };

    const ruta = rutas[rolActivo] || "/admin/perfil";
    navigate(ruta);
    setShowPerfil(false);
  };

  return (
    <div
      style={{
        ...navbarStyle,
        left: collapsed ? "70px" : "240px",
        width: `calc(100% - ${collapsed ? "70px" : "240px"})`,
        transition: "left 0.3s ease, width 0.3s ease",
      }}
    >
      {/* ── LADO IZQUIERDO: Título ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <div style={accentDotStyle} />
        <span style={pageTitle}>{getPageTitle(window.location.pathname)}</span>
      </div>

      {/* ── LADO DERECHO: Notificaciones + Perfil ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>

        {/* ════════════════════════════════════════
            CAMPANA DE NOTIFICACIONES
        ════════════════════════════════════════ */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => {
              setShowNotifs(s => !s);
              setShowPerfil(false);
              if (!showNotifs) cargarNotificaciones();
            }}
            style={iconBtnStyle}
            title="Notificaciones"
          >
            🔔
            {totalNoLeidas > 0 && (
              <span style={badgeStyle}>{totalNoLeidas}</span>
            )}
          </button>

          {/* Dropdown Notificaciones */}
          {showNotifs && (
            <div style={dropdownStyle}>
              <div style={dropdownHeaderStyle}>
                <span style={dropdownTitleStyle}>Notificaciones</span>
                {totalNoLeidas > 0 && (
                  <span style={{ fontSize: "0.7rem", color: "#E88B3A", fontWeight: 700 }}>
                    {totalNoLeidas} sin leer
                  </span>
                )}
              </div>

              {/* Lista notificaciones */}
              <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                {loadingNotifs ? (
                  <div style={emptyNotifStyle}>Cargando...</div>
                ) : notifs.length === 0 ? (
                  <div style={emptyNotifStyle}>
                    <span style={{ fontSize: "1.5rem", marginBottom: "0.5rem", display: "block" }}>🔔</span>
                    Sin notificaciones
                  </div>
                ) : (
                  notifs.map(n => (
                    <div
                      key={n.id_notificacion}
                      style={{
                        ...notifItemStyle,
                        background: n.leido ? "transparent" : "rgba(232,139,58,0.05)",
                        borderLeft: n.leido ? "3px solid transparent" : "3px solid #E88B3A",
                      }}
                    >
                      <p style={notifMsgStyle}>{n.mensaje}</p>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.35rem" }}>
                        <span style={notifDateStyle}>
                          {formatearFecha(n.fecha)}
                        </span>

                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          {!n.leido && (
                            <button
                              onClick={() => handleMarcarLeida(n.id_notificacion)}
                              style={markReadBtnStyle}
                              title="Marcar como leída"
                            >
                              ✓
                            </button>
                          )}
                          <button
                            onClick={() => handleEliminarNotif(n.id_notificacion)}
                            style={{ ...markReadBtnStyle, color: "#DC2626" }}
                            title="Eliminar"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {notifs.length > 0 && (
                <div style={dropdownFooterStyle}>
                  <button
                    onClick={cargarNotificaciones}
                    style={{
                      width: "100%",
                      padding: "0.5rem",
                      background: "none",
                      border: "none",
                      color: "#E88B3A",
                      fontFamily: "'Barlow', sans-serif",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    ↻ Actualizar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════
            DROPDOWN PERFIL
        ════════════════════════════════════════ */}
        <div ref={perfilRef} style={{ position: "relative" }}>
          <button
            onClick={() => {
              setShowPerfil(s => !s);
              setShowNotifs(false);
            }}
            style={perfilBtnStyle}
            title="Perfil y opciones"
          >
            {/* Avatar */}
            <div style={avatarStyle}>
              {user.nombres?.[0]?.toUpperCase() || "U"}
            </div>

            {/* Info usuario */}
            <div style={{ textAlign: "left" }}>
              <p style={userNameStyle}>
                {user.nombres} {user.apellidos}
              </p>
              <p style={userRolStyle}>
                {localStorage.getItem("rolActivo") || user.rol}
              </p>
            </div>
          </button>

          {/* Dropdown Perfil */}
          {showPerfil && (
            <div style={{ ...dropdownStyle, right: 0, minWidth: "200px" }}>
              <button onClick={handleIrAlPerfil} style={dropdownItemStyle}>
                ⚙️ Editar Perfil
              </button>
              <div style={{ height: "1px", background: "#F3F4F6", margin: "0.25rem 0" }} />
              <button
                onClick={handleLogout}
                style={{ ...dropdownItemStyle, color: "#DC2626" }}
              >
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── HELPER: Formatear fecha ──
function formatearFecha(fecha) {
  if (!fecha) return "—";
  const d = new Date(fecha);
  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";

  return d.toLocaleDateString("es-EC", { month: "short", day: "numeric" });
}

// ── HELPER: Títulos de página ──
function getPageTitle(path) {
  const map = {
    "dashboard": "Dashboard Analítico",
    "pacientes": "Gestión de Pacientes",
    "ordenes": "Órdenes Médicas",
    "inventario": "Inventario de Insumos",
    "procesamiento": "Procesamiento de Exámenes",
    "resultados": "Resultados Clínicos",
    "perfil": "Configuración de Perfil",
    "usuarios": "Gestión de Usuarios",
    "parametros-examenes": "Parámetros de Exámenes",
    "pagos": "Gestión de Pagos",
    "muestras": "Toma de Muestras",
    "auditoria": "Auditoría del Sistema",
    "configuracion": "Configuración del Sistema",
  };
  const segment = path.split("/").filter(Boolean).pop();
  return map[segment] || "Sistema Laboratorio Cárdenas-Garofalo";
}

// ─── ESTILOS ────────────────────────────────────────────────────────────────
const navbarStyle = {
  position: "fixed", top: 0, right: 0, height: "64px",
  background: "#FFFFFF", borderBottom: "1px solid #F1F5F9",
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "0 1.5rem", zIndex: 99,
  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
};
const accentDotStyle = {
  width: "8px", height: "8px", borderRadius: "50%", background: "#E88B3A",
};
const pageTitle = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  fontSize: "1.1rem", letterSpacing: "0.05em", color: "#1F2937",
  textTransform: "uppercase",
};
const iconBtnStyle = {
  background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px",
  width: "38px", height: "38px", cursor: "pointer", position: "relative",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem",
};
const badgeStyle = {
  position: "absolute", top: "-6px", right: "-6px",
  background: "#E88B3A", color: "#FFF", borderRadius: "50%",
  width: "18px", height: "18px", fontSize: "0.65rem", fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "'Barlow', sans-serif",
};
const perfilBtnStyle = {
  display: "flex", alignItems: "center", gap: "0.75rem",
  background: "#F8FAFC", border: "1px solid #E2E8F0",
  borderRadius: "10px", padding: "0.4rem 0.75rem", cursor: "pointer",
};
const avatarStyle = {
  width: "32px", height: "32px", borderRadius: "50%",
  background: "linear-gradient(135deg, #E88B3A, #F5A623)",
  color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem",
};
const userNameStyle = {
  fontFamily: "'Barlow', sans-serif", fontWeight: 600,
  fontSize: "0.8rem", color: "#1F2937", margin: 0,
};
const userRolStyle = {
  fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF", margin: 0,
};
const dropdownStyle = {
  position: "absolute", top: "calc(100% + 8px)", right: 0,
  background: "#FFFFFF", borderRadius: "12px",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)", border: "1px solid #F1F5F9",
  minWidth: "320px", zIndex: 200, overflow: "hidden",
};
const dropdownHeaderStyle = {
  padding: "0.875rem 1rem", borderBottom: "1px solid #F1F5F9",
  display: "flex", justifyContent: "space-between", alignItems: "center",
};
const dropdownTitleStyle = {
  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
  fontSize: "0.85rem", letterSpacing: "0.1em", color: "#1F2937",
  textTransform: "uppercase",
};
const dropdownFooterStyle = { padding: "0.5rem 0", borderTop: "1px solid #F1F5F9" };
const dropdownItemStyle = {
  width: "100%", padding: "0.75rem 1rem", background: "none", border: "none",
  textAlign: "left", cursor: "pointer", fontFamily: "'Barlow', sans-serif",
  fontSize: "0.85rem", color: "#374151", display: "flex", alignItems: "center", gap: "0.5rem",
};
const notifItemStyle = {
  padding: "0.75rem 1rem", borderBottom: "1px solid #F8FAFC", cursor: "default",
};
const notifMsgStyle = {
  fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem",
  color: "#374151", margin: 0, lineHeight: 1.4,
};
const notifDateStyle = {
  fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#9CA3AF",
};
const markReadBtnStyle = {
  background: "none", border: "none", color: "#E88B3A", fontSize: "0.72rem",
  cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 600,
  padding: "0.2rem 0.4rem", borderRadius: "4px",
};
const emptyNotifStyle = {
  padding: "2rem 1rem", textAlign: "center", color: "#9CA3AF",
  fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem",
};