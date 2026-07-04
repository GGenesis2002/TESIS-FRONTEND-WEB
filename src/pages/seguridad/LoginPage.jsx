import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginService } from "../../services/authService";
import LogoHeader from "../../components/auth/LogoHeader";
import InputField from "../../components/auth/InputField";
import WatermarkBg from "../../components/auth/WatermarkBg";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Estados para el Selector de Roles (Multi-Rol)
  const [rolesDisponibles, setRolesDisponibles] = useState([]);
  const [mostrarSelector, setMostrarSelector] = useState(false);

  // Estado para mostrar/ocultar la contraseña
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) return setError("Ingresa usuario y contraseña.");
    setError("");
    setLoading(true);
    
    try {
      const data = await loginService(username, password);

      // Guardar token y datos base del usuario inicialmente
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const rolesUsuario = Array.isArray(data.user.roles) 
        ? data.user.roles 
        : [data.user.rol].filter(Boolean);

      if (rolesUsuario.length > 1) {
        // ESCENARIO A: Si tiene múltiples roles, activamos el selector visual
        setRolesDisponibles(rolesUsuario);
        setMostrarSelector(true);
        setLoading(false);
      } else {
        // ESCENARIO B: Si tiene un solo rol asignado
        const unicoRol = rolesUsuario[0] || "Paciente";
        
        // Guardar obligatoriamente el rolActivo que el guardián de rutas necesita
        localStorage.setItem("rolActivo", unicoRol);

        // Guardar el id_usuario_rol correspondiente al único rol
        // (viene en rolesConId[0] desde el backend)
        const rolesConId = data.user.rolesConId || [];
        const rolObj = rolesConId.find(r => r.nombre === unicoRol);
        if (rolObj) {
          const usuarioActual = JSON.parse(localStorage.getItem("user") || "{}");
          usuarioActual.id_usuario_rol = rolObj.id_usuario_rol;
          usuarioActual.rol = unicoRol;
          localStorage.setItem("user", JSON.stringify(usuarioActual));
          // ← clave separada que usa el Navbar para filtrar notificaciones por rol
          localStorage.setItem("idUsuarioRol", rolObj.id_usuario_rol);
        } else {
          const usuarioActualizado = { ...data.user, rol: unicoRol };
          localStorage.setItem("user", JSON.stringify(usuarioActualizado));
        }
        
        ejecutarRedireccion(unicoRol);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Credenciales inválidas o cuenta inaccesible.");
      setLoading(false);
    }
  };

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
    
    ejecutarRedireccion(rol);
  };

  const ejecutarRedireccion = (rol) => {
    const rolNormalizado = rol.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Sincronización estricta con los path de App.jsx
    if (rolNormalizado === "tecnico") {
      navigate("/tecnico/dashboard");
    } else if (rolNormalizado === "asistente analista") {
      navigate("/asistente/dashboard");
    } else if (rolNormalizado === "administrador" || rolNormalizado === "admin") {
      navigate("/admin/dashboard");
    } else if (rolNormalizado === "especialista") {
      navigate("/especialista/dashboard");
    } else if (rolNormalizado === "paciente") {
      // Este panel web es solo para personal del laboratorio. Si el ÚNICO rol
      // activo del usuario es "Paciente" (ej. alguien que solo se registró
      // desde la app móvil), no lo dejamos "flotando" en la raíz sin explicación:
      // le avisamos que use la app móvil y limpiamos lo que se haya guardado.
      localStorage.clear();
      setError("Esta cuenta es de Paciente. Por favor ingresa desde la app móvil.");
      setLoading(false);
      setMostrarSelector(false);
    } else {
      // Rol realmente no reconocido (typo, rol nuevo sin ruta asignada, etc.)
      console.warn(`[Login] Rol "${rol}" no reconocido en el enrutamiento. Redirigiendo a raíz.`);
      navigate("/");
    }
  };

  return (
    <div style={containerStyle}>
      <WatermarkBg />
      <div style={cardStyle}>
        <LogoHeader />

        {error && <div style={errorStyle}>{error}</div>}

        {!mostrarSelector ? (
          // VISTA 1: Formulario Estándar de Login
          <>
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={labelStyle}>Usuario</label>
              <InputField
                type="text"
                placeholder="Ej. usuario123"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label style={labelStyle}>Contraseña</label>
                {/* Enlaces de recuperación alineados */}
                <div style={{ display: "flex", gap: "0.8rem" }}>
                  <span style={linkForgotStyle} onClick={() => navigate("/recuperar-usuario")}>
                    ¿Olvidaste tu usuario?
                  </span>
                  <span style={linkForgotStyle} onClick={() => navigate("/recuperar-contrasena")}>
                    ¿Olvidaste tu clave?
                  </span>
                </div>
              </div>

              {/* Contenedor relativo para poder posicionar el botón de mostrar/ocultar */}
              <div style={{ position: "relative" }}>
                <InputField
                  type={mostrarPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                  style={{ paddingRight: "2.75rem" }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((prev) => !prev)}
                  disabled={loading}
                  aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  title={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  style={eyeButtonStyle}
                >
                  {mostrarPassword ? (
                    // Ícono "ojo tachado" (ocultar)
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.29 20.29 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a20.29 20.29 0 0 1-3.22 4.53M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    // Ícono "ojo" (mostrar)
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button style={btnPrimaryStyle} onClick={handleLogin} disabled={loading}>
              {loading ? "Verificando..." : "Iniciar Sesión"}
            </button>
          </>
        ) : (
          // VISTA 2: Selector Intermedio de Perfiles (Multi-Rol)
          <>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.2rem", fontWeight: 700, color: "#1F2937", textTransform: "uppercase", margin: "0 0 0.5rem 0" }}>
                Selecciona tu Perfil
              </h3>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#6B7280", margin: 0 }}>
                Tu cuenta posee múltiples roles activos asignados:
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {rolesDisponibles.map((rol, index) => (
                <button
                  key={index}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    background: "#F3F4F6",
                    border: "1px solid #E5E7EB",
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
                    e.currentTarget.style.background = "#F3F4F6";
                    e.currentTarget.style.color = "#374151";
                  }}
                  onClick={() => seleccionarRol(rol)}
                >
                  <span>{rol}</span>
                  <span>➔</span>
                </button>
              ))}
            </div>

            <button
              style={{
                width: "100%",
                padding: "0.75rem",
                background: "transparent",
                border: "1px dashed #9CA3AF",
                borderRadius: "8px",
                fontFamily: "'Barlow', sans-serif",
                fontSize: "0.8rem",
                color: "#6B7280",
                cursor: "pointer"
              }}
              onClick={() => {
                setMostrarSelector(false);
                localStorage.clear();
              }}
            >
              Cancelar y volver
            </button>
          </>
        )}

        <div style={footerStyle}>
          Sistema de Laboratorio Clínico con Validación QR
        </div>
      </div>
    </div>
  );
}

const containerStyle = { position: "relative", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#F9FAFB", padding: "1.5rem" };
const cardStyle = { position: "relative", zIndex: 10, width: "100%", maxWidth: "420px", background: "#FFFFFF", padding: "2.5rem 2rem", borderRadius: "16px", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)" };
const errorStyle = { padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" };
const btnPrimaryStyle = { width: "100%", padding: "0.875rem", background: "#1F2937", color: "#FFFFFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" };
const labelStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.15em", color: "#6B7280", textTransform: "uppercase", marginBottom: "0.4rem", display: "block" };
const linkForgotStyle = { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#E88B3A", fontWeight: 500, cursor: "pointer" };
const footerStyle = { marginTop: "2rem", textAlign: "center", fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#6B7280" };
const eyeButtonStyle = {
  position: "absolute",
  right: "0.6rem",
  top: "50%",
  transform: "translateY(-50%)",
  background: "transparent",
  border: "none",
  padding: "0.25rem",
  cursor: "pointer",
  color: "#6B7280",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};