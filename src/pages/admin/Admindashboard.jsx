import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

const getToken = () => localStorage.getItem("token");

async function fetchAdmin() {
  try {
    const { data } = await API.get("/dashboard/admin");
    return data;
  } catch (error) {
    throw new Error("Error al cargar datos");
  }
}

// ─── KPI CARD ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div style={kpiCard}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <p style={kpiLabel}>{label}</p>
          <p style={{ ...kpiValue, color: accent || "#1F2937" }}>{value ?? "—"}</p>
          {sub && <p style={kpiSub}>{sub}</p>}
        </div>
        <div style={{ ...kpiIcon, background: accent ? `${accent}18` : "#F1F5F9" }}>
          <span style={{ fontSize: "1.3rem" }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
function Badge({ estado }) {
  const map = {
    "Validado":    { bg: "#D1FAE5", color: "#065F46" },
    "Por Validar": { bg: "#FEF3C7", color: "#92400E" },
    "En Proceso":  { bg: "#DBEAFE", color: "#1E40AF" },
    "Generada":    { bg: "#F3F4F6", color: "#374151" },
    "Devuelto":    { bg: "#FEE2E2", color: "#991B1B" },
  };
  const s = map[estado] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ ...badgeBase, background: s.bg, color: s.color }}>{estado}</span>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetchAdmin()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (error)   return <ErrorMsg msg={error} />;

  const k = data?.kpis || {};
  const ordenes = data?.ordenesDia || [];

  const kpis = [
    { icon: "👤", label: "Pacientes Registrados",  value: k.pac_hoy,      accent: "#3B82F6" },
    { icon: "📋", label: "Órdenes Hoy",             value: k.ord_hoy,      accent: "#E88B3A" },
    { icon: "⏳", label: "Por Validar",              value: k.pen_val,      accent: "#F59E0B" },
    { icon: "✅", label: "Completados",              value: k.completados,  accent: "#10B981" },
    { icon: "⚠️", label: "Resultados Críticos",     value: k.criticos,     accent: "#EF4444" },
    { icon: "👥", label: "Usuarios Activos Hoy",    value: k.activos,      accent: "#8B5CF6" },
    { icon: "💵", label: "Ingresos del Día",         value: `$${Number(k.ingresos_hoy||0).toFixed(2)}`, accent: "#10B981" },
    { icon: "📦", label: "Insumos con Stock Bajo",  value: k.stock_bajo,   accent: k.stock_bajo > 0 ? "#EF4444" : "#10B981" },
  ];

  return (
    <div style={page}>
      {/* ── ENCABEZADO ── */}
      <div style={header}>
        <div>
          <h2 style={pageH2}>Dashboard Administrativo</h2>
          <p style={pageSub}>Resumen operativo del día — {new Date().toLocaleDateString("es-EC", { weekday:"long", day:"2-digit", month:"long", year:"numeric" })}</p>
        </div>
        <div style={{ display:"flex", gap:"0.75rem" }}>
          <ActionBtn icon="✅" label="Ver Resultados"  onClick={() => navigate("/admin/resultados")} primary />
          <ActionBtn icon="📦" label="Ver Inventario"  onClick={() => navigate("/admin/inventario")} />
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={kpiGrid}>
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* ── BLOQUE INFERIOR ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>

        {/* Órdenes del Día */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>📋 Órdenes del Día</span>
            <button style={linkBtn} onClick={() => navigate("/admin/ordenes")}>Ver todas →</button>
          </div>
          {ordenes.length === 0 ? (
            <p style={emptyTxt}>Sin órdenes registradas hoy</p>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  {["Ticket","Estado"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenes.map((o, i) => (
                  <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
                    <td style={td}><span style={ticketStyle}>{o.numero_ticket}</span></td>
                    <td style={td}><Badge estado={o.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Accesos Rápidos */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>⚡ Accesos Rápidos</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginTop:"0.5rem" }}>
            {[
              { icon:"✅", label:"Validar Resultados",  path:"/admin/resultados",  color:"#10B981" },
              { icon:"📦", label:"Gestionar Inventario", path:"/admin/inventario",  color:"#E88B3A" },
              { icon:"👤", label:"Ver Pacientes",        path:"/admin/pacientes",   color:"#3B82F6" },
              { icon:"📋", label:"Ver Órdenes",          path:"/admin/ordenes",     color:"#8B5CF6" },
            ].map((a, i) => (
              <button key={i} onClick={() => navigate(a.path)} style={{ ...quickBtn, borderColor: `${a.color}30`, background: `${a.color}08` }}>
                <span style={{ fontSize:"1.4rem" }}>{a.icon}</span>
                <span style={{ fontFamily:"'Barlow', sans-serif", fontSize:"0.8rem", color:"#374151", fontWeight:600 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:"0.4rem",
      padding:"0.5rem 1rem", borderRadius:"8px", cursor:"pointer",
      fontFamily:"'Barlow', sans-serif", fontSize:"0.82rem", fontWeight:600,
      border: primary ? "none" : "1px solid #E2E8F0",
      background: primary ? "#E88B3A" : "#F8FAFC",
      color: primary ? "#FFF" : "#374151",
    }}>{icon} {label}</button>
  );
}
function Loader() {
  return <div style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF", fontFamily:"'Barlow', sans-serif" }}>Cargando dashboard…</div>;
}
function ErrorMsg({ msg }) {
  return <div style={{ padding:"3rem", textAlign:"center", color:"#EF4444", fontFamily:"'Barlow', sans-serif" }}>Error: {msg}</div>;
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const page       = { padding:"1.5rem", fontFamily:"'Barlow', sans-serif" };
const header     = { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem" };
const pageH2     = { fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:"1.5rem", letterSpacing:"0.04em", color:"#1F2937", margin:0, textTransform:"uppercase" };
const pageSub    = { fontFamily:"'Barlow', sans-serif", fontSize:"0.8rem", color:"#9CA3AF", margin:"0.2rem 0 0" };
const kpiGrid    = { display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"1rem", marginBottom:"1.25rem" };
const kpiCard    = { background:"#FFF", borderRadius:"12px", padding:"1.1rem 1.25rem", border:"1px solid #F1F5F9", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" };
const kpiLabel   = { fontFamily:"'Barlow', sans-serif", fontSize:"0.72rem", color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.08em", margin:"0 0 0.35rem" };
const kpiValue   = { fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:"1.8rem", margin:0 };
const kpiSub     = { fontFamily:"'Barlow', sans-serif", fontSize:"0.7rem", color:"#9CA3AF", margin:"0.2rem 0 0" };
const kpiIcon    = { width:"40px", height:"40px", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center" };
const card       = { background:"#FFF", borderRadius:"12px", padding:"1.25rem", border:"1px solid #F1F5F9", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" };
const cardHeader = { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" };
const cardTitle  = { fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.9rem", letterSpacing:"0.06em", color:"#1F2937", textTransform:"uppercase" };
const linkBtn    = { background:"none", border:"none", color:"#E88B3A", fontSize:"0.78rem", cursor:"pointer", fontFamily:"'Barlow', sans-serif", fontWeight:600 };
const th         = { fontFamily:"'Barlow', sans-serif", fontSize:"0.7rem", color:"#9CA3AF", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", padding:"0.5rem 0.75rem", textAlign:"left", borderBottom:"2px solid #F1F5F9" };
const td         = { padding:"0.6rem 0.75rem", fontFamily:"'Barlow', sans-serif", fontSize:"0.82rem", color:"#374151" };
const badgeBase  = { padding:"0.2rem 0.6rem", borderRadius:"20px", fontSize:"0.72rem", fontFamily:"'Barlow', sans-serif", fontWeight:600 };
const ticketStyle = { fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.85rem", color:"#1F2937", letterSpacing:"0.05em" };
const emptyTxt   = { color:"#9CA3AF", fontSize:"0.82rem", textAlign:"center", padding:"2rem 0" };
const quickBtn   = { display:"flex", flexDirection:"column", alignItems:"center", gap:"0.4rem", padding:"1rem 0.75rem", borderRadius:"10px", cursor:"pointer", border:"1px solid", transition:"all 0.15s ease" };