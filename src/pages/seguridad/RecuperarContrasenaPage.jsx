import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { solicitarCodigoService, validarCodigoService } from "../../services/authService";
import LogoHeader from "../../components/auth/LogoHeader";
import InputField from "../../components/auth/InputField";
import WatermarkBg from "../../components/auth/WatermarkBg";

export default function RecuperarContrasenaPage() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaPass, setNuevaPass] = useState("");
  const [confirmarPass, setConfirmarPass] = useState("");
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [loadingCambio, setLoadingCambio] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "error" | "success", text: "" }

  const handleEnviarCodigo = async () => {
    if (!correo) return setMsg({ type: "error", text: "Ingresa tu correo electrónico." });
    setMsg(null);
    setLoadingCodigo(true);
    try {
      await solicitarCodigoService(correo);
      setCodigoEnviado(true);
      setMsg({ type: "success", text: "✓ Código enviado. Revisa tu bandeja de entrada." });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Correo no registrado." });
    } finally {
      setLoadingCodigo(false);
    }
  };

  const handleCambiarPassword = async () => {
    if (!codigo) return setMsg({ type: "error", text: "Ingresa el código recibido." });
    if (!nuevaPass || !confirmarPass) return setMsg({ type: "error", text: "Completa los campos de contraseña." });
    if (nuevaPass !== confirmarPass) return setMsg({ type: "error", text: "Las contraseñas no coinciden." });
    if (nuevaPass.length < 6) return setMsg({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });

    setMsg(null);
    setLoadingCambio(true);
    try {
      await validarCodigoService(correo, codigo, nuevaPass);
      setMsg({ type: "success", text: "✓ Contraseña actualizada correctamente. Redirigiendo..." });
      setTimeout(() => navigate("/"), 2000);
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Código incorrecto o expirado." });
    } finally {
      setLoadingCambio(false);
    }
  };

  return (
    <div style={pageStyle}>
      <WatermarkBg />
      <div style={cardStyle}>
        <div style={accentBar} />
        <LogoHeader subtitle="Recuperar Contraseña" />

        {msg && <div style={alertStyle(msg.type)}>{msg.text}</div>}

        {/* Fila: correo + botón enviar código */}
        <div>
          <label style={labelStyle}>Correo</label>
          <div style={sendRowStyle}>
            <div style={{ flex: 1 }}>
              <input
                type="email"
                value={correo}
                onChange={e => setCorreo(e.target.value)}
                placeholder="tu@correo.com"
                disabled={codigoEnviado}
                style={{
                  ...inputStyle,
                  opacity: codigoEnviado ? 0.6 : 1,
                  cursor: codigoEnviado ? "not-allowed" : "text",
                }}
              />
            </div>
            <button
              onClick={handleEnviarCodigo}
              disabled={loadingCodigo || codigoEnviado}
              style={{
                ...sendBtnStyle,
                opacity: loadingCodigo || codigoEnviado ? 0.6 : 1,
                cursor: loadingCodigo || codigoEnviado ? "not-allowed" : "pointer",
                background: codigoEnviado ? "#6B7280" : "#1F2937",
              }}
            >
              {loadingCodigo ? "..." : codigoEnviado ? "Enviado ✓" : "Enviar Código"}
            </button>
          </div>
        </div>

        {/* Código */}
        <InputField
          label="Código"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder="• • • • • •"
          isPassword
        />

        {/* Nueva contraseña y confirmar — dos columnas */}
        <div style={twoColStyle}>
          <InputField
            label="Nueva Contraseña"
            value={nuevaPass}
            onChange={e => setNuevaPass(e.target.value)}
            placeholder="Contraseña"
            isPassword
          />
          <InputField
            label="Confirmar Contraseña"
            value={confirmarPass}
            onChange={e => setConfirmarPass(e.target.value)}
            placeholder="Contraseña"
            isPassword
          />
        </div>

        <button
          onClick={handleCambiarPassword}
          disabled={loadingCambio}
          style={{ ...btnPrimaryStyle, opacity: loadingCambio ? 0.7 : 1 }}
        >
          {loadingCambio ? "Actualizando..." : "Cambiar Contraseña"}
        </button>

        <div style={linksRowStyle}>
          <div style={dividerStyle} />
          <button style={btnLinkStyle} onClick={() => navigate("/")}>
            ← Volver al Login
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const pageStyle = {
  minHeight: "100vh",
  background: "#F8F7F2",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(232,139,58,0.06) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(232,139,58,0.04) 0%, transparent 50%)
  `,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "'Barlow', sans-serif",
  padding: "1rem",
  position: "relative",
};

const cardStyle = {
  background: "#FFFFFF",
  borderRadius: "16px",
  padding: "2.5rem 2.5rem 2rem",
  width: "100%",
  maxWidth: "460px",
  boxShadow: "0 4px 6px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.08)",
  position: "relative",
  zIndex: 1,
  overflow: "hidden",
};

const accentBar = {
  position: "absolute",
  top: 0, left: 0, right: 0,
  height: "4px",
  background: "linear-gradient(90deg, #E88B3A 0%, #F5A623 100%)",
};

const alertStyle = (type) => ({
  padding: "0.75rem 1rem",
  borderRadius: "8px",
  marginBottom: "1rem",
  fontFamily: "'Barlow', sans-serif",
  fontSize: "0.85rem",
  background: type === "error" ? "#FEF2F2" : "#F0FDF4",
  color: type === "error" ? "#DC2626" : "#16A34A",
  border: `1px solid ${type === "error" ? "#FECACA" : "#BBF7D0"}`,
});

const labelStyle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontSize: "0.7rem",
  fontWeight: 600,
  letterSpacing: "0.15em",
  color: "#6B7280",
  textTransform: "uppercase",
  marginBottom: "0.4rem",
  display: "block",
};

const sendRowStyle = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "center",
  marginBottom: "1.25rem",
};

const inputStyle = {
  width: "100%",
  padding: "0.75rem 1rem",
  border: "1.5px solid #E5E7EB",
  borderRadius: "8px",
  fontFamily: "'Barlow', sans-serif",
  fontSize: "0.95rem",
  color: "#1F2937",
  background: "#FAFAFA",
  outline: "none",
  boxSizing: "border-box",
};

const sendBtnStyle = {
  padding: "0.75rem 1rem",
  background: "#1F2937",
  color: "#FFF",
  border: "none",
  borderRadius: "8px",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: "0.75rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const twoColStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "0.75rem",
};

const btnPrimaryStyle = {
  width: "100%",
  padding: "0.875rem",
  background: "#1F2937",
  color: "#FFFFFF",
  border: "none",
  borderRadius: "8px",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 700,
  fontSize: "0.9rem",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  cursor: "pointer",
  marginTop: "0.5rem",
};

const linksRowStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  marginTop: "1.25rem",
};

const dividerStyle = {
  width: "100%",
  height: "1px",
  background: "#F3F4F6",
  marginBottom: "0.75rem",
};

const btnLinkStyle = {
  background: "none",
  border: "none",
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 600,
  fontSize: "0.75rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "#6B7280",
  cursor: "pointer",
  padding: "0.5rem",
  textDecoration: "underline",
  textUnderlineOffset: "3px",
};