import { useState, useEffect, useRef } from "react";
import API from "../../services/api";

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const fmt = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-EC", { day:"2-digit", month:"short", year:"numeric" });
};
const fmtFull = (iso) => {
  if (!iso) return null;
  return new Date(iso).toLocaleString("es-EC", {
    day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit",
  });
};

// Mapeo de acciones de auditoría → etiqueta + color
const ACCION_META = {
  REGISTRO_PERSONAL:   { label:"CREADO",       bg:"rgba(16,185,129,0.13)",  color:"#059669", icon:"➕" },
  ACTUALIZAR_PERSONAL: { label:"ACTUALIZADO",   bg:"rgba(59,130,246,0.13)",  color:"#2563EB", icon:"✏️" },
  LOGIN:               { label:"ACCESO",        bg:"rgba(139,92,246,0.13)",  color:"#7C3AED", icon:"🔑" },
  DESACTIVAR:          { label:"DESACTIVADO",   bg:"rgba(245,158,11,0.13)",  color:"#D97706", icon:"⏸️" },
  ACTIVAR:             { label:"ACTIVADO",      bg:"rgba(16,185,129,0.13)",  color:"#059669", icon:"▶️" },
  DEFAULT:             { label:"ACCIÓN",        bg:"rgba(156,163,175,0.13)", color:"#6B7280", icon:"📋" },
};
const getAccionMeta = (accion = "") => {
  const found = Object.keys(ACCION_META).find(
    k => k !== "DEFAULT" && accion.toUpperCase().includes(k)
  );
  return ACCION_META[found] || ACCION_META.DEFAULT;
};

// ─── Helper de colores por rol ────────────────────────
function getRolColor(rol) {
  if (!rol) return "#9CA3AF";
  const r = rol.toLowerCase();
  if (r.includes("admin"))      return "#E88B3A";
  if (r.includes("tecnico"))    return "#10B981";
  if (r.includes("especialis")) return "#8B5CF6";
  if (r.includes("asistente") || r.includes("secretaria")) return "#3B82F6";
  return "#6B7280";
}

// ── Un examen se considera "de tipo PDF" si así lo indica su tipo de resultado
//    o si tiene un archivo PDF asociado. Estos exámenes NO requieren parámetros
//    de referencia.
const esExamenPdf = (ex) =>
  (ex.tipo_resultado && String(ex.tipo_resultado).toLowerCase().includes("pdf")) ||
  ex.archivo_pdf === true ||
  ex.es_pdf === true;

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

/* ── Donut SVG ── */
function DonutChart({ data, size = 130 }) {
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

/* ── Sección de gráficos ── */
function ChartsSection({ kpis, auditoria }) {
  const usuariosData = [
    { label: "Activos",   value: kpis.usuariosActivos,   color: "#10B981" },
    { label: "Inactivos", value: kpis.usuariosInactivos, color: "#6B7280" },
  ].filter(d => d.value > 0);

  const catalogoItems = [
    { label: "Exámenes",    value: kpis.totalExamenes,   color: "#8B5CF6" },
    { label: "Categorías",  value: kpis.totalCategorias, color: "#3B82F6" },
    { label: "Parámetros",  value: kpis.totalParametros, color: "#10B981" },
  ];
  const maxCat = Math.max(...catalogoItems.map(c => c.value), 1);

  // Distribución de acciones de auditoría (creados, editados, accesos, etc.)
  const accionesCount = {};
  (auditoria || []).forEach(a => {
    const meta = getAccionMeta(a.accion);
    if (!accionesCount[meta.label]) accionesCount[meta.label] = { value: 0, color: meta.color };
    accionesCount[meta.label].value += 1;
  });
  const accionesData = Object.entries(accionesCount).map(([label, v]) => ({ label, value: v.value, color: v.color }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.4rem" }}>

      {/* Distribución de usuarios */}
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #F1F5F9", padding: "1.35rem", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
        <p style={{ ...S.grpLabel, margin: "0 0 1rem" }}>Distribución de Usuarios</p>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <DonutChart data={usuariosData} size={120} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[
              { label: "Activos",        value: kpis.usuariosActivos,    color: "#10B981", pct: kpis.totalUsuarios > 0 ? Math.round(kpis.usuariosActivos / kpis.totalUsuarios * 100) : 0 },
              { label: "Inactivos",      value: kpis.usuariosInactivos,  color: "#6B7280", pct: kpis.totalUsuarios > 0 ? Math.round(kpis.usuariosInactivos / kpis.totalUsuarios * 100) : 0 },
              { label: "Activos Hoy",   value: kpis.usuariosActivosHoy, color: "#3B82F6", pct: kpis.totalUsuarios > 0 ? Math.round(kpis.usuariosActivosHoy / kpis.totalUsuarios * 100) : 0 },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#374151", fontFamily: "'Barlow', sans-serif", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                    {item.label}
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: item.color, fontFamily: "'Barlow Condensed', sans-serif" }}>{item.value} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({item.pct}%)</span></span>
                </div>
                <BarAnim value={item.value} max={kpis.totalUsuarios || 1} color={item.color} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Catálogo */}
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #F1F5F9", padding: "1.35rem", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
        <p style={{ ...S.grpLabel, margin: "0 0 1rem" }}>Resumen del Catálogo</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {catalogoItems.map((item, i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <span style={{ fontSize: "0.78rem", color: "#374151", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{item.label}</span>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: item.color, fontFamily: "'Barlow Condensed', sans-serif" }}>{item.value}</span>
              </div>
              <BarAnim value={item.value} max={maxCat} color={item.color} height={10} />
            </div>
          ))}
          {kpis.exSinParametros > 0 && (
            <div style={{ marginTop: "0.25rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "0.6rem 0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>⚡</span>
              <span style={{ fontSize: "0.77rem", color: "#D97706", fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
                {kpis.exSinParametros} examen{kpis.exSinParametros !== 1 ? "es" : ""} sin parámetros configurados
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Distribución de acciones de auditoría */}
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #F1F5F9", padding: "1.35rem", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
        <p style={{ ...S.grpLabel, margin: "0 0 1rem" }}>Actividad de Auditoría</p>
        {accionesData.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120 }}>
            <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>Sin registros de auditoría todavía</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            <DonutChart data={accionesData} size={120} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {accionesData.map((item, i) => {
                const total = accionesData.reduce((s, d) => s + d.value, 0);
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "#374151", fontFamily: "'Barlow', sans-serif", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, display: "inline-block" }} />
                        {item.label}
                      </span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: item.color, fontFamily: "'Barlow Condensed', sans-serif" }}>{item.value} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({pct}%)</span></span>
                    </div>
                    <BarAnim value={item.value} max={total || 1} color={item.color} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function BarAnim({ value, max, color, height = 6 }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(max > 0 ? (value / max) * 100 : 0), 200); return () => clearTimeout(t); }, [value, max]);
  return (
    <div style={{ height, background: "#F1F5F9", borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: height / 2, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════ */
export default function DashboardTecnico() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [kpis, setKpis]             = useState({
    totalUsuarios:0, usuariosActivos:0, usuariosInactivos:0,
    totalExamenes:0, totalCategorias:0, totalParametros:0,
    exSinParametros:0, usuariosActivosHoy:0,
  });
  const [personal, setPersonal]     = useState([]);
  const [auditoria, setAuditoria]   = useState([]);
  const [examenesList, setExamenesList]   = useState([]);
  const [categoriasList, setCategoriasList] = useState([]);
  const [parametrosList, setParametrosList] = useState([]);
  const [examenesSinParam, setExamenesSinParam] = useState([]);
  const [personaDetalle, setPersonaDetalle]      = useState(null);
  const [kpiModalTipo, setKpiModalTipo]          = useState(null);
  const [kpiBusqueda, setKpiBusqueda]            = useState("");
  const [activosHoyList, setActivosHoyList]      = useState([]);
  const [cargandoActivosHoy, setCargandoActivosHoy] = useState(false);
  const [notifs, setNotifs]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showNotif, setShowNotif]   = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [animKpis, setAnimKpis]     = useState(false);

  // ── Modal filtros ──
  const [filtroAccion, setFiltroAccion] = useState("TODOS");
  const [busqueda, setBusqueda]         = useState("");
  const [pagina, setPagina]             = useState(1);
  const [fechaDesde, setFechaDesde]     = useState("");
  const [fechaHasta, setFechaHasta]     = useState("");
  const POR_PAG = 10;

  // ── Tabla personal ──
  const [busqPersonal, setBusqPersonal] = useState("");
  const [filtroPersonal, setFiltroPersonal] = useState("TODOS"); // "TODOS" | "activos" | "inactivos"
  const [sort, setSort]                 = useState({ col:"fecha_creacion", asc:false });

  const notifRef    = useRef(null);
  const intervalRef = useRef(null);
  const sinParamRef = useRef(null);

  const [leidas, setLeidas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("notifs_leidas") || "[]")); }
    catch { return new Set(); }
  });

  const marcarLeida = (id) => {
    setLeidas(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("notifs_leidas", JSON.stringify([...next]));
      return next;
    });
  };

  /* ── Carga de datos ── */
  const cargar = async () => {
    setLoading(true);
    setAnimKpis(false);
    try {
      const [resPersonal, resExamenes, resCategorias, resParametros, resDash] = await Promise.all([
        API.get("/personal"),
        API.get("/examenes"),
        API.get("/categorias"),
        API.get("/parametros").catch(() => ({ data: [] })),
        API.get("/dashboard/tecnico").catch(() => ({ data: {} })),
      ]);

      const pers   = resPersonal.data   || [];
      const exams  = resExamenes.data   || [];
      const cats   = resCategorias.data || [];
      const params = resParametros.data || [];
      const dash   = resDash.data       || {};
      const dk     = dash.kpis          || {};

      const examsActivos = exams.filter(ex => ex.estado === true || ex.estado === 1 || ex.activo === true);
      const idsConParametros = new Set((params || []).map(p => p.id_examen));
      const examsSinParametros = examsActivos.filter(ex => !esExamenPdf(ex) && !idsConParametros.has(ex.id_examen));

      setKpis({
        totalUsuarios:      parseInt(dk.total_usuarios       ?? pers.length,   10),
        usuariosActivos:    parseInt(dk.usuarios_activos     ?? pers.filter(p=>p.estado).length, 10),
        usuariosInactivos:  parseInt(dk.usuarios_inactivos   ?? pers.filter(p=>!p.estado).length, 10),
        totalExamenes:      parseInt(dk.total_examenes       ?? examsActivos.length, 10),
        totalCategorias:    parseInt(dk.total_categorias     ?? cats.length,   10),
        totalParametros:    parseInt(dk.total_parametros     ?? params.length, 10),
        // Se calcula siempre en el cliente para garantizar que los exámenes PDF queden excluidos,
        // sin depender de que el backend aplique la misma regla.
        exSinParametros:    examsSinParametros.length,
        usuariosActivosHoy: parseInt(dk.usuarios_activos_hoy ?? 0,             10),
      });
      setExamenesSinParam(examsSinParametros);
      setExamenesList(exams);
      setCategoriasList(cats);
      setParametrosList(params);

      setPersonal(pers);
      setAuditoria(dash.auditoriaDetallada || []);

      const ns = [];
      const inact = pers.filter(p => !p.estado).length;
      const sinParamsCount = examsSinParametros.length;

      if (inact > 0)         ns.push({ id:"inact",         tipo:"warn",    icon:"⚠️", texto:`${inact} usuario(s) inactivo(s)`, ruta:"/tecnico/usuarios" });
      if (sinParamsCount > 0) ns.push({ id:`sinp-${sinParamsCount}`, tipo:"warn", icon:"🧪", texto:`${sinParamsCount} examen(es) sin parámetros`, ruta:"/tecnico/parametros-examenes" });
      if (ns.length === 0)   ns.push({ id:"ok",            tipo:"success", icon:"✅", texto:"Sistema operando con normalidad", ruta:null });
      setNotifs(ns);

      setTimeout(() => setAnimKpis(true), 80);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /* ── Abrir el detalle de un KPI ── */
  const abrirKpiModal = (tipo) => {
    setKpiBusqueda("");
    setKpiModalTipo(tipo);
    if (tipo === "activosHoy" && activosHoyList.length === 0) cargarActivosHoy();
  };

  const cargarActivosHoy = async () => {
    setCargandoActivosHoy(true);
    try {
      const { data } = await API.get("/dashboard/usuarios-activos-hoy");
      setActivosHoyList(Array.isArray(data) ? data : []);
    } catch {
      setActivosHoyList([]);
    } finally {
      setCargandoActivosHoy(false);
    }
  };

  /* ── Polling: alertas del backend cada 30 s ── */
  const fetchAlertas = async () => {
    try {
      const { data } = await API.get("/dashboard/alertas");
      if (!Array.isArray(data)) return;
      const alertasApi = data.map((a, i) => ({
        id:    `api-${i}`,
        tipo:  a.tipo === "SEGURIDAD" ? "danger" : "warn",
        icon:  a.tipo === "SEGURIDAD" ? "🔐" : "⚠️",
        texto: a.mensaje,
        ruta:  a.tipo === "SEGURIDAD" ? "/tecnico/auditoria" : "/tecnico/usuarios",
      }));
      setNotifs(prev => {
        const locales = prev.filter(n => !n.id.startsWith("api-"));
        const merged  = [...locales.filter(n => n.tipo !== "success"), ...alertasApi];
        if (merged.length === 0) return [{ id:"ok", tipo:"success", icon:"✅", texto:"Sistema operando con normalidad", ruta:null }];
        return merged;
      });
    } catch {
      // Silencioso
    }
  };

  useEffect(() => {
    cargar();
    fetchAlertas();
    intervalRef.current = setInterval(fetchAlertas, 30000);

    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handler);
    return () => {
      clearInterval(intervalRef.current);
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  /* ── Personal: filtro + orden ── */
  const persFiltrado = personal
    .filter(p => {
      const q = busqPersonal.toLowerCase();
      const matchQ = !q || `${p.nombres} ${p.apellidos} ${p.username} ${p.rol}`.toLowerCase().includes(q);
      const matchE = filtroPersonal === "TODOS" ||
        (filtroPersonal === "activos"   &&  p.estado) ||
        (filtroPersonal === "inactivos" && !p.estado);
      return matchQ && matchE;
    })
    .sort((a, b) => {
      const va = a[sort.col] ?? "", vb = b[sort.col] ?? "";
      const cmp = String(va).localeCompare(String(vb));
      return sort.asc ? cmp : -cmp;
    });

  const toggleSort = (col) => setSort(s => ({ col, asc: s.col === col ? !s.asc : false }));
  const sortIcon   = (col) => sort.col !== col ? " ↕" : sort.asc ? " ↑" : " ↓";

  /* ── Auditoría: filtro + paginación ── */
  const FILTROS = ["TODOS","REGISTRO_PERSONAL","ACTUALIZAR_PERSONAL","LOGIN","ELIMINAR","DESACTIVAR"];
  const auditFilt = auditoria.filter(a => {
    const passA = filtroAccion === "TODOS" || (a.accion||"").toUpperCase().includes(filtroAccion);
    const passB = !busqueda   || `${a.username} ${a.descripcion}`.toLowerCase().includes(busqueda.toLowerCase());
    const fecha = a.fecha_registro ? new Date(a.fecha_registro) : null;
    const passC = !fechaDesde || (fecha && fecha >= new Date(fechaDesde + "T00:00:00"));
    const passD = !fechaHasta || (fecha && fecha <= new Date(fechaHasta + "T23:59:59"));
    return passA && passB && passC && passD;
  });
  const totalPags  = Math.max(1, Math.ceil(auditFilt.length / POR_PAG));
  const auditPag   = auditFilt.slice((pagina-1)*POR_PAG, pagina*POR_PAG);
  const sinLeer = notifs.filter(n => n.tipo !== "success" && !leidas.has(n.id)).length;

  /* ── Detalle de KPI: arma la lista + título según el KPI clickeado ── */
  const idsConParametrosSet = new Set((parametrosList || []).map(p => p.id_examen));
  const kq = kpiBusqueda.toLowerCase();

  const KPI_MODAL = {
    totalUsuarios: { titulo: "👥 Total de Usuarios", lista: personal },
    activos:       { titulo: "✅ Usuarios Activos",  lista: personal.filter(p => p.estado) },
    inactivos:     { titulo: "⏸️ Usuarios Inactivos", lista: personal.filter(p => !p.estado) },
    activosHoy:    { titulo: "🕐 Usuarios Activos Hoy", lista: activosHoyList },
    examenes:      { titulo: "🧪 Catálogo de Exámenes", lista: examenesList },
    categorias:    { titulo: "🗂️ Categorías de Exámenes", lista: categoriasList },
    parametros:    { titulo: "🛠️ Parámetros de Referencia", lista: parametrosList },
    sinParametros: { titulo: "⚡ Exámenes sin Parámetros", lista: examenesSinParam },
  };
  const kpiActivo = kpiModalTipo ? KPI_MODAL[kpiModalTipo] : null;

  let kpiListaFiltrada = [];
  if (kpiActivo) {
    if (["totalUsuarios", "activos", "inactivos"].includes(kpiModalTipo)) {
      kpiListaFiltrada = kpiActivo.lista.filter(p => !kq || `${p.nombres} ${p.apellidos} ${p.username}`.toLowerCase().includes(kq));
    } else if (kpiModalTipo === "activosHoy") {
      kpiListaFiltrada = kpiActivo.lista.filter(p => !kq || `${p.nombres} ${p.apellidos} ${p.username}`.toLowerCase().includes(kq));
    } else if (kpiModalTipo === "examenes" || kpiModalTipo === "sinParametros") {
      kpiListaFiltrada = kpiActivo.lista.filter(ex => !kq || (ex.nombre_examen || ex.nombre || "").toLowerCase().includes(kq));
    } else if (kpiModalTipo === "categorias") {
      kpiListaFiltrada = kpiActivo.lista.filter(c => !kq || (c.nombre || c.nombre_categoria || "").toLowerCase().includes(kq));
    } else if (kpiModalTipo === "parametros") {
      kpiListaFiltrada = kpiActivo.lista.filter(pa => {
        const examNombre = (examenesList.find(e => e.id_examen === pa.id_examen) || {}).nombre_examen || "";
        return !kq || (pa.nombre_parametro || "").toLowerCase().includes(kq) || examNombre.toLowerCase().includes(kq);
      });
    }
  }
  const KPI_LIMITE = 200;
  const kpiListaVisible = kpiListaFiltrada.slice(0, KPI_LIMITE);


  /* ════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={S.page}>
        {/* ── HEADER ── */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>PANEL DE <span style={S.accent}>CONTROL TÉCNICO</span></h2>
            <p style={S.sub}>
              Bienvenido, <strong>{user.nombres || "Técnico"}</strong> · Monitoreo del sistema y auditoría de usuarios
            </p>
          </div>

          <div style={{ display:"flex", gap:"0.6rem", alignItems:"center" }}>
            <div style={{ position:"relative" }} ref={notifRef}>
              <button onClick={() => setShowNotif(s=>!s)} style={S.iconBtn}>
                🔔{sinLeer>0 && <span style={S.badge}>{sinLeer}</span>}
              </button>
              {showNotif && (
                <div style={S.notifPanel}>
                  <p style={S.notifHdr}>NOTIFICACIONES</p>
                  {notifs.filter(n => !leidas.has(n.id)).map(n => (
                    <div
                      key={n.id}
                      style={{
                        ...S.notifItem,
                        borderLeftColor: n.tipo==="danger" ? "#DC2626" : n.tipo==="warn" ? "#F59E0B" : "#10B981",
                        cursor: n.ruta ? "pointer" : "default",
                      }}
                      onMouseEnter={e => { if (n.ruta) e.currentTarget.style.background="#F1F5F9"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="#F8FAFC"; }}
                    >
                      <div
                        style={{ display:"flex", alignItems:"flex-start", gap:"0.45rem", flex:1 }}
                        onClick={() => { if (n.ruta) { setShowNotif(false); window.location.assign(n.ruta); } }}
                      >
                        <span>{n.icon}</span>
                        <div style={{ flex:1 }}>
                          <p style={S.notifTxt}>{n.texto}</p>
                          {n.ruta && <p style={{ fontSize:"0.7rem", color:"#9CA3AF", margin:0 }}>Clic para ver →</p>}
                        </div>
                      </div>
                      <button
                        title="Descartar"
                        onClick={e => { e.stopPropagation(); marcarLeida(n.id); }}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", fontSize:"0.75rem", padding:"0 0 0 0.3rem", lineHeight:1, flexShrink:0 }}
                      >✕</button>
                    </div>
                  ))}
                  {notifs.every(n => leidas.has(n.id) || n.tipo === "success") && (
                    <div style={{ ...S.notifItem, borderLeftColor:"#10B981" }}>
                      <span>✅</span>
                      <p style={S.notifTxt}>Sistema operando con normalidad</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button onClick={cargar} style={S.refreshBtn} disabled={loading}>
              {loading ? "…" : "↻ Actualizar"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={S.loadBox}>
            <div style={S.spinner} />
            <p style={{ color:"#9CA3AF", marginTop:"1rem", fontSize:"0.85rem" }}>Sincronizando datos del sistema…</p>
          </div>
        ) : (
          <>
            {/* ── KPIs USUARIOS ── */}
            <p style={S.grpLabel}>ESTADO DE USUARIOS</p>
            <div style={S.kpiGrid}>
              <KpiCard anim={animKpis} delay={0}   icon="👥" label="Total Usuarios"   value={kpis.totalUsuarios}      color="#E88B3A" desc="Personal registrado" onClick={() => abrirKpiModal("totalUsuarios")} />
              <KpiCard anim={animKpis} delay={60}  icon="✅" label="Activos"          value={kpis.usuariosActivos}    color="#10B981" desc="Con acceso habilitado" onClick={() => abrirKpiModal("activos")} />
              <KpiCard anim={animKpis} delay={120} icon="⏸️" label="Inactivos"        value={kpis.usuariosInactivos}  color="#6B7280" desc="Deshabilitados" onClick={() => abrirKpiModal("inactivos")} />
              <KpiCard anim={animKpis} delay={180} icon="🕐" label="Activos Hoy"      value={kpis.usuariosActivosHoy} color="#3B82F6" desc="Con sesión hoy" onClick={() => abrirKpiModal("activosHoy")} />
            </div>

            {/* ── KPIs CATÁLOGO ── */}
            <p style={S.grpLabel}>CATÁLOGO Y CONFIGURACIÓN</p>
            <div style={S.kpiGrid}>
              <KpiCard anim={animKpis} delay={0}   icon="🧪" label="Exámenes"         value={kpis.totalExamenes}   color="#8B5CF6" desc="En catálogo activo" onClick={() => abrirKpiModal("examenes")} />
              <KpiCard anim={animKpis} delay={60}  icon="🗂️" label="Categorías"       value={kpis.totalCategorias} color="#3B82F6" desc="Especialidades" onClick={() => abrirKpiModal("categorias")} />
              <KpiCard anim={animKpis} delay={120} icon="🛠️" label="Parámetros"       value={kpis.totalParametros} color="#10B981" desc="Rangos de referencia" onClick={() => abrirKpiModal("parametros")} />
              <KpiCard anim={animKpis} delay={180} icon="⚡" label="Sin Parámetros"   value={kpis.exSinParametros} color={kpis.exSinParametros>0?"#F59E0B":"#10B981"} desc="Requieren configuración (excluye PDF)" onClick={() => abrirKpiModal("sinParametros")} />
            </div>

            {/* ── GRÁFICOS ── */}
            <ChartsSection kpis={kpis} auditoria={auditoria} />

            {/* ── EXÁMENES SIN PARÁMETROS (excluye exámenes de tipo PDF) ── */}
            <div style={S.section} ref={sinParamRef}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.95rem", flexWrap:"wrap", gap:"0.5rem" }}>
                <h3 style={{ ...S.secTitle, margin:0 }}>🧪 Exámenes sin Parámetros Configurados</h3>
                <span style={{ fontSize:"0.74rem", color:"#9CA3AF" }}>Los exámenes de resultado en PDF no requieren parámetros y no se listan aquí</span>
              </div>
              {examenesSinParam.length === 0 ? (
                <div style={{ textAlign:"center", color:"#059669", padding:"1.75rem", fontSize:"0.85rem", background:"rgba(16,185,129,0.06)", borderRadius:10 }}>
                  ✅ Todos los exámenes activos (no PDF) tienen parámetros configurados
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(240px, 1fr))", gap:"0.65rem" }}>
                  {examenesSinParam.map((ex, i) => (
                    <div key={ex.id_examen ?? i}
                      onClick={() => window.location.assign(`/tecnico/parametros-examenes?examen=${ex.id_examen}`)}
                      style={{
                        display:"flex", alignItems:"center", gap:"0.6rem", padding:"0.75rem 0.9rem",
                        border:"1px solid rgba(245,158,11,0.3)", background:"rgba(245,158,11,0.05)",
                        borderRadius:9, cursor:"pointer", transition:"all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background="rgba(245,158,11,0.1)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="rgba(245,158,11,0.05)"; }}
                    >
                      <span style={{ fontSize:"1.1rem" }}>⚡</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.85rem", color:"#1F2937", margin:0, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {ex.nombre_examen || ex.nombre || "Examen sin nombre"}
                        </p>
                        <p style={{ fontSize:"0.71rem", color:"#D97706", margin:0 }}>Sin parámetros de referencia</p>
                      </div>
                      <span style={{ color:"#D97706" }}>→</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── ACCESOS RÁPIDOS ── */}
            <div style={S.section}>
              <h3 style={S.secTitle}>Accesos Rápidos</h3>
              <div style={S.quickGrid}>
                <QuickCard icon="👥" label="Gestión de Usuarios"   desc="Crear y administrar personal"       path="/tecnico/usuarios" />
                <QuickCard icon="🧪" label="Catálogo de Exámenes"  desc="Exámenes, categorías, parámetros"   path="/tecnico/parametros-examenes" />
                <QuickCard icon="📊" label="Auditoría del Sistema" desc="Ver acciones y cambios"              action={() => { setShowModal(true); setPagina(1); setFechaDesde(""); setFechaHasta(""); setBusqueda(""); setFiltroAccion("TODOS"); }} hl />
                <QuickCard icon="⚙️" label="Mi Perfil"             desc="Configuración de cuenta"            path="/tecnico/perfil" />
              </div>
            </div>

            {/* ── TABLA PERSONAL ── */}
            <div style={S.section}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem", flexWrap:"wrap", gap:"0.75rem" }}>
                <div>
                  <h3 style={{ ...S.secTitle, margin:0 }}>Registros de Personal</h3>
                  <p style={{ fontSize:"0.72rem", color:"#9CA3AF", margin:"0.15rem 0 0" }}>Clic en una fila para ver el detalle completo</p>
                </div>
                <input
                  type="text"
                  placeholder="🔍  Buscar por nombre o usuario…"
                  value={busqPersonal}
                  onChange={e => setBusqPersonal(e.target.value)}
                  style={{ ...S.sInput, maxWidth:"280px" }}
                />
              </div>

              {persFiltrado.length === 0 ? (
                <p style={S.empty}>Sin resultados para "{busqPersonal}"</p>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={S.tbl}>
                    <thead>
                      <tr>
                        {[
                          { h:"Nombre completo",  c:"nombres"        },
                          { h:"Usuario",          c:"username"       },
                          { h:"Estado",           c:"estado"         },
                          { h:"Registrado por",   c:"registrado_por" },
                          { h:"Fecha registro",   c:"fecha_creacion" },
                          { h:"Último acceso",    c:"ultimo_acceso"  },
                        ].map(({ h, c }) => (
                          <th key={c} style={S.th} onClick={() => toggleSort(c)}>
                            {h}<span style={{ color:"#CBD5E1" }}>{sortIcon(c)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {persFiltrado.slice(0,12).map((p, i) => {
                        const activo = p.estado === true;
                        return (
                          <tr
                            key={p.id_usuario || i}
                            onClick={() => setPersonaDetalle(p)}
                            style={{ background:i%2===0?"#FAFAFA":"#FFF", transition:"background 0.15s", cursor:"pointer" }}
                            onMouseEnter={e => e.currentTarget.style.background="#FFF7ED"}
                            onMouseLeave={e => e.currentTarget.style.background=i%2===0?"#FAFAFA":"#FFF"}
                          >
                            {/* Nombre + correo */}
                            <td style={S.td}>
                              <div style={{ display:"flex", alignItems:"center", gap:"0.55rem" }}>
                                <div style={{ ...S.avatar, background:activo?"rgba(16,185,129,0.15)":"rgba(156,163,175,0.15)", color:activo?"#059669":"#9CA3AF" }}>
                                  {(p.nombres||"?")[0].toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight:600, color:"#1F2937", fontSize:"0.87rem" }}>{p.nombres} {p.apellidos}</div>
                                  <div style={{ fontSize:"0.72rem", color:"#9CA3AF" }}>{p.correo||"—"}</div>
                                </div>
                              </div>
                            </td>
                            {/* Username */}
                            <td style={S.td}><span style={S.mono}>@{p.username||"—"}</span></td>
                            {/* Estado */}
                            <td style={S.td}>
                              <span style={{ ...S.pill, background:activo?"rgba(16,185,129,0.1)":"rgba(107,114,128,0.1)", color:activo?"#059669":"#6B7280" }}>
                                {activo ? "● Activo" : "○ Inactivo"}
                              </span>
                            </td>
                            {/* Registrado por */}
                            <td style={S.td}>
                              {p.registrado_por
                                ? <span style={S.mono}>@{p.registrado_por}</span>
                                : <span style={{ color:"#D1D5DB", fontSize:"0.77rem" }}>Sistema</span>
                              }
                            </td>
                            {/* Fecha registro */}
                            <td style={{ ...S.td, whiteSpace:"nowrap", fontSize:"0.79rem", color:"#6B7280" }}>
                              {fmt(p.fecha_creacion) || <span style={{ color:"#E5E7EB" }}>—</span>}
                            </td>
                            {/* Último acceso */}
                            <td style={{ ...S.td, whiteSpace:"nowrap" }}>
                              {p.ultimo_acceso
                                ? <span style={{ color:"#3B82F6", fontSize:"0.79rem" }}>{fmtFull(p.ultimo_acceso)}</span>
                                : <span style={{ color:"#E5E7EB", fontSize:"0.77rem" }}>Sin acceso</span>
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {persFiltrado.length > 12 && (
                    <p style={{ textAlign:"center", fontSize:"0.77rem", color:"#9CA3AF", paddingTop:"0.7rem" }}>
                      Mostrando 12 de {persFiltrado.length} ·{" "}
                      <a href="/tecnico/usuarios" style={{ color:"#E88B3A", textDecoration:"none" }}>Ver todos →</a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL — DETALLE DE KPI (genérico para los 8 indicadores)
      ══════════════════════════════════════════════════════ */}
      {kpiModalTipo && (
        <div style={S.overlay} onClick={() => setKpiModalTipo(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.mHead}>
              <div>
                <h3 style={S.mTitle}>{kpiActivo.titulo}</h3>
                <p style={S.mSub}>{kpiListaFiltrada.length} registro{kpiListaFiltrada.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setKpiModalTipo(null)} style={S.closeBtn}>✕</button>
            </div>

            {kpiModalTipo !== "sinParametros" && (
              <input
                type="text"
                placeholder="🔍  Buscar…"
                value={kpiBusqueda}
                onChange={e => setKpiBusqueda(e.target.value)}
                style={{ ...S.sInput, marginBottom: "0.85rem" }}
                autoFocus
              />
            )}

            <div style={{ maxHeight: "440px", overflowY: "auto" }}>
              {/* ── Usuarios (Total / Activos / Inactivos) ── */}
              {["totalUsuarios", "activos", "inactivos"].includes(kpiModalTipo) && (
                kpiListaVisible.length === 0 ? (
                  <p style={S.empty}>Sin resultados</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {kpiListaVisible.map((p, i) => (
                      <div key={p.id_usuario || i}
                        onClick={() => { setKpiModalTipo(null); setPersonaDetalle(p); }}
                        style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.7rem", borderRadius: 8, cursor: "pointer", background: i % 2 === 0 ? "#FAFAFA" : "#FFF" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#FFF7ED"}
                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#FAFAFA" : "#FFF"}
                      >
                        <div style={{ ...S.avatar, background: p.estado ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)", color: p.estado ? "#059669" : "#9CA3AF" }}>
                          {(p.nombres || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, color: "#1F2937", fontSize: "0.87rem", margin: 0 }}>{p.nombres} {p.apellidos}</p>
                          <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: 0 }}>@{p.username || "—"}</p>
                        </div>
                        <span style={{ ...S.pill, background: p.estado ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)", color: p.estado ? "#059669" : "#6B7280" }}>
                          {p.estado ? "● Activo" : "○ Inactivo"}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ── Activos Hoy ── */}
              {kpiModalTipo === "activosHoy" && (
                cargandoActivosHoy ? (
                  <div style={{ ...S.loadBox, padding: "2.5rem 0" }}><div style={S.spinner} /></div>
                ) : kpiListaVisible.length === 0 ? (
                  <p style={S.empty}>Nadie ha iniciado sesión hoy</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {kpiListaVisible.map((p, i) => (
                      <div key={p.id_usuario || i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.55rem 0.7rem", borderRadius: 8, background: i % 2 === 0 ? "#FAFAFA" : "#FFF" }}>
                        <div style={{ ...S.avatar, background: "rgba(59,130,246,0.15)", color: "#3B82F6" }}>{(p.nombres || "?")[0].toUpperCase()}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, color: "#1F2937", fontSize: "0.87rem", margin: 0 }}>{p.nombres} {p.apellidos}</p>
                          <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: 0 }}>@{p.username || "—"}{p.rol ? ` · ${p.rol}` : ""}</p>
                        </div>
                        <span style={{ fontSize: "0.75rem", color: "#3B82F6" }}>{fmtFull(p.ultimo_acceso) || "—"}</span>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ── Exámenes / Sin Parámetros ── */}
              {(kpiModalTipo === "examenes" || kpiModalTipo === "sinParametros") && (
                kpiListaVisible.length === 0 ? (
                  <p style={S.empty}>{kpiModalTipo === "sinParametros" ? "✅ Todos los exámenes (no PDF) tienen parámetros" : "Sin resultados"}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {kpiListaVisible.map((ex, i) => {
                      const tieneParams = idsConParametrosSet.has(ex.id_examen);
                      const esPdf = esExamenPdf(ex);
                      return (
                        <div key={ex.id_examen || i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.7rem", borderRadius: 8, background: i % 2 === 0 ? "#FAFAFA" : "#FFF" }}>
                          <span style={{ fontSize: "1rem" }}>{esPdf ? "📄" : "🧪"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, color: "#1F2937", fontSize: "0.85rem", margin: 0 }}>{ex.nombre_examen || ex.nombre || "—"}</p>
                          </div>
                          {esPdf ? (
                            <span style={{ ...S.pill, background: "rgba(139,92,246,0.1)", color: "#7C3AED" }}>📄 PDF</span>
                          ) : tieneParams ? (
                            <span style={{ ...S.pill, background: "rgba(16,185,129,0.1)", color: "#059669" }}>✓ Con parámetros</span>
                          ) : (
                            <span style={{ ...S.pill, background: "rgba(245,158,11,0.1)", color: "#D97706" }}>⚡ Sin parámetros</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* ── Categorías ── */}
              {kpiModalTipo === "categorias" && (
                kpiListaVisible.length === 0 ? (
                  <p style={S.empty}>Sin resultados</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {kpiListaVisible.map((c, i) => (
                      <div key={c.id_categoria || i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.7rem", borderRadius: 8, background: i % 2 === 0 ? "#FAFAFA" : "#FFF" }}>
                        <span>🗂️</span>
                        <p style={{ flex: 1, fontWeight: 600, color: "#1F2937", fontSize: "0.85rem", margin: 0 }}>{c.nombre || c.nombre_categoria || "—"}</p>
                        {c.estado != null && (
                          <span style={{ ...S.pill, background: c.estado ? "rgba(16,185,129,0.1)" : "rgba(107,114,128,0.1)", color: c.estado ? "#059669" : "#6B7280" }}>
                            {c.estado ? "● Activa" : "○ Inactiva"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ── Parámetros ── */}
              {kpiModalTipo === "parametros" && (
                kpiListaVisible.length === 0 ? (
                  <p style={S.empty}>Sin resultados</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {kpiListaVisible.map((pa, i) => {
                      const examNombre = (examenesList.find(e => e.id_examen === pa.id_examen) || {}).nombre_examen;
                      return (
                        <div key={pa.id_parametro || i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.6rem 0.7rem", borderRadius: 8, background: i % 2 === 0 ? "#FAFAFA" : "#FFF" }}>
                          <span>🛠️</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, color: "#1F2937", fontSize: "0.85rem", margin: 0 }}>{pa.nombre_parametro || "—"}</p>
                            <p style={{ fontSize: "0.71rem", color: "#9CA3AF", margin: 0 }}>{examNombre || "Examen sin identificar"}</p>
                          </div>
                          {(pa.rango_min != null || pa.rango_max != null) && (
                            <span style={{ fontSize: "0.74rem", color: "#374151", whiteSpace: "nowrap" }}>
                              {pa.rango_min ?? "–"} – {pa.rango_max ?? "–"} {pa.unidad || ""}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {kpiListaFiltrada.length > KPI_LIMITE && (
                <p style={{ textAlign: "center", fontSize: "0.74rem", color: "#9CA3AF", padding: "0.75rem 0 0" }}>
                  Mostrando {KPI_LIMITE} de {kpiListaFiltrada.length} · refina la búsqueda para ver más
                </p>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1rem" }}>
              <button onClick={() => setKpiModalTipo(null)} style={S.btnSec}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — DETALLE DE PERSONAL
      ══════════════════════════════════════════════════════ */}
      {personaDetalle && (
        <div style={S.overlay} onClick={() => setPersonaDetalle(null)}>
          <div style={{ ...S.modal, maxWidth:"480px" }} onClick={e => e.stopPropagation()}>
            <div style={S.mHead}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.8rem" }}>
                <div style={{
                  ...S.avatar, width:48, height:48, fontSize:"1.2rem",
                  background: personaDetalle.estado ? "rgba(16,185,129,0.15)" : "rgba(156,163,175,0.15)",
                  color: personaDetalle.estado ? "#059669" : "#9CA3AF",
                }}>
                  {(personaDetalle.nombres || "?")[0].toUpperCase()}
                </div>
                <div>
                  <h3 style={S.mTitle}>{personaDetalle.nombres} {personaDetalle.apellidos}</h3>
                  <p style={S.mSub}>@{personaDetalle.username || "—"}</p>
                </div>
              </div>
              <button onClick={() => setPersonaDetalle(null)} style={S.closeBtn}>✕</button>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:"0.7rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.55rem 0", borderBottom:"1px solid #F8FAFC" }}>
                <span style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>Estado</span>
                <span style={{ ...S.pill, background:personaDetalle.estado?"rgba(16,185,129,0.1)":"rgba(107,114,128,0.1)", color:personaDetalle.estado?"#059669":"#6B7280" }}>
                  {personaDetalle.estado ? "● Activo" : "○ Inactivo"}
                </span>
              </div>
              {personaDetalle.rol && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.55rem 0", borderBottom:"1px solid #F8FAFC" }}>
                  <span style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>Rol</span>
                  <span style={{ ...S.pill, background:getRolColor(personaDetalle.rol)+"22", color:getRolColor(personaDetalle.rol) }}>👤 {String(personaDetalle.rol).toUpperCase()}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.55rem 0", borderBottom:"1px solid #F8FAFC" }}>
                <span style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>Correo</span>
                <span style={{ fontSize:"0.82rem", color:"#374151" }}>{personaDetalle.correo || "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.55rem 0", borderBottom:"1px solid #F8FAFC" }}>
                <span style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>Registrado por</span>
                <span style={{ fontSize:"0.82rem", color:"#374151" }}>{personaDetalle.registrado_por ? `@${personaDetalle.registrado_por}` : "Sistema"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.55rem 0", borderBottom:"1px solid #F8FAFC" }}>
                <span style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>Fecha de registro</span>
                <span style={{ fontSize:"0.82rem", color:"#374151" }}>{fmt(personaDetalle.fecha_creacion) || "—"}</span>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.55rem 0" }}>
                <span style={{ fontSize:"0.78rem", color:"#9CA3AF" }}>Último acceso</span>
                <span style={{ fontSize:"0.82rem", color: personaDetalle.ultimo_acceso ? "#3B82F6" : "#D1D5DB" }}>
                  {personaDetalle.ultimo_acceso ? fmtFull(personaDetalle.ultimo_acceso) : "Sin acceso registrado"}
                </span>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"flex-end", gap:"0.6rem", marginTop:"1.25rem" }}>
              <button
                onClick={() => {
                  setBusqueda(personaDetalle.username || "");
                  setPersonaDetalle(null);
                  setShowModal(true);
                  setPagina(1);
                }}
                style={S.btnSec}
              >
                Ver auditoría →
              </button>
              <button onClick={() => setPersonaDetalle(null)} style={S.btnPri}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — AUDITORÍA DEL SISTEMA
      ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div style={S.overlay} onClick={() => setShowModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>

            <div style={S.mHead}>
              <div>
                <h3 style={S.mTitle}>📊 AUDITORÍA DEL SISTEMA</h3>
                <p style={S.mSub}>Historial de acciones — creaciones, ediciones, desactivaciones y accesos de usuarios</p>
              </div>
              <button onClick={() => setShowModal(false)} style={S.closeBtn}>✕</button>
            </div>

            {/* Filtros ── acción + fechas + búsqueda */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "0.75rem" }}>

              {/* Botones de tipo de acción */}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                {FILTROS.map(f => {
                  const meta = getAccionMeta(f === "TODOS" ? "" : f);
                  const active = filtroAccion === f;
                  const count = f === "TODOS" ? auditoria.length : auditoria.filter(a => (a.accion || "").toUpperCase().includes(f)).length;
                  return (
                    <button key={f} onClick={() => { setFiltroAccion(f); setPagina(1); }} style={{
                      padding: "0.28rem 0.75rem", borderRadius: 20, cursor: "pointer",
                      border: `1px solid ${active ? meta.color : "#E5E7EB"}`,
                      background: active ? meta.bg : "transparent",
                      color: active ? meta.color : "#6B7280",
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.7rem",
                      textTransform: "uppercase", letterSpacing: "0.04em", transition: "all 0.15s",
                      display: "flex", alignItems: "center", gap: "0.3rem",
                    }}>
                      {f !== "TODOS" && <span>{meta.icon}</span>}
                      {f === "TODOS" ? "Todos" : f.replace("_", " ")}
                      <span style={{ background: active ? "rgba(255,255,255,0.4)" : "#F3F4F6", borderRadius: 10, padding: "0 0.3rem", fontSize: "0.62rem" }}>{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Búsqueda + rango de fechas */}
              <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="🔍  Buscar por usuario o descripción…"
                  value={busqueda}
                  onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                  style={{ ...S.sInput, flex: "1 1 200px" }}
                />
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={e => { setFechaDesde(e.target.value); setPagina(1); }}
                  style={{ ...S.sInput, flex: "0 0 140px" }}
                  title="Desde"
                />
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={e => { setFechaHasta(e.target.value); setPagina(1); }}
                  style={{ ...S.sInput, flex: "0 0 140px" }}
                  title="Hasta"
                />
                {(busqueda || fechaDesde || fechaHasta || filtroAccion !== "TODOS") && (
                  <button onClick={() => { setBusqueda(""); setFechaDesde(""); setFechaHasta(""); setFiltroAccion("TODOS"); setPagina(1); }}
                    style={{ ...S.btnSec, flexShrink: 0 }}>
                    ✕ Limpiar
                  </button>
                )}
              </div>
            </div>

            <p style={{ fontSize:"0.74rem", color:"#9CA3AF", margin:"0 0 0.5rem" }}>
              {auditFilt.length} registro{auditFilt.length!==1?"s":""} encontrado{auditFilt.length!==1?"s":""}
            </p>

            {/* Tabla */}
            <div style={{ overflowY:"auto", maxHeight:"360px", borderRadius:"10px", border:"1px solid #F1F5F9" }}>
              {auditPag.length === 0 ? (
                <div style={{ padding:"3rem", textAlign:"center", color:"#9CA3AF", fontSize:"0.84rem" }}>
                  {auditoria.length === 0
                    ? "No hay registros de auditoría en la base de datos aún."
                    : "Sin resultados para los filtros aplicados."}
                </div>
              ) : (
                <table style={{ ...S.tbl, margin:0 }}>
                  <thead>
                    <tr style={{ background:"#F8FAFC", position:"sticky", top:0, zIndex:1 }}>
                      {/* ── COLUMNA ROL AGREGADA ── */}
                      {["Fecha / Hora", "Usuario", "Perfil", "Acción", "Descripción del cambio"].map(h => (
                        <th key={h} style={{ ...S.th, background:"#F8FAFC", cursor:"default" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditPag.map((log, i) => {
                      const meta = getAccionMeta(log.accion);
                      return (
                        <tr key={i} style={{ background:i%2===0?"#FAFAFA":"#FFF" }}>
                          {/* Fecha */}
                          <td style={{ ...S.td, whiteSpace:"nowrap", fontSize:"0.78rem", color:"#6B7280", width:"145px" }}>
                            {fmtFull(log.fecha_registro) || "—"}
                          </td>
                          {/* Usuario */}
                          <td style={S.td}>
                            <span style={S.mono}>@{log.username||"sistema"}</span>
                          </td>
                          {/* ── CELDA PERFIL ── */}
                          <td style={{ ...S.td, width:"120px" }}>
                            {log.rol ? (
                              <span style={{
                                ...S.pill,
                                background: getRolColor(log.rol) + "22",
                                color:      getRolColor(log.rol),
                                fontWeight: 700,
                                fontSize:   "0.67rem",
                                border:     `1px solid ${getRolColor(log.rol)}44`,
                              }}>
                                👤 {log.rol?.toUpperCase()}
                              </span>
                            ) : (
                              <span style={{ fontSize:"0.75rem", color:"#CBD5E1" }}>—</span>
                            )}
                          </td>
                          {/* Acción */}
                          <td style={{ ...S.td, width:"130px" }}>
                            <span style={{ ...S.pill, background:meta.bg, color:meta.color, fontWeight:700, fontSize:"0.68rem" }}>
                              {meta.icon} {meta.label}
                            </span>
                          </td>
                          {/* Descripción */}
                          <td style={{ ...S.td, fontSize:"0.81rem", color:"#374151" }}>
                            {log.descripcion || <span style={{ color:"#D1D5DB" }}>Sin descripción</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginación */}
            {totalPags > 1 && (
              <div style={{ display:"flex", justifyContent:"center", alignItems:"center", gap:"0.5rem", marginTop:"0.65rem" }}>
                <button onClick={() => setPagina(p=>Math.max(1,p-1))}         disabled={pagina===1}        style={S.pagBtn}>‹ Anterior</button>
                <span style={{ fontSize:"0.79rem", color:"#6B7280" }}>Pág. {pagina} / {totalPags}</span>
                <button onClick={() => setPagina(p=>Math.min(totalPags,p+1))} disabled={pagina===totalPags} style={S.pagBtn}>Siguiente ›</button>
              </div>
            )}

            {/* Footer */}
            <div style={{ display:"flex", justifyContent:"flex-end", gap:"0.6rem", marginTop:"1rem" }}>
              <button onClick={() => setShowModal(false)} style={S.btnSec}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   SUB-COMPONENTES
═══════════════════════════════════════════════════════ */
function KpiCard({ icon, label, value, color, desc, delay, anim, onClick, active }) {
  const counted = useCountUp(value, 700, anim);
  return (
    <div
      onClick={onClick}
      style={{
        ...S.kpiCard,
        background: active ? `${color}08` : "#FFF",
        border: active ? `1.5px solid ${color}55` : "1px solid #F1F5F9",
        boxShadow: active ? `0 4px 16px ${color}18` : "0 2px 6px rgba(0,0,0,0.03)",
        cursor: onClick ? "pointer" : "default",
        opacity:   anim ? 1 : 0,
        transform: anim ? "translateY(0)" : "translateY(14px)",
        transition: `opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms, border 0.2s, box-shadow 0.2s`,
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow = `0 6px 20px ${color}22`; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow = active ? `0 4px 16px ${color}18` : "0 2px 6px rgba(0,0,0,0.03)"; }}
    >
      <div style={{ ...S.kpiIcon, background:`${color}15`, color }}>{icon}</div>
      <p style={S.kpiLabel}>{label}</p>
      <p style={{ ...S.kpiVal, color }}>{counted}</p>
      <p style={S.kpiDesc}>{active ? <span style={{ color, fontWeight: 600, fontSize: "0.7rem" }}>Filtrando · click para quitar</span> : desc}</p>
      <div style={{ ...S.kpiBar, background:`${color}20` }}>
        <div style={{ ...S.kpiBarFill, background:color, width:`${Math.min(100, value*8+20)}%` }} />
      </div>
    </div>
  );
}

function QuickCard({ icon, label, desc, path, action, hl }) {
  const go = () => action ? action() : window.location.assign(path);
  return (
    <div
      onClick={go}
      style={{ ...S.qCard, borderColor:hl?"rgba(232,139,58,0.35)":"#F1F5F9", background:hl?"rgba(232,139,58,0.04)":"#FFF" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor="#E88B3A"; e.currentTarget.style.background="rgba(232,139,58,0.07)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor=hl?"rgba(232,139,58,0.35)":"#F1F5F9"; e.currentTarget.style.background=hl?"rgba(232,139,58,0.04)":"#FFF"; }}
    >
      <span style={{ fontSize:"1.35rem" }}>{icon}</span>
      <div style={{ flex:1 }}>
        <p style={S.qLabel}>{label}</p>
        <p style={S.qDesc}>{desc}</p>
      </div>
      <span style={{ color:"#CBD5E1" }}>→</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ESTILOS
═══════════════════════════════════════════════════════ */
const S = {
  page:      { padding:"1.25rem", fontFamily:"'Barlow', sans-serif" },
  header:    { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem", flexWrap:"wrap", gap:"1rem" },
  title:     { fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.75rem", fontWeight:800, color:"#1F2937", margin:0, textTransform:"uppercase" },
  accent:    { color:"#E88B3A" },
  sub:       { fontSize:"0.83rem", color:"#6B7280", margin:"0.2rem 0 0" },

  iconBtn:   { position:"relative", background:"rgba(232,139,58,0.1)", border:"1px solid rgba(232,139,58,0.2)", color:"#E88B3A", width:"40px", height:"40px", borderRadius:"8px", cursor:"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center" },
  badge:     { position:"absolute", top:"-6px", right:"-6px", background:"#DC2626", color:"#FFF", borderRadius:"50%", width:"18px", height:"18px", fontSize:"0.6rem", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 },
  refreshBtn:{ background:"rgba(232,139,58,0.1)", border:"1px solid rgba(232,139,58,0.2)", color:"#E88B3A", padding:"0.5rem 1.1rem", borderRadius:"8px", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.84rem", cursor:"pointer" },

  notifPanel:{ position:"absolute", top:"48px", right:0, background:"#FFF", borderRadius:"12px", boxShadow:"0 8px 30px rgba(0,0,0,0.14)", border:"1px solid #F1F5F9", width:"285px", zIndex:200, padding:"1rem", display:"flex", flexDirection:"column", gap:"0.5rem" },
  notifHdr:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.67rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.14em", textTransform:"uppercase", margin:"0 0 0.35rem" },
  notifItem: { display:"flex", alignItems:"flex-start", gap:"0.45rem", background:"#F8FAFC", borderRadius:"8px", padding:"0.55rem 0.65rem", borderLeft:"3px solid" },
  notifTxt:  { fontSize:"0.8rem", color:"#374151", margin:0 },

  loadBox:   { display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"5rem 0" },
  spinner:   { width:"30px", height:"30px", border:"3px solid #F1F5F9", borderTop:"3px solid #E88B3A", borderRadius:"50%", animation:"spin 0.7s linear infinite" },

  grpLabel:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.67rem", fontWeight:700, color:"#9CA3AF", letterSpacing:"0.12em", textTransform:"uppercase", margin:"0 0 0.55rem" },
  kpiGrid:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(185px,1fr))", gap:"0.9rem", marginBottom:"1.65rem" },
  kpiCard:   { background:"#FFF", padding:"1.35rem", borderRadius:"12px", border:"1px solid #F1F5F9", boxShadow:"0 2px 6px rgba(0,0,0,0.03)" },
  kpiIcon:   { width:"40px", height:"40px", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.15rem", marginBottom:"0.85rem" },
  kpiLabel:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.7rem", fontWeight:600, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.05em", margin:"0 0 0.18rem" },
  kpiVal:    { fontSize:"2.1rem", fontWeight:800, margin:"0 0 0.18rem", fontFamily:"'Barlow Condensed',sans-serif", lineHeight:1 },
  kpiDesc:   { fontSize:"0.72rem", color:"#9CA3AF", margin:"0 0 0.65rem" },
  kpiBar:    { height:"4px", borderRadius:"2px", overflow:"hidden" },
  kpiBarFill:{ height:"100%", borderRadius:"2px", transition:"width 0.6s ease" },

  section:   { background:"#FFF", borderRadius:"12px", padding:"1.4rem", border:"1px solid #F1F5F9", marginBottom:"1.4rem", boxShadow:"0 2px 6px rgba(0,0,0,0.03)" },
  secTitle:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.92rem", fontWeight:700, color:"#1F2937", textTransform:"uppercase", letterSpacing:"0.05em", margin:"0 0 0.95rem" },
  quickGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"0.7rem" },
  qCard:     { display:"flex", alignItems:"center", gap:"0.65rem", padding:"0.85rem 0.95rem", border:"1.5px solid", borderRadius:"10px", cursor:"pointer", transition:"all 0.17s" },
  qLabel:    { fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.86rem", color:"#1F2937", margin:0, textTransform:"uppercase" },
  qDesc:     { fontSize:"0.73rem", color:"#9CA3AF", margin:0 },

  sInput:    { width:"100%", padding:"0.52rem 0.9rem", border:"1px solid #E5E7EB", borderRadius:"8px", fontSize:"0.82rem", fontFamily:"'Barlow',sans-serif", outline:"none", background:"#F9FAFB", boxSizing:"border-box" },
  tbl:       { width:"100%", borderCollapse:"collapse", fontSize:"0.83rem" },
  th:        { textAlign:"left", padding:"0.65rem 0.85rem", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.69rem", fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.06em", borderBottom:"1px solid #F1F5F9", whiteSpace:"nowrap", userSelect:"none", cursor:"pointer" },
  td:        { padding:"0.78rem 0.85rem", borderBottom:"1px solid #F8FAFC", verticalAlign:"middle" },
  avatar:    { width:"30px", height:"30px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:"0.82rem", flexShrink:0 },
  mono:      { fontFamily:"'Courier New',monospace", fontSize:"0.78rem", color:"#374151", background:"#F3F4F6", padding:"0.11rem 0.38rem", borderRadius:"4px" },
  rolBadge:  { fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.68rem", fontWeight:700, background:"rgba(139,92,246,0.1)", color:"#7C3AED", padding:"0.16rem 0.48rem", borderRadius:"5px", textTransform:"uppercase", letterSpacing:"0.04em" },
  pill:      { display:"inline-flex", alignItems:"center", gap:"0.16rem", fontFamily:"'Barlow Condensed',sans-serif", fontSize:"0.69rem", fontWeight:700, padding:"0.16rem 0.52rem", borderRadius:"20px", whiteSpace:"nowrap" },
  empty:     { textAlign:"center", color:"#9CA3AF", padding:"2.5rem", fontSize:"0.84rem" },

  overlay:   { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" },
  modal:     { background:"#FFF", borderRadius:"16px", padding:"1.65rem", maxWidth:"860px", width:"100%", maxHeight:"92vh", overflowY:"auto", boxShadow:"0 24px 60px rgba(0,0,0,0.2)" },
  mHead:     { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.1rem" },
  mTitle:    { fontFamily:"'Barlow Condensed',sans-serif", fontSize:"1.15rem", fontWeight:800, color:"#1F2937", margin:"0 0 0.2rem", textTransform:"uppercase" },
  mSub:      { fontSize:"0.79rem", color:"#6B7280", margin:0 },
  closeBtn:  { background:"#F3F4F6", border:"none", borderRadius:"8px", width:"30px", height:"30px", cursor:"pointer", fontSize:"0.83rem", color:"#6B7280", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  pagBtn:    { padding:"0.33rem 0.8rem", background:"#F3F4F6", border:"1px solid #E5E7EB", borderRadius:"7px", fontSize:"0.77rem", color:"#374151", cursor:"pointer" },
  btnSec:    { padding:"0.48rem 1rem", background:"#F3F4F6", border:"1px solid #E5E7EB", borderRadius:"8px", color:"#6B7280", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer" },
  btnPri:    { padding:"0.48rem 1rem", background:"#E88B3A", border:"none", borderRadius:"8px", color:"#FFF", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer" },
};