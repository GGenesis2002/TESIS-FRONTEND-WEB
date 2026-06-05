import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { recuperarUsuarioService } from "../../services/authService";
import LogoHeader from "../../components/auth/LogoHeader";
import WatermarkBg from "../../components/auth/WatermarkBg";

export default function RecuperarUsuarioPage() {
  const navigate = useNavigate();
  const [identificador, setIdentificador] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null); // { type: "error" | "success", text: "" }

  const handleEnviar = async () => {
    if (!identificador) return setMsg({ type: "error", text: "Ingresa tu correo o cédula." });
    setMsg(null);
    setLoading(true);
    try {
      await recuperarUsuarioService(identificador);
      setMsg({ type: "success", text: "✓ Tu nombre de usuario fue enviado a tu correo registrado." });
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.msg || "Cuenta no encontrada." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <WatermarkBg />
      <div style={cardStyle}>
        <div style={accentBar} />
        <LogoHeader subtitle="Recuperar Usuario" />

        {msg && <div style={alertStyle(msg.type)}>{msg.text}</div>}

        {/* Fila: input + botón */}
        <div>
          <label style={labelStyle}>Correo o Cédula</label>
          <div style={sendRowStyle}>
            <div style={{ flex: 1 }}>
              <input
                type="text"
                value={identificador}
                onChange={e => setIdentificador(e.target.value)}
                placeholder="correo@ejemplo.com o 1712345678"
                onKeyDown={e => e.key === "Enter" && handleEnviar()}
                style={inputStyle}
              />
            </div>
            <button
              onClick={handleEnviar}
              disabled={loading}
              style={{
                ...sendBtnStyle,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "..." : "Enviar Usuario"}
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          style={btnPrimaryStyle}
        >
          Volver
        </button>
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
  maxWidth: "420px",
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
  marginBottom: "1.5rem",
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
};