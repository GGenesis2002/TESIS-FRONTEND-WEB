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
  const [sort, setSort]                 = useState({ col:"fecha_creacion", asc:false });

  const notifRef    = useRef(null);
  const intervalRef = useRef(null);

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

      setKpis({
        totalUsuarios:      parseInt(dk.total_usuarios       ?? pers.length,   10),
        usuariosActivos:    parseInt(dk.usuarios_activos     ?? pers.filter(p=>p.estado).length, 10),
        usuariosInactivos:  parseInt(dk.usuarios_inactivos   ?? pers.filter(p=>!p.estado).length, 10),
        totalExamenes:      parseInt(dk.total_examenes       ?? exams.filter(ex => ex.estado === true || ex.estado === 1 || ex.activo === true).length, 10),
        totalCategorias:    parseInt(dk.total_categorias     ?? cats.length,   10),
        totalParametros:    parseInt(dk.total_parametros     ?? params.length, 10),
        exSinParametros:    parseInt(dk.ex_sin_parametros    ?? 0,             10),
        usuariosActivosHoy: parseInt(dk.usuarios_activos_hoy ?? 0,             10),
      });

      setPersonal(pers);
      setAuditoria(dash.auditoriaDetallada || []);

      const ns = [];
      const inact = pers.filter(p => !p.estado).length;
      const examsSinParams = exams.filter(ex =>
        !ex.tipo_resultado?.toLowerCase().includes("pdf") &&
        !ex.archivo_pdf &&
        !ex.es_pdf
      );
      const sinParamsCount = dk.ex_sin_parametros != null
        ? parseInt(dk.ex_sin_parametros, 10)
        : examsSinParams.filter(ex => !(params||[]).some(p => p.id_examen === ex.id_examen)).length;

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
      return !q || `${p.nombres} ${p.apellidos} ${p.username} ${p.rol}`.toLowerCase().includes(q);
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
              <KpiCard anim={animKpis} delay={0}   icon="👥" label="Total Usuarios"   value={kpis.totalUsuarios}      color="#E88B3A" desc="Personal registrado" />
              <KpiCard anim={animKpis} delay={60}  icon="✅" label="Activos"          value={kpis.usuariosActivos}    color="#10B981" desc="Con acceso habilitado" />
              <KpiCard anim={animKpis} delay={120} icon="⏸️" label="Inactivos"        value={kpis.usuariosInactivos}  color="#6B7280" desc="Deshabilitados" />
              <KpiCard anim={animKpis} delay={180} icon="🕐" label="Activos Hoy"      value={kpis.usuariosActivosHoy} color="#3B82F6" desc="Con sesión hoy" />
            </div>

            {/* ── KPIs CATÁLOGO ── */}
            <p style={S.grpLabel}>CATÁLOGO Y CONFIGURACIÓN</p>
            <div style={S.kpiGrid}>
              <KpiCard anim={animKpis} delay={0}   icon="🧪" label="Exámenes"         value={kpis.totalExamenes}   color="#8B5CF6" desc="En catálogo activo" />
              <KpiCard anim={animKpis} delay={60}  icon="🗂️" label="Categorías"       value={kpis.totalCategorias} color="#3B82F6" desc="Especialidades" />
              <KpiCard anim={animKpis} delay={120} icon="🛠️" label="Parámetros"       value={kpis.totalParametros} color="#10B981" desc="Rangos de referencia" />
              <KpiCard anim={animKpis} delay={180} icon="⚡" label="Sin Parámetros"   value={kpis.exSinParametros} color={kpis.exSinParametros>0?"#F59E0B":"#10B981"} desc="Requieren configuración" />
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
                <h3 style={{ ...S.secTitle, margin:0 }}>Registros de Personal</h3>
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
                            style={{ background:i%2===0?"#FAFAFA":"#FFF", transition:"background 0.15s" }}
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

            {/* Filtros — solo búsqueda de texto */}
            <div style={{ marginBottom:"0.65rem" }}>
              <input
                type="text"
                placeholder="🔍  Buscar por usuario o descripción…"
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                style={S.sInput}
              />
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
function KpiCard({ icon, label, value, color, desc, delay, anim }) {
  return (
    <div style={{
      ...S.kpiCard,
      opacity:   anim ? 1 : 0,
      transform: anim ? "translateY(0)" : "translateY(14px)",
      transition:`opacity 0.35s ease ${delay}ms, transform 0.35s ease ${delay}ms`,
    }}>
      <div style={{ ...S.kpiIcon, background:`${color}15`, color }}>{icon}</div>
      <p style={S.kpiLabel}>{label}</p>
      <p style={{ ...S.kpiVal, color }}>{value}</p>
      <p style={S.kpiDesc}>{desc}</p>
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