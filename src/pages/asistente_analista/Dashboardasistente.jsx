import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import API from "../../services/api";

export default function DashboardAsistente() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const fechaActual = new Date();

  // Estados Generales
  const [data, setData] = useState({
    kpis: { pac_reg_hoy: 0, ord_cre_hoy: 0, resultados_pen: 0, listos_entrega: 0 },
    pacientesRecientes: [],
    grafico: []
  });
  const [loading, setLoading] = useState(false);
  
  // Estados de Interactividad e Innovación Añadidos
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [descargando, setDescargando] = useState(false);
  const [notaRapida, setNotaRapida] = useState(localStorage.getItem("dash_nota") || "");
  
  // Datos simulados de negocio avanzados (Finanzas y alertas críticas de muestras)
  const [cajaDelDia, setCajaDelDia] = useState({ efectivo: 0, transferencia: 0 });
  

  // Valores del Filtro de Reportes
  const [reporteMes, setReporteMes] = useState(fechaActual.getMonth() + 1);
  const [reporteAnio, setReporteAnio] = useState(fechaActual.getFullYear());

 const cargar = async () => {
    setLoading(true);
    try {
        const [resDash, resCaja] = await Promise.all([
            API.get("/dashboard/secretaria", { params: { mes: reporteMes, anio: reporteAnio } }),
            API.get("/dashboard/arqueo-hoy")
        ]);
        
        if (resDash.data) setData(resDash.data);
        
        if (resCaja.data) {
            // Convertimos los strings a números aquí mismo
            setCajaDelDia({
                efectivo: Number(resCaja.data.efectivo || 0),
                transferencia: Number(resCaja.data.transferencia || 0)
            });
        }
    } catch (error) {
        console.error("Error cargando dashboard:", error);
    } finally {
        setLoading(false);
    }
};

  useEffect(() => { 
    cargar(); 
  }, [reporteMes, reporteAnio]);

  // Guarda notas de turno en tiempo real
  const manejarCambioNota = (e) => {
    setNotaRapida(e.target.value);
    localStorage.setItem("dash_nota", e.target.value);
  };

  const descargarReporteBlob = async () => {
    try {
      setDescargando(true);
      const response = await API.get(`/dashboard/secretaria/reporte?mes=${reporteMes}&anio=${reporteAnio}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte_Laboratorio_Mes_${reporteMes}_${reporteAnio}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("No se pudo descargar el reporte. Verifique registros de este período.");
    } finally {
      setDescargando(false);
    }
  };

  const kpisMap = [
    { icon: "📋", label: "Órdenes Hoy",     value: data.kpis.ord_cre_hoy,    color: "#E88B3A", desc: "Nuevas órdenes registradas" },
    { icon: "🧫", label: "En Proceso",      value: data.kpis.resultados_pen, color: "#3B82F6", desc: "Resultados pendientes analista" },
    { icon: "✅", label: "Listos para Entrega", value: data.kpis.listos_entrega, color: "#10B981", desc: "Resultados validados listos" },
    { icon: "👤", label: "Pacientes Registrados", value: data.kpis.pac_reg_hoy,    color: "#8B5CF6", desc: "Nuevos registros totales" },
  ];

  const getColorByEstado = (estado) => {
    const colors = {
      "Generada": "#3B82F6", "Pagada": "#10B981", "En Proceso": "#8B5CF6",
      "Cancelada": "#EF4444", "Por Validar": "#F59E0B", "Validado": "#059669"
    };
    return colors[estado] || "#9CA3AF";
  };

  const pacientesFiltrados = data.pacientesRecientes.filter(p => {
    const nombreCompleto = `${p.nombres || ""} ${p.apellidos || ""}`.toLowerCase();
    return nombreCompleto.includes(busquedaPaciente.toLowerCase()) || String(p.id_paciente || "").includes(busquedaPaciente);
  });

  return (
    <div style={c.wrap}>

      {/* ── ENCABEZADO ── */}
      <div style={c.header}>
        <div>
          <h2 style={c.title}>SISTEMA <span style={c.orange}>CÁRDENAS GARÓFALO</span></h2>
          <p style={c.sub}>Módulo de Gestión Asistencial e Inteligencia del Laboratorio.</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={cargar} style={c.refreshBtn}>↻ Sincronizar Sistema</button>
        </div>
      </div>

      

      {/* ── METRICAS / KPIS ── */}
      <div style={c.kpiGrid}>
        {kpisMap.map((k, i) => (
          <div key={i} style={c.kpiCard}>
            <div style={{ ...c.kpiIcon, background: `${k.color}15`, color: k.color }}>{k.icon}</div>
            <p style={c.kpiLabel}>{k.label}</p>
            <p style={{ ...c.kpiValue, color: k.color }}>{k.value || 0}</p>
            <p style={c.kpiDesc}>{k.desc}</p>
          </div>
        ))}
      </div>

      {/* ── SECCIÓN CENTRAL: GRÁFICO, CAJA, PACIENTES Y NOTAS ── */}
      <div className="main-grid-responsive" style={c.mainGrid}>
        
        {/* COLUMNA IZQUIERDA: GRÁFICO Y CENTRO DE DESCARGAS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* Gráfico */}
          <div style={c.section}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={c.sTitle}>📊 Distribución y Estado de Órdenes</h3>
              <div style={{ display: "flex", gap: "0.25rem" }}>
                <span style={c.dotLegend} /> <span style={{ fontSize: "0.75rem", color: "#6B7280" }}>Métricas en tiempo real</span>
              </div>
            </div>
            <div style={{ height: "260px", width: "100%" }}>
              {data.grafico && data.grafico.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.grafico} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <Tooltip cursor={{ fill: 'rgba(232,139,58,0.03)' }} />
                    <Bar dataKey="cantidad" radius={[6, 6, 0, 0]} barSize={35}>
                      {data.grafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getColorByEstado(entry.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p style={c.emptyState}>No hay datos estadísticos registrados.</p>
              )}
            </div>
          </div>

          {/* Centro de Descarga de Informes */}
          <div style={c.section}>
            <h3 style={c.sTitle}>📁 Centro de Exportación de Auditoría Comercial</h3>
            <div style={c.reportFlex}>
              <div style={c.selectGroup}>
                <label style={c.label}>Mes del Reporte</label>
                <select value={reporteMes} onChange={e => setReporteMes(Number(e.target.value))} style={c.select}>
                  <option value={1}>Enero</option><option value={2}>Febrero</option><option value={3}>Marzo</option>
                  <option value={4}>Abril</option><option value={5}>Mayo</option><option value={6}>Junio</option>
                  <option value={7}>Julio</option><option value={8}>Agosto</option><option value={9}>Septiembre</option>
                  <option value={10}>Octubre</option><option value={11}>Noviembre</option><option value={12}>Diciembre</option>
                </select>
              </div>
              <div style={c.selectGroup}>
                <label style={c.label}>Año de Gestión</label>
                <select value={reporteAnio} onChange={e => setReporteAnio(Number(e.target.value))} style={c.select}>
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
              <button onClick={descargarReporteBlob} disabled={descargando} style={c.downloadBtn}>
                {descargando ? "Procesando..." : "📥 Exportar Reporte (.csv)"}
              </button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: CAJA DEL DÍA, PACIENTES Y COMPONENTES NUEVOS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          
          {/* NUEVA FUNCIÓN 2: CONTROL Y AUDITORÍA RÁPIDA DE CAJA */}
          <div style={{ ...c.section, background: "#1E293B", color: "#FFF" }}>
            <h3 style={{ ...c.sTitle, color: "#FFF" }}>💰 Arqueo Rápido de Caja (Hoy)</h3>
            <div style={c.cajaFlex}>
              <div style={c.cajaItem}>
                <span>💵 Efectivo</span>
                <strong>${cajaDelDia.efectivo.toFixed(2)}</strong>
              </div>
              <div style={c.cajaItem}>
                <span>🏦 Transf.</span>
                <strong>${cajaDelDia.transferencia.toFixed(2)}</strong>
              </div>
              
            </div>
            <div style={{ borderTop: "1px solid #334155", marginTop: "1rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
              <span style={{ color: "#94A3B8" }}>Total Recaudado:</span>
              <strong style={{ color: "#34D399" }}>${(cajaDelDia.efectivo + cajaDelDia.transferencia).toFixed(2)}</strong>
            </div>
          </div>

          {/* Listado de Últimos Pacientes */}
          <div style={c.section}>
            <h3 style={c.sTitle}>👥 Últimos Pacientes Registrados</h3>
            <input 
              type="text" 
              placeholder="🔍 Filtrar por nombre o ID..." 
              value={busquedaPaciente}
              onChange={e => setBusquedaPaciente(e.target.value)}
              style={c.inputSearch}
            />
            {pacientesFiltrados.length === 0 ? (
              <p style={c.emptyState}>No hay coincidencias en el listado.</p>
            ) : (
              <div style={c.scrollList}>
                {pacientesFiltrados.map((p, i) => (
                  <div key={p.id_paciente || i} style={c.logRow}>
                    <div style={c.avatarCircle}>{p.nombres ? p.nombres.charAt(0) : "P"}</div>
                    <div>
                      <p style={c.logName}>{p.nombres} {p.apellidos}</p>
                      <p style={c.logSub}>ID Paciente: #{p.id_paciente || "N/A"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NUEVA FUNCIÓN 3: NOTAS DE CAMBIO DE TURNO Y RECORDATORIOS */}
          <div style={c.section}>
            <h3 style={c.sTitle}>📝 Bitácora Interna / Pendientes del Turno</h3>
            <textarea
              placeholder="Escribe recordatorios aquí (ej: Paciente de las 4pm viene en ayunas, reactivos por agotarse)... Se guardará automáticamente."
              value={notaRapida}
              onChange={manejarCambioNota}
              style={c.textarea}
            />
            <span style={{ fontSize: "0.7rem", color: "#9CA3AF", display: "block", marginTop: "0.25rem", textAlign: "right" }}>
              ✓ Guardado automático local
            </span>
          </div>

        </div>
      </div>

      {/* ── SECCIÓN INFERIOR: ACCESOS RÁPIDOS ACCESIBLES ── */}
      <div style={c.section}>
        <h3 style={c.sTitle}>⚡ Accesos Rápidos del Módulo Operativo</h3>
        <div style={c.quickGrid}>
          <QuickCard icon="📋" label="Gestión de Órdenes" desc="Crear y auditar órdenes con QR" path="/asistente/ordenes" />
          <QuickCard icon="👤" label="Historias de Pacientes" desc="Ingreso y actualización demográfica" path="/asistente/pacientes" />
          <QuickCard icon="💰" label="Caja y Cobros" desc="Facturación y validación de vouchers" path="/asistente/pagos" />
          <QuickCard icon="🧫" label="Toma de Muestras" desc="Asignación de códigos de barra" path="/asistente/muestras" />
        </div>
      </div>

    </div>
  );
}

function QuickCard({ icon, label, desc, path }) {
  return (
    <div
      onClick={() => window.location.href = path}
      style={c.quickCard}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#E88B3A"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <span style={{ fontSize: "1.6rem" }}>{icon}</span>
      <div>
        <p style={c.quickLabel}>{label}</p>
        <p style={c.quickDesc}>{desc}</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ESTILOS ENRIQUECIDOS Y ROBUSTOS PARA EL ENTORNO CLÍNICO
// ══════════════════════════════════════════════════════════
const c = {
  wrap:       { padding: "1.5rem", fontFamily: "'Barlow', sans-serif", background: "#F8FAFC", minHeight: "100vh" },
  header:     { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" },
  title:      { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.8rem", fontWeight: 700, color: "#1F2937", margin: 0, letterSpacing: "0.5px" },
  orange:     { color: "#E88B3A" },
  sub:        { fontSize: "0.9rem", color: "#6B7280", margin: "0.15rem 0 0" },
  refreshBtn: { background: "#FFF", border: "1px solid #E5E7EB", color: "#374151", padding: "0.55rem 1.1rem", borderRadius: "8px", fontWeight: 600, fontSize: "0.85rem", cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  
  alertBanner:{ background: "#FEF2F2", border: "1px solid #FEE2E2", borderLeft: "4px solid #EF4444", borderRadius: "10px", padding: "1rem", marginBottom: "1.5rem" },
  alertGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" },
  alertItem:  { background: "#FFF", padding: "0.6rem 0.8rem", borderRadius: "6px", fontSize: "0.8rem", borderLeft: "3px solid #EF4444", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" },

  kpiGrid:    { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", marginBottom: "1.5rem" },
  kpiCard:    { background: "#FFF", padding: "1.25rem", borderRadius: "12px", border: "1px solid #E5E7EB" },
  kpiIcon:    { width: "42px", height: "42px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", marginBottom: "0.75rem" },
  kpiLabel:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", margin: "0 0 0.25rem" },
  kpiValue:   { fontSize: "2.2rem", fontWeight: 800, margin: "0 0 0.15rem", fontFamily: "'Barlow Condensed', sans-serif", lineHeight: 1 },
  kpiDesc:    { fontSize: "0.75rem", color: "#9CA3AF", margin: 0 },
  
  mainGrid:   { display: "grid", gridTemplateColumns: "1.8fr 1.2fr", gap: "1.5rem", marginBottom: "1.5rem" },
  section:    { background: "#FFF", borderRadius: "12px", padding: "1.25rem", border: "1px solid #E5E7EB", boxShadow: "0 2px 4px rgba(0,0,0,0.01)" },
  sTitle:     { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#1F2937", textTransform: "uppercase", letterSpacing: "0.03em", margin: "0 0 1rem" },
  dotLegend:  { width: "8px", height: "8px", borderRadius: "50%", background: "#10B981", display: "inline-block", marginRight: "4px" },
  
  cajaFlex:   { display: "flex", gap: "0.75rem", justifyContent: "space-between", marginTop: "0.75rem" },
  cajaItem:   { display: "flex", flexDirection: "column", gap: "0.25rem", background: "#334155", padding: "0.6rem 0.8rem", borderRadius: "8px", width: "100%" },
  
  reportFlex: { display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" },
  selectGroup:{ display: "flex", flexDirection: "column", gap: "0.25rem" },
  label:      { fontSize: "0.7rem", fontWeight: 700, color: "#4B5563" },
  select:     { padding: "0.45rem", borderRadius: "6px", border: "1px solid #D1D5DB", background: "#FFF", fontSize: "0.85rem", fontFamily: "'Barlow', sans-serif" },
  downloadBtn:{ background: "#E88B3A", color: "#FFF", border: "none", padding: "0.55rem 1.25rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" },
  
  inputSearch:{ width: "100%", padding: "0.45rem", borderRadius: "6px", border: "1px solid #D1D5DB", marginBottom: "0.75rem", fontSize: "0.85rem", boxSizing: "border-box" },
  scrollList: { display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: "200px", overflowY: "auto" },
  emptyState: { color: "#9CA3AF", fontSize: "0.85rem", textAlign: "center", padding: "1.5rem 0" },
  
  logRow:     { display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #F1F5F9" },
  avatarCircle: { width: "32px", height: "32px", borderRadius: "50%", background: "#E88B3A", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "0.9rem" },
  logName:    { fontSize: "0.85rem", color: "#1F2937", margin: "0 0 0.1rem", fontWeight: 600 },
  logSub:     { fontSize: "0.7rem", color: "#6B7280", margin: 0 },
  
  textarea:   { width: "100%", height: "70px", borderRadius: "6px", border: "1px solid #D1D5DB", padding: "0.5rem", fontSize: "0.8rem", fontFamily: "'Barlow', sans-serif", resize: "none", outline: "none", boxSizing: "border-box", background: "#FFF" },

  quickGrid:  { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" },
  quickCard:  { display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", border: "1px solid #E5E7EB", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s", background: "#FAFAFA" },
  quickLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "#1F2937", margin: "0 0 0.1rem", textTransform: "uppercase" },
  quickDesc:  { fontSize: "0.75rem", color: "#6B7280", margin: 0 },
};

if (typeof window !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    @media (max-width: 900px) { .main-grid-responsive { grid-template-columns: 1fr !important; } }
  `;
  document.head.appendChild(style);
}