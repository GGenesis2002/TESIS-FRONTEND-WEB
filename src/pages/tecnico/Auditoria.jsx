import { useState, useEffect } from "react";
import API from "../../services/api";

export default function Auditoria() {
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [fechaDesde, setFechaDesde] = useState(hoy());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [detalle, setDetalle]     = useState(null);

  function hoy() {
    return new Date().toISOString().split("T")[0];
  }

  const cargar = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(
        `/dashboard/auditoria?desde=${fechaDesde}&hasta=${fechaHasta}`
      );
      setRegistros(data);
    } catch { setRegistros([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { cargar(); }, []);

  return (
    <div style={containerStyle}>

      {/* ── ENCABEZADO ── */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={iconHeaderStyle}>📊</div>
          <div>
            <h2 style={titleStyle}>
              AUDITORÍA <span style={{ color: "#E88B3A" }}>DEL SISTEMA</span>
            </h2>
            <p style={subtitleStyle}>REGISTRO DE ACCIONES POR USUARIO Y ROL</p>
          </div>
        </div>

        <div style={filtrosStyle}>
          <div style={dateWrapStyle}>
            <input type="date" value={fechaDesde}
              onChange={e => setFechaDesde(e.target.value)} style={dateInputStyle} />
          </div>
          <div style={dateWrapStyle}>
            <input type="date" value={fechaHasta}
              onChange={e => setFechaHasta(e.target.value)} style={dateInputStyle} />
          </div>
          <button onClick={cargar} style={searchBtnStyle}>🔍</button>
        </div>
      </div>

      {/* ── TABLA ── */}
      <div style={tableWrapStyle}>
        <div style={tableHeaderStyle}>
          <span style={{ flex: 2 }}>USUARIO</span>
          <span style={{ flex: 1 }}>ROL</span>          {/* ← columna rol */}
          <span style={{ flex: 2 }}>ACCIÓN REALIZADA</span>
          <span style={{ flex: 1 }}>FECHA Y HORA</span>
          <span style={{ flex: 0.5, textAlign: "right" }}>VER</span>
        </div>

        {loading ? (
          <div style={emptyStyle}>Cargando registros...</div>
        ) : registros.length === 0 ? (
          <div style={emptyStyle}>Sin registros en el rango seleccionado</div>
        ) : (
          registros.map(r => (
            <div key={r.id_auditoria} style={tableRowStyle}>

              {/* Avatar + Nombre */}
              <div style={{ flex: 2, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <div style={{ ...avatarStyle, background: getRolColor(r.rol) }}>
                  {r.nombres?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={nameStyle}>{r.nombres} {r.apellidos}</p>
                  <p style={emailStyle}>{r.username}</p>
                </div>
              </div>

              {/* ROL ← esto es lo nuevo */}
              <div style={{ flex: 1 }}>
                <span style={{ ...rolBadgeStyle, background: getRolColor(r.rol) }}>
                  {r.rol?.toUpperCase()}
                </span>
              </div>

              {/* Acción */}
              <div style={{ flex: 2 }}>
                <p style={accionStyle}>{r.accion}</p>
                <p style={descStyle}>{r.descripcion}</p>
              </div>

              {/* Fecha */}
              <div style={{ flex: 1 }}>
                <p style={fechaStyle}>
                  {new Date(r.fecha_hora).toLocaleDateString("es-EC")}
                </p>
                <p style={horaStyle}>
                  {new Date(r.fecha_hora).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Botón */}
              <div style={{ flex: 0.5, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setDetalle(r)} style={verBtnStyle} title="Ver detalle">
                  👁️
                </button>
              </div>

            </div>
          ))
        )}
      </div>

      {/* ── MODAL DETALLE ── */}
      {detalle && (
        <div style={overlayStyle}>
          <div style={modalStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={modalTitleStyle}>
                  DETALLE <span style={{ color: "#E88B3A" }}>ACCIÓN</span>
                </h3>
                <p style={modalSubStyle}>Registro completo del evento del sistema</p>
              </div>
              <button onClick={() => setDetalle(null)} style={closeBtnStyle}>✕</button>
            </div>

            <div style={modalBodyStyle}>
              <div style={detalleGridStyle}>
                <DetalleItem label="Nombres"   value={`${detalle.nombres} ${detalle.apellidos}`} />
                <DetalleItem label="Username"  value={detalle.username} />
                <DetalleItem label="Rol"       value={detalle.rol} highlight />
                <DetalleItem label="Acción"    value={detalle.accion} highlight />
                <DetalleItem label="Descripción" value={detalle.descripcion} fullWidth />
                <DetalleItem label="Fecha y hora"
                  value={new Date(detalle.fecha_hora).toLocaleString("es-EC")} />
              </div>

              <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center" }}>
                <span style={{ ...rolBadgeStyle, background: getRolColor(detalle.rol),
                  fontSize: "0.9rem", padding: "0.5rem 1.5rem" }}>
                  {detalle.rol?.toUpperCase()}
                </span>
              </div>

              <button onClick={() => setDetalle(null)}
                style={{ ...cerrarBtnStyle, marginTop: "1.5rem" }}>
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SUB COMPONENTE ───────────────────────────────────────────────────────────
function DetalleItem({ label, value, highlight, fullWidth }) {
  return (
    <div style={{ ...detalleItemStyle, ...(fullWidth ? { gridColumn: "1 / -1" } : {}) }}>
      <p style={detalleLabelStyle}>{label}</p>
      <p style={{ ...detalleValueStyle, color: highlight ? "#E88B3A" : "#1F2937" }}>
        {value || "—"}
      </p>
    </div>
  );
}

// ─── HELPER ──────────────────────────────────────────────────────────────────
function getRolColor(rol) {
  if (!rol) return "#6B7280";
  const r = rol.toLowerCase();
  if (r.includes("admin"))      return "#E88B3A";
  if (r.includes("tecnico"))    return "#10B981";
  if (r.includes("especialis")) return "#8B5CF6";
  if (r.includes("asistente") || r.includes("secretaria")) return "#3B82F6";
  return "#6B7280";
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const containerStyle   = { padding: "1rem", fontFamily: "'Barlow', sans-serif" };
const headerStyle      = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" };
const iconHeaderStyle  = { width: "48px", height: "48px", borderRadius: "12px", background: "#E88B3A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" };
const titleStyle       = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", margin: 0, textTransform: "uppercase" };
const subtitleStyle    = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", letterSpacing: "0.2em", color: "#9CA3AF", margin: 0, textTransform: "uppercase" };
const filtrosStyle     = { display: "flex", gap: "0.75rem", alignItems: "center" };
const dateWrapStyle    = { background: "#FFF", border: "1.5px solid #E5E7EB", borderRadius: "8px", padding: "0.5rem 0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" };
const dateInputStyle   = { border: "none", outline: "none", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#374151", background: "transparent", cursor: "pointer" };
const searchBtnStyle   = { width: "40px", height: "40px", background: "#E88B3A", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" };
const tableWrapStyle   = { background: "#FFF", borderRadius: "12px", border: "1px solid #F1F5F9", overflow: "hidden", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const tableHeaderStyle = { display: "flex", padding: "0.75rem 1.5rem", background: "#F8FAFC", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase" };
const tableRowStyle    = { display: "flex", alignItems: "center", padding: "1rem 1.5rem", borderBottom: "1px solid #F8FAFC" };
const emptyStyle       = { padding: "3rem", textAlign: "center", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem" };
const avatarStyle      = { width: "42px", height: "42px", borderRadius: "50%", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", flexShrink: 0, opacity: 0.85 };
const nameStyle        = { fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "#1F2937", margin: 0 };
const emailStyle       = { fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF", margin: 0 };
const rolBadgeStyle    = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#FFF", padding: "0.25rem 0.6rem", borderRadius: "20px", display: "inline-block", letterSpacing: "0.05em" };
const accionStyle      = { fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: "0.88rem", color: "#1F2937", margin: 0 };
const descStyle        = { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#9CA3AF", margin: 0, marginTop: "2px" };
const fechaStyle       = { fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: "0.82rem", color: "#374151", margin: 0 };
const horaStyle        = { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#9CA3AF", margin: 0 };
const verBtnStyle      = { background: "rgba(232,139,58,0.1)", border: "none", borderRadius: "8px", width: "36px", height: "36px", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" };
const overlayStyle     = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" };
const modalStyle       = { background: "#FFF", borderRadius: "16px", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const modalHeaderStyle = { background: "#1F2937", padding: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" };
const modalTitleStyle  = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.3rem", color: "#FFF", margin: 0, textTransform: "uppercase" };
const modalSubStyle    = { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#94A3B8", margin: "0.25rem 0 0" };
const closeBtnStyle    = { background: "none", border: "none", color: "#94A3B8", fontSize: "1.2rem", cursor: "pointer" };
const modalBodyStyle   = { padding: "1.5rem" };
const detalleGridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" };
const detalleItemStyle = { background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem 1rem" };
const detalleLabelStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.25rem" };
const detalleValueStyle = { fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 600, margin: 0 };
const cerrarBtnStyle   = { width: "100%", padding: "0.75rem", background: "#1F2937", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.1em", cursor: "pointer", textTransform: "uppercase" };