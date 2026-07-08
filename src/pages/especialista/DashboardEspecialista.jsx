import { useState, useEffect, useRef, useCallback } from "react";
import API from "../../services/api";

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const fmt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
};

const fmtHora = (iso) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" });
};

// ── El estado que ve el especialista es estado_resultado, no estado_orden ──
const ESTADO_META = {
  "En Proceso":  { color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  label: "EN PROCESO",  icon: "🔬" },
  "Devuelto":    { color: "#EF4444", bg: "rgba(239,68,68,0.1)",   label: "DEVUELTA",    icon: "↩️" },
  "Por Validar": { color: "#8B5CF6", bg: "rgba(139,92,246,0.1)",  label: "POR VALIDAR", icon: "⏳" },
  "Validado":    { color: "#10B981", bg: "rgba(16,185,129,0.1)",  label: "VALIDADO",    icon: "✅" },
  "Generada":    { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  label: "GENERADA",    icon: "📋" },
};
const getMeta = (e) => ESTADO_META[e] || { color: "#6B7280", bg: "rgba(107,114,128,0.1)", label: e?.toUpperCase() || "PENDIENTE", icon: "🔬" };

// Estado visible del especialista: priorizar estado_resultado sobre estado_orden
const getEstadoEsp = (o) => o.estado_resultado || o.estado_orden;

/* ── Animación de número contando ── */
function useCountUp(target, duration = 700, active = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.round(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, active]);
  return val;
}

/* ── Anillo SVG de progreso ── */
function ProgressRing({ pct, color, size = 48, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 120);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ - (animated / 100) * circ}
        style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)" }}
      />
    </svg>
  );
}

/* ── Mini barra ── */
function MiniBar({ value, max, color }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(max > 0 ? (value / max) * 100 : 0), 150); return () => clearTimeout(t); }, [value, max]);
  return (
    <div style={{ height: 4, background: "#F1F5F9", borderRadius: 2, overflow: "hidden", marginTop: 8 }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 2, transition: "width 0.7s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

/* ── Gráfico dona SVG ── */
function DonutChart({ data, size = 140 }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 200); return () => clearTimeout(t); }, []);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>Sin datos</span>
    </div>
  );
  const cx = size / 2, cy = size / 2, r = size * 0.35, strokeW = size * 0.14;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {data.map((d, i) => {
          const pct = d.value / total;
          const dash = animated ? pct * circ : 0;
          const gap = circ - dash;
          const seg = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
              stroke={d.color} strokeWidth={strokeW}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset * circ}
              style={{ transition: "stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)" }}
            />
          );
          offset += pct;
          return seg;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: size * 0.18 + "px", fontWeight: 800, color: "#1F2937", lineHeight: 1 }}>{total}</span>
        <span style={{ fontSize: size * 0.09 + "px", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>total</span>
      </div>
    </div>
  );
}

/* ── Barra de progreso horizontal con etiqueta ── */
function BarraProgreso({ label, value, total, color, icon, onClick, active }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const [w, setW] = useState(0);
  const [hover, setHover] = useState(false);
  useEffect(() => { const t = setTimeout(() => setW(pct), 200); return () => clearTimeout(t); }, [pct]);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        marginBottom: "0.65rem", cursor: onClick ? "pointer" : "default",
        padding: onClick ? "0.3rem 0.4rem" : 0, margin: onClick ? "-0.3rem -0.4rem 0.35rem" : "0 0 0.65rem",
        borderRadius: 8, background: active ? `${color}12` : hover ? `${color}08` : "transparent",
        transition: "background 0.15s",
      }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
        <span style={{ fontSize: "0.75rem", color: active ? color : "#374151", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: active ? 700 : 600, display: "flex", alignItems: "center", gap: "0.3rem" }}>
          {icon} {label}
        </span>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color, fontFamily: "'Barlow Condensed', sans-serif" }}>
          {value} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 6, background: "#F1F5F9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 3, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
      </div>
    </div>
  );
}

/* ── Mini gráfico de barras verticales (tendencia semanal) ── */
function TendenciaBars({ data, color = "#8B5CF6", onBarClick, active }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const [animated, setAnimated] = useState(false);
  const [hover, setHover] = useState(null);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 150); return () => clearTimeout(t); }, []);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 110, padding: "0 0.2rem" }}>
      {data.map((d, i) => {
        const h = animated ? Math.max(4, (d.value / max) * 88) : 0;
        const isActive = active === d.key;
        const isHover = hover === d.key;
        const clickable = !!onBarClick && d.value > 0;
        return (
          <div key={i}
            onClick={() => clickable && onBarClick(d.key)}
            onMouseEnter={() => clickable && setHover(d.key)}
            onMouseLeave={() => setHover(null)}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem", cursor: clickable ? "pointer" : "default" }}>
            <span style={{ fontSize: "0.66rem", fontWeight: 700, color: isActive || isHover ? color : d.value > 0 ? color : "#D1D5DB", fontFamily: "'Barlow Condensed', sans-serif" }}>
              {d.value > 0 ? d.value : ""}
            </span>
            <div title={`${d.value} orden${d.value !== 1 ? "es" : ""}${clickable ? " · clic para filtrar" : ""}`} style={{
              width: "100%", height: h,
              background: isActive ? color : isHover ? color : d.isHoy ? color : `${color}55`,
              borderRadius: "4px 4px 2px 2px", transition: "height 0.6s cubic-bezier(.4,0,.2,1), background 0.15s, transform 0.15s",
              minHeight: 4, transform: isHover ? "scaleX(1.12)" : "scaleX(1)",
              boxShadow: isActive ? `0 0 0 2px ${color}55` : "none",
            }} />
            <span style={{ fontSize: "0.62rem", color: isActive ? color : d.isHoy ? color : "#9CA3AF", fontWeight: isActive || d.isHoy ? 700 : 400, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase" }}>
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Controles de paginación ── */
function Paginacion({ pagina, totalPaginas, onChange, totalItems, porPagina }) {
  if (totalPaginas <= 1) return null;
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, totalItems);
  const paginas = [];
  const ventana = 1;
  for (let p = 1; p <= totalPaginas; p++) {
    if (p === 1 || p === totalPaginas || (p >= pagina - ventana && p <= pagina + ventana)) paginas.push(p);
    else if (paginas[paginas.length - 1] !== "…") paginas.push("…");
  }
  const btn = (active) => ({
    minWidth: 30, height: 30, padding: "0 0.4rem", borderRadius: 7,
    border: `1px solid ${active ? "#8B5CF6" : "#E5E7EB"}`,
    background: active ? "#8B5CF6" : "#FFF", color: active ? "#FFF" : "#6B7280",
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.78rem",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginTop: "1.1rem", paddingTop: "1rem", borderTop: "1px solid #F1F5F9" }}>
      <span style={{ fontSize: "0.76rem", color: "#9CA3AF" }}>
        Mostrando <strong style={{ color: "#374151" }}>{desde}–{hasta}</strong> de <strong style={{ color: "#374151" }}>{totalItems}</strong>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
        <button onClick={() => onChange(Math.max(1, pagina - 1))} disabled={pagina === 1} style={{ ...btn(false), opacity: pagina === 1 ? 0.4 : 1, cursor: pagina === 1 ? "default" : "pointer" }}>‹</button>
        {paginas.map((p, i) => p === "…" ? (
          <span key={`e${i}`} style={{ color: "#CBD5E1", fontSize: "0.78rem", padding: "0 0.2rem" }}>…</span>
        ) : (
          <button key={p} onClick={() => onChange(p)} style={btn(p === pagina)}>{p}</button>
        ))}
        <button onClick={() => onChange(Math.min(totalPaginas, pagina + 1))} disabled={pagina === totalPaginas} style={{ ...btn(false), opacity: pagina === totalPaginas ? 0.4 : 1, cursor: pagina === totalPaginas ? "default" : "pointer" }}>›</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function DashboardEspecialista() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [ordenes, setOrdenes]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [animKpis, setAnimKpis]         = useState(false);
  const [showNotif, setShowNotif]       = useState(false);
  const [busqueda, setBusqueda]         = useState("");
  const [filtroEstado, setFiltroEstado] = useState("TODOS");
  const [filtroDia, setFiltroDia]       = useState(null);
  const [filtroExamen, setFiltroExamen] = useState(null);
  const [vistaOrdenes, setVista]        = useState("cards");
  const [ordenExpandida, setExpand]     = useState(null);
  const [horaActual, setHoraActual]     = useState(new Date());
  const [pagina, setPagina]             = useState(1);
  const notifRef = useRef(null);

  // Reloj en tiempo real
  useEffect(() => {
    const interval = setInterval(() => setHoraActual(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const [leidas, setLeidas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("esp_notifs_leidas") || "[]")); }
    catch { return new Set(); }
  });

  /* ── KPIs — usando estado_resultado del especialista ── */
  const kpis = {
    enProceso:   ordenes.filter(o => getEstadoEsp(o) === "En Proceso").length,
    devueltas:   ordenes.filter(o => getEstadoEsp(o) === "Devuelto").length,
    porValidar:  ordenes.filter(o => getEstadoEsp(o) === "Por Validar").length,
    validadas:   ordenes.filter(o => getEstadoEsp(o) === "Validado").length,
  };

  const total = ordenes.length;

  // Progreso global del especialista
  const totalExamenes   = ordenes.reduce((s, o) => s + (o.mis_examenes || []).length, 0);
  const examenesHechos  = ordenes.reduce((s, o) => s + (o.mis_examenes || []).filter(e => e.completado).length, 0);
  const pctGlobal       = totalExamenes > 0 ? Math.round((examenesHechos / totalExamenes) * 100) : 0;

  const donutData = [
    { label: "En Proceso",  value: kpis.enProceso,  color: "#3B82F6" },
    { label: "Devueltas",   value: kpis.devueltas,  color: "#EF4444" },
    { label: "Por Validar", value: kpis.porValidar, color: "#8B5CF6" },
    { label: "Validadas",   value: kpis.validadas,  color: "#10B981" },
  ].filter(d => d.value > 0);

  // Tasa de aprobación: validadas vs (validadas + devueltas)
  const baseAprobacion = kpis.validadas + kpis.devueltas;
  const tasaAprobacion = baseAprobacion > 0 ? Math.round((kpis.validadas / baseAprobacion) * 100) : null;

  /* ── Notificaciones ── */
  const notifs = ordenes
    .filter(o => getEstadoEsp(o) === "Devuelto")
    .map(o => ({ id: `dev-${o.id_orden}`, tipo: "danger", icon: "⚠️", texto: `Orden #${o.numero_ticket} devuelta para corrección`, ruta: `/especialista/resultados` }));

  const sinLeer = notifs.filter(n => !leidas.has(n.id)).length;
  const marcarLeida = (id) => setLeidas(prev => {
    const next = new Set(prev); next.add(id);
    localStorage.setItem("esp_notifs_leidas", JSON.stringify([...next]));
    return next;
  });

  /* ── Carga ── */
  const cargar = useCallback(async () => {
    setLoading(true);
    setAnimKpis(false);
    try {
      const { data } = await API.get("/resultados/mis-ordenes");
      setOrdenes(Array.isArray(data) ? data : []);
      setTimeout(() => setAnimKpis(true), 80);
    } catch { setOrdenes([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    cargar();
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cargar]);

  /* ── Filtros — por estado_resultado del especialista ── */
  const FILTROS = ["TODOS", "En Proceso", "Devuelto", "Por Validar", "Validado"];
  const ordenesFiltradas = ordenes.filter(o => {
    const estadoEsp = getEstadoEsp(o);
    const matchE = filtroEstado === "TODOS" || estadoEsp === filtroEstado;
    const q = busqueda.toLowerCase();
    const matchB = !q || `${o.numero_ticket || ""} ${o.paciente_nombre || ""}`.toLowerCase().includes(q);
    const matchD = !filtroDia || String(o.fecha_orden || "").slice(0, 10) === filtroDia;
    const matchX = !filtroExamen || (o.mis_examenes || []).some(e => e.nombre_examen === filtroExamen);
    return matchE && matchB && matchD && matchX;
  });

  const saludoHora = () => {
    const h = horaActual.getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  /* ── Tendencia: órdenes por día, últimos 7 días ── */
  const tendenciaSemana = (() => {
    const dias = [];
    const hoyStr = new Date().toISOString().slice(0, 10);
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dias.push({ key, label: d.toLocaleDateString("es-EC", { weekday: "short" }).replace(".", ""), isHoy: key === hoyStr, value: 0 });
    }
    const porDia = {};
    ordenes.forEach(o => {
      if (!o.fecha_orden) return;
      const key = String(o.fecha_orden).slice(0, 10);
      porDia[key] = (porDia[key] || 0) + 1;
    });
    return dias.map(d => ({ ...d, value: porDia[d.key] || 0 }));
  })();

  /* ── Exámenes más frecuentes entre mis órdenes ── */
  const examenesFrecuentes = (() => {
    const conteo = {};
    ordenes.forEach(o => (o.mis_examenes || []).forEach(e => {
      const nombre = e.nombre_examen || "Sin nombre";
      conteo[nombre] = (conteo[nombre] || 0) + 1;
    }));
    return Object.entries(conteo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }));
  })();
  const maxExamenFrecuente = Math.max(1, ...examenesFrecuentes.map(e => e.cantidad));

  /* ── Paginación de "Mis Órdenes" ── */
  const porPagina = vistaOrdenes === "cards" ? 9 : 10;
  const totalPaginas = Math.max(1, Math.ceil(ordenesFiltradas.length / porPagina));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const ordenesPaginadas = ordenesFiltradas.slice((paginaSegura - 1) * porPagina, paginaSegura * porPagina);

  // Resetear a página 1 cuando cambian filtros, búsqueda o vista
  useEffect(() => { setPagina(1); }, [filtroEstado, busqueda, vistaOrdenes]);

  /* ══════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse   { 0%,100% { opacity:1; } 50% { opacity:.5; } }
        @keyframes slideIn { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        .orden-card:hover  { box-shadow: 0 8px 24px rgba(0,0,0,0.09) !important; transform: translateY(-2px) !important; }
        .filtro-btn:hover  { opacity: 0.85; }
        .accion-btn:hover  { filter: brightness(1.08); transform: scale(1.03); }
        .quick-card:hover  { border-color: #8B5CF6 !important; background: rgba(139,92,246,0.06) !important; transform: translateY(-1px); }
        .tr-hover:hover    { background: rgba(139,92,246,0.03) !important; }
      `}</style>

      <div style={{ padding: "1.25rem", fontFamily: "'Barlow', sans-serif", maxWidth: 1400 }}>

        {/* ══ HEADER ══ */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <p style={{ fontSize: "0.78rem", color: "#9CA3AF", margin: "0 0 0.15rem", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em" }}>
              {saludoHora()}, {horaActual.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.8rem", fontWeight: 800, color: "#1F2937", margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>
              PANEL <span style={{ color: "#8B5CF6" }}>{user.nombres?.split(" ")[0] || "ESPECIALISTA"}</span>
            </h2>
            <p style={{ fontSize: "0.83rem", color: "#6B7280", margin: "0.2rem 0 0" }}>
              Gestión de resultados clínicos · {total} orden{total !== 1 ? "es" : ""} asignada{total !== 1 ? "s" : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
            {/* Notificaciones */}
            <div style={{ position: "relative" }} ref={notifRef}>
              <button onClick={() => setShowNotif(s => !s)} style={{
                position: "relative", background: sinLeer > 0 ? "rgba(239,68,68,0.1)" : "rgba(139,92,246,0.1)",
                border: `1px solid ${sinLeer > 0 ? "rgba(239,68,68,0.3)" : "rgba(139,92,246,0.2)"}`,
                color: sinLeer > 0 ? "#DC2626" : "#8B5CF6",
                width: 40, height: 40, borderRadius: 8, cursor: "pointer", fontSize: "1rem",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: sinLeer > 0 ? "pulse 2s ease infinite" : "none",
              }}>
                🔔{sinLeer > 0 && (
                  <span style={{ position: "absolute", top: -6, right: -6, background: "#EF4444", color: "#FFF", borderRadius: "50%", width: 18, height: 18, fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    {sinLeer}
                  </span>
                )}
              </button>
              {showNotif && (
                <div style={{ position: "absolute", top: 48, right: 0, background: "#FFF", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.14)", border: "1px solid #F1F5F9", width: 300, zIndex: 200, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", animation: "slideIn 0.2s ease" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.67rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 0.35rem" }}>
                    ALERTAS {sinLeer > 0 && `· ${sinLeer} sin leer`}
                  </p>
                  {notifs.filter(n => !leidas.has(n.id)).map(n => (
                    <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: "0.45rem", background: "#FEF2F2", borderRadius: 8, padding: "0.55rem 0.65rem", borderLeft: "3px solid #EF4444", cursor: "pointer" }}
                      onClick={() => { setShowNotif(false); window.location.assign(n.ruta); }}>
                      <span>{n.icon}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: "0.8rem", color: "#374151", margin: 0 }}>{n.texto}</p>
                        <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: 0 }}>Ir a corregir →</p>
                      </div>
                      <button title="Descartar" onClick={e => { e.stopPropagation(); marcarLeida(n.id); }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", fontSize: "0.75rem", padding: 0, flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  {notifs.every(n => leidas.has(n.id)) && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", background: "#F0FDF4", borderRadius: 8, padding: "0.55rem 0.65rem", borderLeft: "3px solid #10B981" }}>
                      <span>✅</span><p style={{ fontSize: "0.8rem", color: "#374151", margin: 0 }}>Sin alertas pendientes</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={cargar} disabled={loading} style={{
              background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#8B5CF6",
              padding: "0.5rem 1.1rem", borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 700, fontSize: "0.84rem", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "0.4rem",
            }}>
              <span style={{ display: "inline-block", animation: loading ? "spin 0.7s linear infinite" : "none" }}>↻</span>
              {loading ? "Cargando…" : "Actualizar"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem 0" }}>
            <div style={{ width: 30, height: 30, border: "3px solid #F1F5F9", borderTop: "3px solid #8B5CF6", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <p style={{ color: "#9CA3AF", marginTop: "1rem", fontSize: "0.85rem" }}>Cargando datos…</p>
          </div>
        ) : (
          <>
            {/* ══ BANNER DEVUELTAS (si hay) ══ */}
            {kpis.devueltas > 0 && (
              <div style={{ background: "linear-gradient(135deg, #FEF2F2, #FFF5F5)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "0.85rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", animation: "fadeUp 0.3s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <span style={{ fontSize: "1.3rem", animation: "pulse 2s ease infinite" }}>⚠️</span>
                  <div>
                    <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#DC2626", margin: 0, textTransform: "uppercase" }}>
                      {kpis.devueltas} orden{kpis.devueltas !== 1 ? "es devueltas" : " devuelta"} para corrección
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#EF4444", margin: 0 }}>Requieren tu atención inmediata</p>
                  </div>
                </div>
                <button onClick={() => { setFiltroEstado("Devuelto"); }} style={{ background: "#EF4444", color: "#FFF", border: "none", borderRadius: 8, padding: "0.45rem 1rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", whiteSpace: "nowrap" }}>
                  Ver devueltas →
                </button>
              </div>
            )}

            {/* ══ FILA SUPERIOR: KPIs + DONA + PROGRESO ══ */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", marginBottom: "0", alignItems: "start" }}>

              {/* KPIs 2x2 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.9rem" }}>
                {[
                  { icon: "🔬", label: "En Proceso",  value: kpis.enProceso,  color: "#3B82F6", desc: "Con resultados activos",  max: total, filtro: "En Proceso" },
                  { icon: "↩️", label: "Devueltas",   value: kpis.devueltas,  color: "#EF4444", desc: "Requieren corrección",    max: total, filtro: "Devuelto"   },
                  { icon: "⏳", label: "Por Validar", value: kpis.porValidar, color: "#8B5CF6", desc: "Enviadas, en revisión",   max: total, filtro: "Por Validar"},
                  { icon: "✅", label: "Validadas",   value: kpis.validadas,  color: "#10B981", desc: "Completadas y publicadas", max: total, filtro: "Validado"  },
                ].map((k, i) => (
                  <KpiCard key={k.label} {...k} delay={i * 60} anim={animKpis}
                    active={filtroEstado === k.filtro}
                    onClick={() => setFiltroEstado(prev => prev === k.filtro ? "TODOS" : k.filtro)}
                  />
                ))}
              </div>

              {/* Panel derecho: dona + progreso global */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", minWidth: 220 }}>
                {/* Dona */}
                <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #F1F5F9", padding: "1.2rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.85rem" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                    Mis estados
                  </p>
                  <DonutChart data={donutData} size={130} />
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {[
                      { label: "En Proceso",  value: kpis.enProceso,  color: "#3B82F6", filtro: "En Proceso"  },
                      { label: "Devueltas",   value: kpis.devueltas,  color: "#EF4444", filtro: "Devuelto"    },
                      { label: "Por Validar", value: kpis.porValidar, color: "#8B5CF6", filtro: "Por Validar" },
                      { label: "Validadas",   value: kpis.validadas,  color: "#10B981", filtro: "Validado"    },
                    ].filter(d => d.value > 0).map(d => (
                      <div key={d.label}
                        onClick={() => setFiltroEstado(prev => prev === d.filtro ? "TODOS" : d.filtro)}
                        style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", padding: "0.15rem 0.3rem", borderRadius: 6, background: filtroEstado === d.filtro ? `${d.color}12` : "transparent", transition: "background 0.15s" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: "0.72rem", color: filtroEstado === d.filtro ? d.color : "#6B7280", flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: filtroEstado === d.filtro ? 700 : 600 }}>{d.label}</span>
                        <span style={{ fontSize: "0.72rem", fontWeight: 800, color: d.color, fontFamily: "'Barlow Condensed', sans-serif" }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Progreso global de exámenes */}
                <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #F1F5F9", padding: "1.1rem 1.2rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.85rem" }}>
                    Progreso global
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.85rem" }}>
                    <ProgressRing pct={pctGlobal} color={pctGlobal === 100 ? "#10B981" : "#8B5CF6"} size={56} stroke={6} />
                    <div>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.6rem", fontWeight: 800, color: pctGlobal === 100 ? "#059669" : "#1F2937", margin: 0, lineHeight: 1 }}>{pctGlobal}%</p>
                      <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: 0 }}>{examenesHechos}/{totalExamenes} exámenes</p>
                    </div>
                  </div>
                  <BarraProgreso label="Completados"  value={examenesHechos}                  total={totalExamenes} color="#10B981" icon="✅" />
                  <BarraProgreso label="Pendientes"   value={totalExamenes - examenesHechos}  total={totalExamenes} color="#F59E0B" icon="🔬" />
                </div>

                {/* Tasa de aprobación: validadas vs devueltas */}
                <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #F1F5F9", padding: "1.1rem 1.2rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", flex: 1 }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.85rem" }}>
                    Tasa de aprobación
                  </p>
                  {tasaAprobacion === null ? (
                    <p style={{ fontSize: "0.75rem", color: "#9CA3AF", textAlign: "center", padding: "0.5rem 0" }}>Sin resultados validados o devueltos todavía</p>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", marginBottom: "0.85rem" }}>
                        <ProgressRing pct={tasaAprobacion} color={tasaAprobacion >= 80 ? "#10B981" : tasaAprobacion >= 50 ? "#F59E0B" : "#EF4444"} size={56} stroke={6} />
                        <div>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.6rem", fontWeight: 800, color: tasaAprobacion >= 80 ? "#059669" : tasaAprobacion >= 50 ? "#D97706" : "#DC2626", margin: 0, lineHeight: 1 }}>{tasaAprobacion}%</p>
                          <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: 0 }}>de tus resultados fueron aprobados</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#6B7280" }}>
                        <span>✅ {kpis.validadas} validados</span>
                        <span>↩️ {kpis.devueltas} devueltos</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ══ GRÁFICOS: TENDENCIA SEMANAL + EXÁMENES MÁS FRECUENTES ══ */}
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
              <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #F1F5F9", padding: "1.1rem 1.3rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                    📈 Tendencia · últimos 7 días
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {filtroDia && (
                      <span onClick={() => setFiltroDia(null)} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "rgba(139,92,246,0.1)", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.25)", padding: "0.1rem 0.5rem", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                        Filtrando día ✕
                      </span>
                    )}
                    <span style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>
                      {tendenciaSemana.reduce((s, d) => s + d.value, 0)} órdenes
                    </span>
                  </div>
                </div>
                <TendenciaBars
                  data={tendenciaSemana}
                  color="#8B5CF6"
                  active={filtroDia}
                  onBarClick={(key) => setFiltroDia(prev => prev === key ? null : key)}
                />
              </div>

              <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #F1F5F9", padding: "1.1rem 1.3rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                    🧪 Exámenes más frecuentes
                  </p>
                  {filtroExamen && (
                    <span onClick={() => setFiltroExamen(null)} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", background: "rgba(139,92,246,0.1)", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.25)", padding: "0.1rem 0.5rem", borderRadius: 20, fontSize: "0.65rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      ✕ Quitar filtro
                    </span>
                  )}
                </div>
                {examenesFrecuentes.length === 0 ? (
                  <p style={{ fontSize: "0.78rem", color: "#9CA3AF", textAlign: "center", padding: "1.5rem 0" }}>Sin datos suficientes todavía</p>
                ) : (
                  examenesFrecuentes.map((e) => (
                    <BarraProgreso
                      key={e.nombre} label={e.nombre} value={e.cantidad} total={maxExamenFrecuente} color="#8B5CF6" icon="🧬"
                      active={filtroExamen === e.nombre}
                      onClick={() => setFiltroExamen(prev => prev === e.nombre ? null : e.nombre)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* ══ ACCESOS RÁPIDOS ══ */}
            <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #F1F5F9", padding: "1.1rem 1.4rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", marginBottom: "1.25rem" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.75rem" }}>Accesos rápidos</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.65rem" }}>
                {[
                  { icon: "🔬", label: "Ingresar Resultados", desc: `${kpis.enProceso + kpis.devueltas} órdenes pendientes`, path: "/especialista/resultados", hl: true, badge: kpis.enProceso + kpis.devueltas },
                  { icon: "👤", label: "Mi Perfil",           desc: "Editar datos y contraseña",  path: "/especialista/perfil" },
                ].map(c => (
                  <div key={c.label} className="quick-card" onClick={() => window.location.assign(c.path)}
                    style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.85rem", border: `1.5px solid ${c.hl ? "rgba(139,92,246,0.3)" : "#F1F5F9"}`, borderRadius: 10, cursor: "pointer", transition: "all 0.17s", background: c.hl ? "rgba(139,92,246,0.04)" : "#FFF", position: "relative" }}>
                    <span style={{ fontSize: "1.3rem" }}>{c.icon}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.86rem", color: "#1F2937", margin: 0, textTransform: "uppercase" }}>{c.label}</p>
                      <p style={{ fontSize: "0.73rem", color: c.hl && c.badge > 0 ? "#7C3AED" : "#9CA3AF", margin: 0, fontWeight: c.hl && c.badge > 0 ? 600 : 400 }}>{c.desc}</p>
                    </div>
                    {c.badge > 0 && (
                      <span style={{ background: "#EF4444", color: "#FFF", borderRadius: "50%", width: 20, height: 20, fontSize: "0.62rem", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, flexShrink: 0 }}>{c.badge}</span>
                    )}
                    <span style={{ color: "#CBD5E1" }}>→</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ══ TABLA / CARDS DE ÓRDENES ══ */}
            <div style={{ background: "#FFF", borderRadius: 14, border: "1px solid #F1F5F9", padding: "1.25rem 1.4rem", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.92rem", fontWeight: 700, color: "#1F2937", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                    Mis Órdenes
                  </p>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, background: "rgba(139,92,246,0.1)", color: "#7C3AED", padding: "0.12rem 0.5rem", borderRadius: 20 }}>
                    {ordenesFiltradas.length} / {ordenes.length}
                  </span>
                  {filtroEstado !== "TODOS" && (
                    <span
                      onClick={() => setFiltroEstado("TODOS")}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: getMeta(filtroEstado).bg, color: getMeta(filtroEstado).color, border: `1px solid ${getMeta(filtroEstado).color}40`, padding: "0.12rem 0.55rem", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {getMeta(filtroEstado).icon} {filtroEstado} ✕
                    </span>
                  )}
                  {filtroDia && (
                    <span
                      onClick={() => setFiltroDia(null)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(139,92,246,0.1)", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.25)", padding: "0.12rem 0.55rem", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      📅 {fmt(filtroDia)} ✕
                    </span>
                  )}
                  {filtroExamen && (
                    <span
                      onClick={() => setFiltroExamen(null)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", background: "rgba(139,92,246,0.1)", color: "#7C3AED", border: "1px solid rgba(139,92,246,0.25)", padding: "0.12rem 0.55rem", borderRadius: 20, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif" }}>
                      🧪 {filtroExamen} ✕
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="text" placeholder="🔍 Ticket o paciente…" value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    style={{ padding: "0.45rem 0.8rem", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: "0.82rem", fontFamily: "'Barlow', sans-serif", outline: "none", background: "#F9FAFB", width: 190, boxSizing: "border-box" }}
                  />
                  <div style={{ display: "flex", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
                    {[["cards", "⊞"], ["tabla", "≡"]].map(([v, ic]) => (
                      <button key={v} onClick={() => setVista(v)} style={{
                        padding: "0.4rem 0.65rem", border: "none", background: vistaOrdenes === v ? "#8B5CF6" : "#FFF",
                        color: vistaOrdenes === v ? "#FFF" : "#9CA3AF", cursor: "pointer", fontSize: "0.9rem", transition: "all 0.15s",
                      }}>{ic}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filtros — por estado_resultado del especialista */}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "1.1rem" }}>
                {FILTROS.map(f => {
                  const meta = getMeta(f === "TODOS" ? null : f);
                  const active = filtroEstado === f;
                  const count = f === "TODOS" ? ordenes.length : ordenes.filter(o => getEstadoEsp(o) === f).length;
                  return (
                    <button key={f} className="filtro-btn" onClick={() => setFiltroEstado(f)} style={{
                      padding: "0.28rem 0.75rem", borderRadius: 20, border: `1px solid ${active ? meta.color : "#E5E7EB"}`,
                      background: active ? meta.bg : "transparent", color: active ? meta.color : "#6B7280",
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.7rem",
                      cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em", transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: "0.3rem",
                    }}>
                      {f !== "TODOS" && <span>{getMeta(f).icon}</span>}
                      {f === "TODOS" ? "Todos" : f}
                      <span style={{ background: active ? "rgba(255,255,255,0.4)" : "#F3F4F6", borderRadius: 10, padding: "0 0.3rem", fontSize: "0.62rem" }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {ordenesFiltradas.length === 0 ? (
                <div style={{ textAlign: "center", color: "#9CA3AF", padding: "3.5rem", fontSize: "0.85rem" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🔍</div>
                  No hay órdenes con los filtros seleccionados
                </div>
              ) : vistaOrdenes === "cards" ? (

                /* ── VISTA CARDS ── */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.85rem" }}>
                  {ordenesPaginadas.map((o, i) => {
                    const estadoEsp = getEstadoEsp(o);
                    const meta      = getMeta(estadoEsp);
                    const exams     = o.mis_examenes || [];
                    const totalEx   = exams.length;
                    const hechos    = exams.filter(e => e.completado).length;
                    const pct       = totalEx > 0 ? Math.round((hechos / totalEx) * 100) : 0;
                    const editable  = ["En Proceso", "Devuelto"].includes(estadoEsp) ||
                                      ["Generada", "En Proceso", "Devuelto"].includes(o.estado_orden);
                    const expandida = ordenExpandida === o.id_orden;

                    return (
                      <div key={o.id_orden} className="orden-card"
                        style={{
                          background: "#FDFDFD",
                          border: `1.5px solid ${expandida ? meta.color + "50" : estadoEsp === "Devuelto" ? "rgba(239,68,68,0.2)" : "#F1F5F9"}`,
                          borderRadius: 12, padding: "1rem 1.1rem", boxShadow: estadoEsp === "Devuelto" ? "0 2px 12px rgba(239,68,68,0.08)" : "0 2px 6px rgba(0,0,0,0.03)",
                          transition: "all 0.2s", cursor: "default",
                          animation: `fadeUp 0.35s ease ${i * 40}ms both`,
                        }}>

                        {/* Header card */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                          <div>
                            <span style={{ fontFamily: "'Courier New', monospace", fontSize: "0.78rem", color: "#374151", background: "#F3F4F6", padding: "0.1rem 0.38rem", borderRadius: 4 }}>
                              #{o.numero_ticket || o.id_orden}
                            </span>
                            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", color: "#1F2937", margin: "0.4rem 0 0", lineHeight: 1.2 }}>
                              {o.paciente_nombre || "Paciente"}
                            </p>
                            <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: "0.15rem 0 0" }}>
                              {o.paciente_cedula || ""} · {fmt(o.fecha_orden)}
                            </p>
                          </div>
                          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <ProgressRing pct={pct} color={pct === 100 ? "#10B981" : meta.color} size={52} stroke={5} />
                            <span style={{ position: "absolute", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 800, color: pct === 100 ? "#059669" : "#374151" }}>
                              {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Estado del especialista */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.65rem" }}>
                          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, background: meta.bg, color: meta.color, padding: "0.18rem 0.55rem", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, display: "inline-block", animation: estadoEsp === "En Proceso" ? "pulse 2s ease infinite" : "none" }} />
                            {meta.label}
                          </span>
                          <span style={{ fontSize: "0.72rem", color: hechos === totalEx && totalEx > 0 ? "#059669" : "#6B7280", fontWeight: 600 }}>
                            {hechos}/{totalEx} exáms.
                          </span>
                        </div>

                        {/* Expandir exámenes */}
                        {totalEx > 0 && (
                          <button onClick={() => setExpand(expandida ? null : o.id_orden)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: "#9CA3AF", padding: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600 }}>
                            {expandida ? "▲ Ocultar exámenes" : "▼ Ver exámenes"}
                          </button>
                        )}

                        {expandida && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.65rem", padding: "0.5rem", background: "#F8FAFC", borderRadius: 8 }}>
                            {exams.map((ex, j) => (
                              <div key={j} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span style={{ fontSize: "0.65rem", color: ex.completado ? "#059669" : "#D1D5DB" }}>{ex.completado ? "✓" : "○"}</span>
                                <span style={{ fontSize: "0.75rem", color: ex.completado ? "#374151" : "#9CA3AF", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: ex.completado ? 700 : 400 }}>
                                  {ex.nombre_examen}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Acción */}
                        {editable && (
                          <button className="accion-btn"
                            onClick={() => window.location.assign(`/especialista/resultados?orden=${o.id_orden}`)}
                            style={{
                              width: "100%", padding: "0.55rem", border: "none", borderRadius: 8, cursor: "pointer",
                              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem",
                              letterSpacing: "0.05em", textTransform: "uppercase", transition: "all 0.15s",
                              background: estadoEsp === "Devuelto"
                                ? "linear-gradient(135deg, #EF4444, #DC2626)"
                                : "linear-gradient(135deg, #7C3AED, #8B5CF6)",
                              color: "#FFF",
                            }}>
                            {estadoEsp === "Devuelto" ? "🔧 Corregir ahora" : "📝 Ingresar resultados"}
                          </button>
                        )}
                        {estadoEsp === "Por Validar" && (
                          <div style={{ textAlign: "center", fontSize: "0.78rem", color: "#8B5CF6", fontWeight: 600, paddingTop: "0.25rem" }}>⏳ En revisión del administrador</div>
                        )}
                        {estadoEsp === "Validado" && (
                          <div style={{ textAlign: "center", fontSize: "0.78rem", color: "#059669", fontWeight: 600, paddingTop: "0.25rem" }}>✅ Resultado publicado</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (

                /* ── VISTA TABLA ── */
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
                    <thead>
                      <tr>
                        {["Ticket", "Paciente", "Fecha", "Progreso", "Mi Estado", "Acción"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "0.65rem 0.85rem", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.69rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid #F1F5F9", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ordenesPaginadas.map((o, i) => {
                        const estadoEsp = getEstadoEsp(o);
                        const meta      = getMeta(estadoEsp);
                        const exams     = o.mis_examenes || [];
                        const hechos    = exams.filter(e => e.completado).length;
                        const pct       = exams.length > 0 ? Math.round((hechos / exams.length) * 100) : 0;
                        const editable  = ["En Proceso", "Devuelto"].includes(estadoEsp) ||
                                          ["Generada", "En Proceso", "Devuelto"].includes(o.estado_orden);
                        return (
                          <tr key={o.id_orden} className="tr-hover" style={{ background: i % 2 === 0 ? "#FAFAFA" : "#FFF" }}>
                            <td style={{ padding: "0.78rem 0.85rem", borderBottom: "1px solid #F8FAFC", verticalAlign: "middle" }}>
                              <span style={{ fontFamily: "'Courier New', monospace", fontSize: "0.78rem", color: "#374151", background: "#F3F4F6", padding: "0.11rem 0.38rem", borderRadius: 4 }}>#{o.numero_ticket || o.id_orden}</span>
                            </td>
                            <td style={{ padding: "0.78rem 0.85rem", borderBottom: "1px solid #F8FAFC", verticalAlign: "middle" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#1F2937" }}>{o.paciente_nombre || "—"}</div>
                              <div style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>{o.paciente_cedula || ""}</div>
                            </td>
                            <td style={{ padding: "0.78rem 0.85rem", borderBottom: "1px solid #F8FAFC", verticalAlign: "middle", fontSize: "0.8rem", color: "#6B7280", whiteSpace: "nowrap" }}>
                              {fmt(o.fecha_orden)}
                            </td>
                            <td style={{ padding: "0.78rem 0.85rem", borderBottom: "1px solid #F8FAFC", verticalAlign: "middle", minWidth: 120 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <ProgressRing pct={pct} color={pct === 100 ? "#10B981" : meta.color} size={32} stroke={4} />
                                <span style={{ fontSize: "0.75rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: pct === 100 ? "#059669" : "#374151" }}>
                                  {hechos}/{exams.length}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: "0.78rem 0.85rem", borderBottom: "1px solid #F8FAFC", verticalAlign: "middle" }}>
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.69rem", fontWeight: 700, background: meta.bg, color: meta.color, padding: "0.2rem 0.55rem", borderRadius: 20, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                                <span style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, display: "inline-block", animation: estadoEsp === "En Proceso" ? "pulse 2s ease infinite" : "none" }} />
                                {meta.label}
                              </span>
                            </td>
                            <td style={{ padding: "0.78rem 0.85rem", borderBottom: "1px solid #F8FAFC", verticalAlign: "middle" }}>
                              {editable ? (
                                <button className="accion-btn"
                                  onClick={() => window.location.assign(`/especialista/resultados?orden=${o.id_orden}`)}
                                  style={{
                                    background: estadoEsp === "Devuelto" ? "rgba(239,68,68,0.1)" : "rgba(139,92,246,0.1)",
                                    border: `1px solid ${estadoEsp === "Devuelto" ? "rgba(239,68,68,0.25)" : "rgba(139,92,246,0.25)"}`,
                                    color: estadoEsp === "Devuelto" ? "#DC2626" : "#7C3AED",
                                    padding: "0.38rem 0.75rem", borderRadius: 7, cursor: "pointer",
                                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                                    fontSize: "0.75rem", whiteSpace: "nowrap", transition: "all 0.15s",
                                  }}>
                                  {estadoEsp === "Devuelto" ? "🔧 Corregir" : "📝 Ingresar"}
                                </button>
                              ) : estadoEsp === "Por Validar" ? (
                                <span style={{ fontSize: "0.75rem", color: "#8B5CF6" }}>⏳ En revisión</span>
                              ) : (
                                <span style={{ fontSize: "0.75rem", color: "#10B981" }}>✅ Finalizado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <Paginacion
                pagina={paginaSegura}
                totalPaginas={totalPaginas}
                onChange={setPagina}
                totalItems={ordenesFiltradas.length}
                porPagina={porPagina}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   KPI CARD
══════════════════════════════════════════════════════════ */
function KpiCard({ icon, label, value, color, desc, max, delay, anim, onClick, active }) {
  const counted = useCountUp(value, 600, anim);
  return (
    <div
      onClick={onClick}
      style={{
        background: active ? `${color}08` : "#FFF",
        padding: "1.25rem 1.35rem", borderRadius: 14,
        border: active ? `1.5px solid ${color}55` : "1px solid #F1F5F9",
        boxShadow: active ? `0 4px 16px ${color}18` : "0 2px 6px rgba(0,0,0,0.03)",
        opacity: anim ? 1 : 0, transform: anim ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms, border 0.2s, box-shadow 0.2s, background 0.2s`,
        cursor: onClick ? "pointer" : "default",
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = `0 6px 20px ${color}22`; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = active ? `0 4px 16px ${color}18` : "0 2px 6px rgba(0,0,0,0.03)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.15rem", background: `${color}18` }}>
          {icon}
        </div>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2.1rem", fontWeight: 800, color, lineHeight: 1 }}>
          {counted}
        </span>
      </div>
      <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.2rem" }}>{label}</p>
      <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: "0 0 0.6rem" }}>{active ? <span style={{ color, fontWeight: 600 }}>Filtrando por este estado · click para quitar</span> : desc}</p>
      <MiniBar value={value} max={max || 1} color={color} />
    </div>
  );
}