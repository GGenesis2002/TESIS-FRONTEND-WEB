import { useState, useEffect } from "react";
import API from "../../services/api";

export default function PerfilTecnico() {
  const userLocal = JSON.parse(localStorage.getItem("user") || "{}");
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  
  // Estados para control de secciones de edición
  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [editandoInfo, setEditandoInfo] = useState(false);

  // Formularios
  const [passForm, setPassForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [infoForm, setInfoForm] = useState({ nombres: "", apellidos: "", correo: "" });

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/personal/${userLocal.id}`);
      setPerfil(data);
      // Rellenamos el formulario de información con los datos actuales del backend
      setInfoForm({
        nombres: data.nombres || "",
        apellidos: data.apellidos || "",
        correo: data.correo || "",
       
        
      });
    } catch { 
      setPerfil(null); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { 
    cargar(); 
  }, []);

  // Handler para guardar la información personal editada
  const handleGuardarInfo = async () => {
  // 1. Validaciones básicas
  if (!infoForm.nombres || !infoForm.apellidos || !infoForm.correo) {
    return setMsg({ type: "error", text: "Nombres, apellidos y correo son obligatorios." });
  }

  setGuardando(true);
  setMsg(null);

  try {
    // 2. Construcción del objeto completo que el backend exige
    // Incluimos los campos necesarios para que el controlador no reciba undefined/NaN
    const datosAEnviar = {
      nombres: infoForm.nombres,
      apellidos: infoForm.apellidos,
      correo: infoForm.correo,
      // Recuperamos el id_rol del perfil que ya cargaste anteriormente
      id_rol: perfil ? perfil.id_rol : null, 
      // Si el usuario tiene cargo/especialidad/turno, los enviamos también
      username: userLocal.username,
      cargo: perfil?.cargo || null,
      especialidad: perfil?.especialidad || null,
      turno: perfil?.turno || null,
      firma_digital: perfil?.firma_digital || null
    };

    // 3. Petición PUT con los datos completos
    await API.put(`/personal/${userLocal.id}`, datosAEnviar);
    
    setMsg({ type: "success", text: "✓ Información personal actualizada correctamente." });
    setEditandoInfo(false);
    cargar(); // Recargamos para refrescar la interfaz
  } catch (err) {
    // 4. Si falla, el log nos dirá exactamente por qué (el error 500)
    console.error("Error al actualizar:", err.response?.data);
    setMsg({ 
      type: "error", 
      text: err.response?.data?.error || "Error al actualizar los datos. Revisa la consola." 
    });
  } finally { 
    setGuardando(false); 
  }
};

  // Handler para cambiar la contraseña
  const handleCambiarPass = async () => {
    // 1. Validaciones antes de enviar
    if (!passForm.actual) 
      return setMsg({ type: "error", text: "Ingresa tu contraseña actual." });
    if (!passForm.nueva || passForm.nueva.length < 6) 
      return setMsg({ type: "error", text: "La nueva contraseña debe tener al menos 6 caracteres." });
    if (passForm.nueva !== passForm.confirmar) 
      return setMsg({ type: "error", text: "Las contraseñas nuevas no coinciden." });

    setGuardando(true);
    setMsg(null);
    try {
      // 2. API ya agrega el token automáticamente (interceptor en api.js)
      //    Solo enviamos actual y nueva — confirmar es solo validación del frontend
      await API.put('/usuarios/update-password', {
        actual: passForm.actual,
        nueva:  passForm.nueva,
      });

      // 3. Éxito: limpiar formulario y cerrar sección
      setMsg({ type: "success", text: "✓ Contraseña actualizada correctamente." });
      setPassForm({ actual: "", nueva: "", confirmar: "" });
      setCambiandoPass(false);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        setMsg({ type: "error", text: "Contraseña actual incorrecta." });
      } else if (status === 403) {
        setMsg({ type: "error", text: "Sesión expirada. Vuelve a iniciar sesión." });
      } else {
        setMsg({ type: "error", text: err.response?.data?.msg || "Error al cambiar la contraseña." });
      }
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <p style={loadingStyle}>Cargando perfil...</p>;

  return (
    <div style={containerStyle}>

      {/* ── ENCABEZADO ── */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={titleStyle}>
          MI <span style={{ color: "#E88B3A" }}>PERFIL</span>
        </h2>
        <p style={subtitleStyle}>Configuración de cuenta y seguridad</p>
      </div>

      <div style={gridStyle}>

        {/* ── TARJETA AVATAR ── */}
        <div style={avatarCardStyle}>
          <div style={avatarCircleStyle}>
            {userLocal.nombres?.[0]?.toUpperCase() || "T"}
          </div>
          <h3 style={avatarNameStyle}>{perfil?.nombres || userLocal.nombres} {perfil?.apellidos || userLocal.apellidos}</h3>
          <span style={rolBadgeStyle}>TÉCNICO</span>
          <div style={dividerStyle} />
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Usuario</span>
            <span style={infoValueStyle}>@{userLocal.username}</span>
          </div>
          {perfil?.cedula && (
            <div style={infoRowStyle}>
              <span style={infoLabelStyle}>Cédula</span>
              <span style={infoValueStyle}>{perfil.cedula}</span>
            </div>
          )}
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Estado</span>
            <span style={{ ...infoValueStyle, color: "#16A34A", fontWeight: 700 }}>● Activo</span>
          </div>
        </div>

        {/* ── PANEL DERECHO ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Mensajes de feedback (Error / Éxito) */}
          {msg && (
            <div style={{
              padding: "0.75rem 1rem", borderRadius: "8px",
              background: msg.type === "error" ? "#FEF2F2" : "#F0FDF4",
              color: msg.type === "error" ? "#DC2626" : "#16A34A",
              border: `1px solid ${msg.type === "error" ? "#FECACA" : "#BBF7D0"}`,
              fontSize: "0.85rem", fontFamily: "'Barlow', sans-serif",
            }}>
              {msg.text}
            </div>
          )}

          {/* ── INFO PERSONAL ── */}
          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h4 style={panelTitleStyle}>Información Personal</h4>
              <button
                onClick={() => { 
                  if (editandoInfo) cargar(); // Si cancela, deshacemos cambios del formulario
                  setEditandoInfo(!editandoInfo); 
                  setMsg(null); 
                }}
                style={togglePassBtnStyle}
              >
                {editandoInfo ? "Cancelar" : "✏️ Editar Datos"}
              </button>
            </div>

            <div style={twoColStyle}>
              {editandoInfo ? (
                <>
                  {/* Vista en modo edición */}
                  <div style={infoFieldStyle}>
                    <label style={fieldLabelStyle}>Nombres</label>
                    <input 
                      style={passInputStyle}
                      value={infoForm.nombres}
                      onChange={e => setInfoForm({ ...infoForm, nombres: e.target.value })}
                    />
                  </div>
                  <div style={infoFieldStyle}>
                    <label style={fieldLabelStyle}>Apellidos</label>
                    <input 
                      style={passInputStyle}
                      value={infoForm.apellidos}
                      onChange={e => setInfoForm({ ...infoForm, apellidos: e.target.value })}
                    />
                  </div>
                  <div style={infoFieldStyle}>
                    <label style={fieldLabelStyle}>Correo Electrónico</label>
                    <input 
                      style={passInputStyle}
                      type="email"
                      value={infoForm.correo}
                      onChange={e => setInfoForm({ ...infoForm, correo: e.target.value })}
                    />
                  </div>
                 
                 
                  
                  {/* Estos campos se mantienen fijos por seguridad */}
                  <InfoField label="Cédula" value={perfil?.cedula} />
                  <InfoField label="Rol" value={perfil?.rol_nombre || "Técnico"} />
                  <div style={{ gridColumn: "span 2" }}>
                    <InfoField label="Último Acceso" value={perfil?.ultimo_acceso ? new Date(perfil.ultimo_acceso).toLocaleString() : "—"} />
                  </div>

                  <div style={{ gridColumn: "span 2", marginTop: "0.5rem" }}>
                    <button 
                      onClick={handleGuardarInfo} 
                      disabled={guardando} 
                      style={saveBtnStyle}
                    >
                      {guardando ? "Guardando..." : "GUARDAR CAMBIOS"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Vista en modo lectura */}
                  <InfoField label="Nombres" value={perfil?.nombres} />
                  <InfoField label="Apellidos" value={perfil?.apellidos} />
                  <InfoField label="Correo" value={perfil?.correo} />
                  <InfoField label="Cédula" value={perfil?.cedula} />
                  <InfoField label="Rol" value={perfil?.rol_nombre || "Técnico"} />
                  <div style={{ gridColumn: "span 2" }}>
                    <InfoField label="Último Acceso" value={perfil?.ultimo_acceso ? new Date(perfil.ultimo_acceso).toLocaleString() : "—"} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── SEGURIDAD ── */}
          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h4 style={panelTitleStyle}>Seguridad de Cuenta</h4>
              <button
                onClick={() => { setCambiandoPass(!cambiandoPass); setMsg(null); }}
                style={togglePassBtnStyle}
              >
                {cambiandoPass ? "Cancelar" : "🔒 Cambiar Contraseña"}
              </button>
            </div>

            {cambiandoPass ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <PassField
                  label="Contraseña Actual"
                  value={passForm.actual}
                  onChange={v => setPassForm(f => ({ ...f, actual: v }))}
                />
                <PassField
                  label="Nueva Contraseña"
                  value={passForm.nueva}
                  onChange={v => setPassForm(f => ({ ...f, nueva: v }))}
                />
                <PassField
                  label="Confirmar Nueva Contraseña"
                  value={passForm.confirmar}
                  onChange={v => setPassForm(f => ({ ...f, confirmar: v }))}
                />
                <button
                  onClick={handleCambiarPass}
                  disabled={guardando}
                  style={{ ...saveBtnStyle, opacity: guardando ? 0.7 : 1 }}
                >
                  {guardando ? "Guardando..." : "ACTUALIZAR CONTRASEÑA"}
                </button>
              </div>
            ) : (
              <div style={securityInfoStyle}>
                <span style={{ fontSize: "1.5rem" }}>🔐</span>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#6B7280", margin: 0 }}>
                  Tu contraseña está protegida con cifrado bcrypt. Cámbiala periódicamente.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── SUB COMPONENTES ──────────────────────────────────────────────────────────
function InfoField({ label, value }) {
  return (
    <div style={infoFieldStyle}>
      <p style={fieldLabelStyle}>{label}</p>
      <p style={fieldValueStyle}>{value || "—"}</p>
    </div>
  );
}

function PassField({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...passInputStyle, paddingRight: "2.5rem" }}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          style={eyeBtnStyle}
        >
          {show ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const containerStyle    = { padding: "1rem", fontFamily: "'Barlow', sans-serif" };
const loadingStyle      = { textAlign: "center", color: "#6B7280", padding: "3rem", fontFamily: "'Barlow', sans-serif" };
const titleStyle        = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", margin: 0, textTransform: "uppercase" };
const subtitleStyle     = { fontSize: "0.85rem", color: "#6B7280", margin: "0.25rem 0 0", fontFamily: "'Barlow', sans-serif" };
const gridStyle         = { display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" };
const panelStyle        = { background: "#FFF", borderRadius: "12px", padding: "1.5rem", border: "1px solid #F1F5F9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const panelTitleStyle   = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem", fontWeight: 700, color: "#1F2937", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 1.25rem" };
const twoColStyle       = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" };

// Avatar card
const avatarCardStyle   = { background: "#FFF", borderRadius: "12px", padding: "2rem 1.5rem", border: "1px solid #F1F5F9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" };
const avatarCircleStyle = { width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, #E88B3A, #F5A623)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", marginBottom: "1rem" };
const avatarNameStyle   = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.5rem", textTransform: "uppercase" };
const rolBadgeStyle     = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.15em", color: "#E88B3A", background: "rgba(232,139,58,0.1)", padding: "0.3rem 0.75rem", borderRadius: "20px", border: "1px solid rgba(232,139,58,0.2)" };
const dividerStyle      = { width: "100%", height: "1px", background: "#F1F5F9", margin: "1rem 0" };
const infoRowStyle      = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0" };
const infoLabelStyle    = { fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF" };
const infoValueStyle    = { fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#374151", fontWeight: 600 };

// Info fields
const infoFieldStyle    = { background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem 1rem", display: "flex", flexDirection: "column", justifyContent: "center" };
const fieldLabelStyle   = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.25rem", display: "block" };
const fieldValueStyle   = { fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "#1F2937", margin: 0 };

// Seguridad
const togglePassBtnStyle = { background: "rgba(232,139,58,0.1)", border: "1px solid rgba(232,139,58,0.2)", color: "#E88B3A", padding: "0.5rem 1rem", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", outline: "none" };
const securityInfoStyle  = { display: "flex", alignItems: "center", gap: "1rem", background: "#F8FAFC", borderRadius: "8px", padding: "1rem" };
const passInputStyle     = { width: "100%", padding: "0.5rem 0.7rem", border: "1.5px solid #E5E7EB", borderRadius: "6px", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#1F2937", background: "#FFF", outline: "none", boxSizing: "border-box" };
const eyeBtnStyle        = { position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "0.25rem" };
const saveBtnStyle       = { width: "100%", padding: "0.75rem", background: "#1F2937", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.1em", cursor: "pointer", textTransform: "uppercase" };