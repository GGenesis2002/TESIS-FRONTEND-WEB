import { useState, useEffect, useCallback } from "react";
import API from "../../services/api";

/* ══════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════ */
const fmt = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" });
};

const ESTADO_META = {
  "En Proceso":  { color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  "Generada":    { color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  "Devuelto":    { color: "#EF4444", bg: "rgba(239,68,68,0.1)"  },
  "Por Validar": { color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  "Validado":    { color: "#10B981", bg: "rgba(16,185,129,0.1)" },
};
const getMeta = (estado) => ESTADO_META[estado] || { color: "#6B7280", bg: "rgba(107,114,128,0.1)" };

/* ══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
══════════════════════════════════════════════════════════ */
export default function ResultadosEspecialista() {
  const params = new URLSearchParams(window.location.search);
  const ordenInicial = params.get("orden") ? parseInt(params.get("orden")) : null;

  const [ordenes, setOrdenes]             = useState([]);
  const [ordenSeleccionada, setOrdenSel]  = useState(null);
  const [detalleOrden, setDetalleOrden]   = useState(null);
  const [loadingOrdenes, setLoadOrdenes]  = useState(true);
  const [loadingDetalle, setLoadDetalle]  = useState(false);
  const [guardando, setGuardando]         = useState(false);
  const [enviando, setEnviando]           = useState(false);
  const [msg, setMsg]                     = useState(null);
  const [busqueda, setBusqueda]           = useState("");
  const [filtroEstado, setFiltroEstado]   = useState("TODOS");
  const [tab, setTab]                     = useState("pendientes");

  const cargarOrdenes = useCallback(async () => {
    setLoadOrdenes(true);
    try {
      const { data } = await API.get("/resultados/mis-ordenes");
      const lista = Array.isArray(data) ? data : [];
      setOrdenes(lista);
      if (ordenInicial) {
        const found = lista.find(o => o.id_orden === ordenInicial);
        if (found) cargarDetalle(found);
      }
    } catch { setOrdenes([]); }
    finally { setLoadOrdenes(false); }
  }, []);

  const cargarDetalle = async (orden) => {
    setOrdenSel(orden);
    setDetalleOrden(null);
    setMsg(null);
    setLoadDetalle(true);
    try {
      const { data } = await API.get(`/resultados/detalle-orden/${orden.id_orden}`);
      setDetalleOrden(data);
    } catch {
      setMsg({ tipo: "error", texto: "No se pudo cargar el detalle de la orden." });
    } finally { setLoadDetalle(false); }
  };

  useEffect(() => { cargarOrdenes(); }, [cargarOrdenes]);

  const handleGuardarValor = async (id_resultado, id_parametro, valor, observacion) => {
    if (!valor && valor !== 0) return;
    setGuardando(true);
    try {
      await API.post("/resultados/guardar-valor", {
        id_resultado, id_parametro,
        valor_obtenido: String(valor),
        observacion: observacion || "",
      });
      const { data } = await API.get(`/resultados/detalle-orden/${ordenSeleccionada.id_orden}`);
      setDetalleOrden(data);
      setMsg({ tipo: "success", texto: "✓ Valor guardado correctamente." });
      setTimeout(() => setMsg(null), 3000);
    } catch (e) {
      setMsg({ tipo: "error", texto: e.response?.data?.error || "Error al guardar el valor." });
    } finally { setGuardando(false); }
  };

  // Guardar PDF de un examen tipo PDF
  const handleGuardarPDF = async (id_resultado, archivo) => {
    const formData = new FormData();
    formData.append("pdf", archivo);
    formData.append("id_resultado", id_resultado);
    try {
      const { data } = await API.post("/resultados/subir-pdf", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { data: det } = await API.get(`/resultados/detalle-orden/${ordenSeleccionada.id_orden}`);
      setDetalleOrden(det);
      setMsg({ tipo: "success", texto: "✓ PDF subido correctamente." });
      setTimeout(() => setMsg(null), 3000);
      return data.pdf_url;
    } catch (e) {
      setMsg({ tipo: "error", texto: e.response?.data?.error || "Error al subir el PDF." });
      return null;
    }
  };

  const handleEnviarRevision = async (id_resultado) => {
    setEnviando(true);
    try {
      await API.put(`/resultados/enviar-revision/${id_resultado}`);
      setMsg({ tipo: "success", texto: "✅ Examen enviado a revisión correctamente." });
      await cargarOrdenes();
      if (ordenSeleccionada) {
        const { data } = await API.get(`/resultados/detalle-orden/${ordenSeleccionada.id_orden}`);
        setDetalleOrden(data);
        setOrdenSel(prev => ({ ...prev, estado_orden: data.estado }));
      }
    } catch (e) {
      setMsg({ tipo: "error", texto: e.response?.data?.error || "Error al enviar a revisión." });
    } finally { setEnviando(false); }
  };

  const ESTADOS_PENDIENTE = ["En Proceso", "Devuelto", null, undefined];
  const ESTADOS_ENVIADO   = ["Por Validar", "Validado"];
  const q = busqueda.toLowerCase();
  const matchBusq = (o) => !q || `${o.numero_ticket || ""} ${o.paciente_nombre || ""}`.toLowerCase().includes(q);
  const FILTROS_PENDIENTE = ["TODOS", "En Proceso", "Devuelto"];
  const ordenesPendientes = ordenes.filter(o =>
    ESTADOS_PENDIENTE.includes(o.estado_resultado) && matchBusq(o) &&
    (
      filtroEstado === "TODOS" ||
      o.estado_orden === filtroEstado ||
      // Si el filtro es "Devuelto", incluir órdenes cuyo estado_resultado sea "Devuelto"
      // aunque el estado_orden todavía diga "En Proceso"
      (filtroEstado === "Devuelto" && o.estado_resultado === "Devuelto")
    )
  );
  const ordenesEnviadas = ordenes.filter(o =>
    ESTADOS_ENVIADO.includes(o.estado_resultado) && matchBusq(o)
  );
  const ordenesFiltradas = tab === "pendientes" ? ordenesPendientes : ordenesEnviadas;

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={S.page}>
        <div style={S.header}>
          <div>
            <h2 style={S.title}>INGRESO DE <span style={S.accent}>RESULTADOS</span></h2>
            <p style={S.sub}>Selecciona una orden para ingresar los valores de tus exámenes asignados</p>
          </div>
        </div>

        {msg && (
          <div style={{ ...S.toast, background: msg.tipo === "success" ? "#F0FDF4" : "#FEF2F2", borderColor: msg.tipo === "success" ? "#10B981" : "#EF4444", color: msg.tipo === "success" ? "#065F46" : "#991B1B" }}>
            {msg.texto}
          </div>
        )}

        <div style={S.layout}>
          {/* ── PANEL IZQUIERDO ── */}
          <div style={S.panelLeft}>
            <div style={{ display: "flex", borderBottom: "1px solid #F1F5F9" }}>
              {[
                { key: "pendientes", label: "PENDIENTES", count: ordenesPendientes.length, color: "#8B5CF6" },
                { key: "enviados",   label: "ENVIADOS",   count: ordenesEnviadas.length,   color: "#10B981" },
              ].map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setOrdenSel(null); setDetalleOrden(null); }}
                  style={{ flex: 1, padding: "0.7rem 0.5rem", border: "none", background: "transparent", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.7rem", letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase", color: tab === t.key ? t.color : "#9CA3AF", borderBottom: tab === t.key ? `2.5px solid ${t.color}` : "2.5px solid transparent", transition: "all 0.15s" }}>
                  {t.label}
                  <span style={{ marginLeft: "0.35rem", fontSize: "0.62rem", fontWeight: 800, background: tab === t.key ? (t.key === "pendientes" ? "rgba(139,92,246,0.12)" : "rgba(16,185,129,0.12)") : "#F3F4F6", color: tab === t.key ? t.color : "#9CA3AF", padding: "0.08rem 0.35rem", borderRadius: "20px" }}>{t.count}</span>
                </button>
              ))}
            </div>

            <div style={{ padding: "0.65rem 0.75rem 0" }}>
              <input type="text" placeholder="🔍 Ticket o paciente…" value={busqueda}
                onChange={e => setBusqueda(e.target.value)} style={S.searchInput} />
            </div>

            {tab === "pendientes" && (
              <div style={{ padding: "0.5rem 0.75rem 0.6rem", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {FILTROS_PENDIENTE.map(f => {
                  const active = filtroEstado === f;
                  const meta = getMeta(f === "TODOS" ? null : f);
                  return (
                    <button key={f} onClick={() => setFiltroEstado(f)} style={{ padding: "0.18rem 0.55rem", borderRadius: "20px", fontSize: "0.65rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, border: `1px solid ${active ? meta.color : "#E5E7EB"}`, background: active ? meta.bg : "transparent", color: active ? meta.color : "#9CA3AF", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {f === "TODOS" ? "TODOS" : f.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={S.listaOrdenes}>
              {loadingOrdenes ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}><div style={S.spinner} /></div>
              ) : ordenesFiltradas.length === 0 ? (
                <div style={S.emptyLeft}>{tab === "pendientes" ? "Sin órdenes pendientes" : "Aún no has enviado resultados"}</div>
              ) : (
                ordenesFiltradas.map(o => {
                  const enviado     = ESTADOS_ENVIADO.includes(o.estado_resultado);
                  const metaPill    = enviado
                    ? getMeta(o.estado_resultado)
                    : o.estado_resultado === "Devuelto"
                      ? getMeta("Devuelto")
                      : getMeta(o.estado_orden);
                  const activa      = ordenSeleccionada?.id_orden === o.id_orden;
                  const misExamCount = (o.mis_examenes || []).length;
                  const completados  = (o.mis_examenes || []).filter(ex => ex.completado).length;
                  return (
                    <div key={o.id_orden} onClick={() => cargarDetalle(o)}
                      style={{ ...S.ordenItem, background: activa ? (enviado ? "rgba(16,185,129,0.05)" : "rgba(139,92,246,0.06)") : "#FFF", borderLeft: activa ? `3px solid ${enviado ? "#10B981" : "#8B5CF6"}` : "3px solid transparent", cursor: "pointer" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem" }}>
                        <span style={S.ticketMono}>#{o.numero_ticket || o.id_orden}</span>
                        <span style={{ ...S.estadoPill, background: metaPill.bg, color: metaPill.color }}>
                          {(enviado
                            ? o.estado_resultado
                            : o.estado_resultado === "Devuelto"
                              ? "Devuelto"
                              : o.estado_orden
                          )?.toUpperCase()}
                        </span>
                      </div>
                      <p style={S.pacienteNombre}>{o.paciente_nombre || "Paciente"}</p>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.4rem" }}>
                        <span style={S.fechaSmall}>{fmt(o.fecha_orden)}</span>
                        {enviado ? (
                          <span style={{ fontSize: "0.68rem", color: "#059669", fontWeight: 600 }}>✅ {misExamCount} exám{misExamCount !== 1 ? "s" : ""}. enviados</span>
                        ) : misExamCount > 0 ? (
                          <span style={{ fontSize: "0.68rem", color: completados === misExamCount ? "#059669" : "#6B7280" }}>
                            {completados === misExamCount ? "✅" : "🔬"} {completados}/{misExamCount} exáms.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── PANEL DERECHO ── */}
          <div style={S.panelRight}>
            {!ordenSeleccionada ? (
              <div style={S.emptyRight}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔬</div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#1F2937", margin: "0 0 0.5rem" }}>Selecciona una orden</h3>
                <p style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Elige una orden de la lista para ingresar los resultados</p>
              </div>
            ) : loadingDetalle ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", gap: "1rem" }}>
                <div style={{ ...S.spinner, borderTopColor: "#8B5CF6" }} />
                <p style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>Cargando detalle…</p>
              </div>
            ) : detalleOrden ? (
              <DetalleOrden
                detalle={detalleOrden}
                orden={ordenSeleccionada}
                onGuardar={handleGuardarValor}
                onGuardarPDF={handleGuardarPDF}
                onEnviar={handleEnviarRevision}
                guardando={guardando}
                enviando={enviando}
                soloLectura={tab === "enviados"}
              />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   DETALLE DE ORDEN
══════════════════════════════════════════════════════════ */
function DetalleOrden({ detalle, orden, onGuardar, onGuardarPDF, onEnviar, guardando, enviando, soloLectura }) {
  const estadoActual = detalle.estado || orden.estado_orden;
  const meta = getMeta(estadoActual);
  // Es editable si la orden permite cambios, O si tiene parámetros devueltos específicos
  const editable = !soloLectura && ["En Proceso", "Generada", "Devuelto"].includes(estadoActual);
  // Permite edición parcial si el resultado está "Devuelto" aunque el estado general no lo sea
  const tieneDevueltos = (detalle.examenes || []).some(ex =>
    (ex.parametros || []).some(p => p.estado === "Devuelto")
  );

  const misExamenes   = (detalle.examenes || []).filter(ex => ex.es_mio);
  const otrosExamenes = (detalle.examenes || []).filter(ex => !ex.es_mio);

  // Para exámenes PDF: completado si tiene archivo_pdf en el resultado
  const totalMios = misExamenes.length;
  const completadosMios = misExamenes.filter(ex => {
    if (ex.tipo_resultado === "PDF") return !!ex.archivo_pdf;
    return ex.todos_parametros_llenos;
  }).length;
  const todosCompletos = totalMios > 0 && completadosMios === totalMios;

  return (
    <div style={S.detalleWrap}>
      {/* Info paciente */}
      <div style={S.infoOrden}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem" }}>
              <span style={S.ticketGrande}>#{detalle.numero_ticket || detalle.id_orden}</span>
              <span style={{ ...S.estadoPillGrande, background: meta.bg, color: meta.color }}>{estadoActual?.toUpperCase()}</span>
            </div>
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.2rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.2rem" }}>{detalle.paciente_nombre || "—"}</h3>
            <p style={{ fontSize: "0.78rem", color: "#9CA3AF", margin: 0 }}>Cédula: {detalle.paciente_cedula || "—"} · Fecha: {fmt(detalle.fecha_orden)}</p>
          </div>
          <div style={{ textAlign: "right", minWidth: "120px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.25rem" }}>Mi progreso</p>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem", fontWeight: 800, color: todosCompletos ? "#059669" : "#8B5CF6", margin: "0 0 0.3rem" }}>{completadosMios}/{totalMios}</p>
            <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "3px", overflow: "hidden", width: "120px" }}>
              <div style={{ height: "100%", borderRadius: "3px", background: todosCompletos ? "#10B981" : "#8B5CF6", width: `${totalMios > 0 ? (completadosMios / totalMios) * 100 : 0}%`, transition: "width 0.5s ease" }} />
            </div>
          </div>
        </div>
        {(estadoActual === "Devuelto" || tieneDevueltos) && detalle.motivo_devolucion && (
          <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.25rem" }}>⚠️ Observación del revisor</p>
            <p style={{ fontSize: "0.85rem", color: "#7F1D1D", margin: 0 }}>{detalle.motivo_devolucion}</p>
          </div>
        )}
        {tieneDevueltos && !detalle.motivo_devolucion && (
          <div style={{ marginTop: "0.75rem", padding: "0.75rem 1rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "8px" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.25rem" }}>⚠️ Parámetros devueltos para corrección</p>
            <p style={{ fontSize: "0.85rem", color: "#7F1D1D", margin: 0 }}>El revisor ha devuelto uno o más parámetros. Revisa los campos marcados en rojo y corrígelos.</p>
          </div>
        )}
      </div>

      {soloLectura && (
        <div style={{ margin: "1rem 1.5rem 0", padding: "0.85rem 1.1rem", borderRadius: "10px", background: estadoActual === "Validado" ? "rgba(16,185,129,0.07)" : "rgba(139,92,246,0.07)", border: `1px solid ${estadoActual === "Validado" ? "rgba(16,185,129,0.25)" : "rgba(139,92,246,0.2)"}`, display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{ fontSize: "1.4rem" }}>{estadoActual === "Validado" ? "✅" : "📋"}</span>
          <div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.82rem", color: estadoActual === "Validado" ? "#059669" : "#7C3AED", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {estadoActual === "Validado" ? "Resultado validado" : "Resultado enviado a revisión"}
            </p>
            <p style={{ fontSize: "0.76rem", color: "#6B7280", margin: "0.15rem 0 0" }}>
              {estadoActual === "Validado" ? "El administrador validó y publicó este resultado. Solo lectura." : "Ya enviaste tus resultados. El administrador los está revisando."}
            </p>
          </div>
        </div>
      )}

      {/* Mis exámenes */}
      {misExamenes.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "#9CA3AF", fontSize: "0.85rem" }}>No tienes exámenes asignados en esta orden</div>
      ) : (
        <>
          <div style={S.secHdr}>
            <span style={S.secHdrIcon}>🔬</span>
            <h4 style={S.secHdrTitle}>MIS EXÁMENES ASIGNADOS</h4>
            <span style={{ fontSize: "0.72rem", color: soloLectura ? "#10B981" : "#8B5CF6", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
              {soloLectura ? "Solo lectura" : `${completadosMios}/${totalMios} completados`}
            </span>
          </div>

          {misExamenes.map(examen =>
            examen.tipo_resultado === "PDF" ? (
              <ExamenPDF
                key={examen.id_examen}
                examen={examen}
                editable={editable}
                onGuardarPDF={onGuardarPDF}
              />
            ) : (
              <ExamenEditable
                key={examen.id_examen}
                examen={examen}
                editable={editable}
                onGuardar={onGuardar}
                guardando={guardando}
              />
            )
          )}

          {editable && (
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid #F1F5F9" }}>
              <button
                onClick={() => { const id = misExamenes[0]?.id_resultado; if (id) onEnviar(id); }}
                disabled={!todosCompletos || enviando}
                style={{ ...S.btnEnviar, opacity: (!todosCompletos || enviando) ? 0.5 : 1, cursor: (!todosCompletos || enviando) ? "not-allowed" : "pointer" }}
              >
                {enviando ? "Enviando…" : todosCompletos ? "✅ ENVIAR A REVISIÓN DEL ADMINISTRADOR" : `⚠️ Completa todos tus exámenes para enviar (${completadosMios}/${totalMios})`}
              </button>
              {!todosCompletos && (
                <p style={{ fontSize: "0.73rem", color: "#9CA3AF", margin: "0.5rem 0 0", textAlign: "center" }}>
                  El sistema enviará la orden a "Por Validar" cuando todos los especialistas completen sus exámenes
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Otros exámenes */}
      {otrosExamenes.length > 0 && (
        <>
          <div style={{ ...S.secHdr, marginTop: "0.5rem" }}>
            <span style={S.secHdrIcon}>👥</span>
            <h4 style={S.secHdrTitle}>OTROS EXÁMENES DE LA ORDEN</h4>
            <span style={{ fontSize: "0.72rem", color: "#6B7280", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>Solo lectura — Otros especialistas</span>
          </div>
          {otrosExamenes.map(examen => (
            <ExamenSoloLectura key={examen.id_examen} examen={examen} />
          ))}
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   EXAMEN EDITABLE (tipo PARAMETROS)
══════════════════════════════════════════════════════════ */
function ExamenEditable({ examen, editable, onGuardar, guardando }) {
  const [abierto, setAbierto] = useState(true);
  const [valores, setValores] = useState(() => {
    const init = {};
    (examen.parametros || []).forEach(p => {
      init[p.id_parametro] = { valor: p.valor_obtenido || "", obs: p.observacion || "" };
    });
    return init;
  });
  const [guardandoTodo, setGuardandoTodo] = useState(false);

  const handleGuardarTodo = async () => {
    const lista = (examen.parametros || []).filter(p => {
      const v = valores[p.id_parametro];
      return v?.valor || v?.valor === 0;
    });
    if (lista.length === 0) return;
    setGuardandoTodo(true);
    for (const p of lista) {
      const v = valores[p.id_parametro];
      await onGuardar(examen.id_resultado, p.id_parametro, v.valor, v.obs);
    }
    setGuardandoTodo(false);
  };

  // Un examen está completo si todos sus parámetros tienen valor
  // (incluyendo los devueltos que deben ser re-llenados)
  const completado = (examen.parametros || []).length > 0 &&
    (examen.parametros || []).every(p => {
      const v = valores[p.id_parametro];
      return !!(v?.valor || p.valor_obtenido);
    });
  const hayPendientes = (examen.parametros || []).some(p => {
    const v = valores[p.id_parametro];
    return v?.valor && v.valor !== (p.valor_obtenido || "");
  });
  // Parámetros con devolución pendiente de corrección
  const hayDevueltos = (examen.parametros || []).some(p => p.estado === "Devuelto");

  return (
    <div style={{ ...S.examenCard, borderColor: completado ? "rgba(16,185,129,0.3)" : "rgba(139,92,246,0.15)" }}>
      <div style={S.examenHdr} onClick={() => setAbierto(a => !a)}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
          <div style={{ ...S.examenIcono, background: completado ? "rgba(16,185,129,0.12)" : "rgba(139,92,246,0.12)", color: completado ? "#059669" : "#7C3AED" }}>
            {completado ? "✓" : "🔬"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.92rem", color: "#1F2937", margin: 0, textTransform: "uppercase" }}>{examen.nombre_examen}</p>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.62rem", fontWeight: 700, background: "#EFF6FF", color: "#1e3a5f", padding: "0.1rem 0.4rem", borderRadius: "20px" }}>PARÁMETROS</span>
            </div>
            <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: 0 }}>{(examen.parametros || []).filter(p => p.valor_obtenido).length}/{(examen.parametros || []).length} parámetros · {examen.categoria || ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {completado && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#059669", background: "rgba(16,185,129,0.1)", padding: "0.15rem 0.45rem", borderRadius: "20px" }}>COMPLETO</span>}
          {!editable && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", background: "#F1F5F9", padding: "0.15rem 0.45rem", borderRadius: "20px" }}>🔒 BLOQUEADO</span>}
          <span style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>{abierto ? "▲" : "▼"}</span>
        </div>
      </div>

      {abierto && (
        <div style={S.parametrosWrap}>
          {(examen.parametros || []).length === 0 ? (
            <p style={{ fontSize: "0.82rem", color: "#9CA3AF", padding: "1rem" }}>Sin parámetros configurados</p>
          ) : (
            <>
              {/* Aviso si hay parámetros devueltos en esta orden */}
              {editable && (examen.parametros || []).some(p => p.estado === "Devuelto") && (
                <div style={{ marginBottom: "0.75rem", padding: "0.65rem 0.85rem", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.2rem" }}>
                    ⚠️ Parámetros devueltos para corrección
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#7F1D1D", margin: 0 }}>
                    Los campos marcados en rojo han sido devueltos por el administrador. Corrígelos y vuelve a enviar.
                  </p>
                </div>
              )}
              <div style={S.parametrosGrid}>
                {(examen.parametros || []).map(p => {
                  const v          = valores[p.id_parametro] || { valor: "", obs: "" };
                  const valorNum   = parseFloat(v.valor);
                  const fuera      = v.valor && !isNaN(valorNum) && (valorNum > p.rango_max || valorNum < p.rango_min);
                  const lleno      = !!p.valor_obtenido || !!v.valor;
                  // Parámetro devuelto por admin: se puede editar aunque el resto esté bloqueado
                  const devuelto   = p.estado === "Devuelto";
                  const campoEditable = editable || devuelto;
                  return (
                    <div key={p.id_parametro} style={{
                      ...S.parametroCard,
                      borderColor: devuelto ? "#EF4444" : fuera ? "rgba(239,68,68,0.3)" : lleno ? "rgba(16,185,129,0.2)" : "#F1F5F9",
                      background:  devuelto ? "#FEF2F2" : "#FFF",
                      boxShadow:   devuelto ? "0 0 0 2px rgba(239,68,68,0.15)" : "none",
                    }}>
                      <div style={{ marginBottom: "0.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.82rem", color: devuelto ? "#DC2626" : "#1F2937", margin: 0, textTransform: "uppercase" }}>
                            {p.nombre_parametro}
                          </p>
                          {devuelto && (
                            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.6rem", fontWeight: 700, background: "#FEE2E2", color: "#991B1B", padding: "0.1rem 0.4rem", borderRadius: "20px", textTransform: "uppercase" }}>
                              ↩ Devuelto
                            </span>
                          )}
                        </div>
                        {/* Motivo de devolución visible para el especialista */}
                        {devuelto && p.motivo_devolucion && (
                          <p style={{ fontSize: "0.7rem", color: "#DC2626", margin: "0.2rem 0 0", fontStyle: "italic", background: "rgba(239,68,68,0.05)", padding: "0.2rem 0.4rem", borderRadius: "4px" }}>
                            📝 {p.motivo_devolucion}
                          </p>
                        )}
                        <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: "0.1rem 0 0" }}>
                          Rango: {p.rango_min ?? "—"} – {p.rango_max ?? "—"} {p.unidad || ""}
                          {p.descripcion_rango && p.descripcion_rango !== "General · 0-120 años" && (
                            <span style={{ marginLeft: "0.4rem", color: "#8B5CF6", fontWeight: 600 }}>({p.descripcion_rango})</span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <input type="number" step="any" placeholder="Valor…" value={v.valor} disabled={!campoEditable}
                          onChange={e => setValores(prev => ({ ...prev, [p.id_parametro]: { ...prev[p.id_parametro], valor: e.target.value } }))}
                          style={{
                            ...S.valorInput,
                            borderColor: devuelto ? "#EF4444" : fuera ? "#EF4444" : lleno ? "#10B981" : "#E5E7EB",
                            background:  !campoEditable ? "#F8FAFC" : devuelto ? "#FFF5F5" : "#FFF",
                            cursor:      !campoEditable ? "not-allowed" : "text",
                          }} />
                        <span style={{ fontSize: "0.75rem", color: "#9CA3AF", whiteSpace: "nowrap" }}>{p.unidad || ""}</span>
                      </div>
                      {fuera && <p style={{ fontSize: "0.68rem", color: "#DC2626", margin: "0.35rem 0 0", fontWeight: 600 }}>⚠️ Fuera de rango referencial</p>}
                      {campoEditable && (
                        <textarea placeholder="Observación (opcional)…" value={v.obs} rows={2}
                          onChange={e => setValores(prev => ({ ...prev, [p.id_parametro]: { ...prev[p.id_parametro], obs: e.target.value } }))}
                          style={{ ...S.obsInput, borderColor: devuelto ? "rgba(239,68,68,0.3)" : "#E5E7EB" }} />
                      )}
                      {!campoEditable && p.observacion && (
                        <p style={{ fontSize: "0.75rem", color: "#6B7280", margin: "0.35rem 0 0", fontStyle: "italic" }}>Obs: {p.observacion}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {editable && (
                <div style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={handleGuardarTodo} disabled={guardandoTodo || guardando}
                    style={{ padding: "0.6rem 1.4rem", background: guardandoTodo ? "#E5E7EB" : hayDevueltos ? "#EF4444" : hayPendientes ? "#7C3AED" : "#10B981", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.06em", textTransform: "uppercase", cursor: guardandoTodo ? "not-allowed" : "pointer", opacity: guardandoTodo ? 0.7 : 1, transition: "all 0.2s" }}>
                    {guardandoTodo ? "💾 Guardando…" : hayDevueltos ? "💾 Guardar Correcciones" : "💾 Guardar Valores"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   EXAMEN PDF — Sub-componente (tipo PDF)
══════════════════════════════════════════════════════════ */
function ExamenPDF({ examen, editable, onGuardarPDF }) {
  const [abierto, setAbierto]   = useState(true);
  const [archivo, setArchivo]   = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [urlGuardada, setUrl]   = useState(examen.archivo_pdf || null);

  const handleSubir = async () => {
    if (!archivo) return;
    setSubiendo(true);
    const url = await onGuardarPDF(examen.id_resultado, archivo);
    if (url) setUrl(url);
    setSubiendo(false);
  };

  const completado = !!urlGuardada;

  return (
    <div style={{ ...S.examenCard, borderColor: completado ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)" }}>
      {/* Header */}
      <div style={S.examenHdr} onClick={() => setAbierto(a => !a)}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
          <div style={{ ...S.examenIcono, background: completado ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)", color: completado ? "#059669" : "#D97706" }}>
            {completado ? "✓" : "📄"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.92rem", color: "#1F2937", margin: 0, textTransform: "uppercase" }}>{examen.nombre_examen}</p>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.62rem", fontWeight: 700, background: "#FEF3C7", color: "#92400E", padding: "0.1rem 0.4rem", borderRadius: "20px" }}>PDF</span>
            </div>
            <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: 0 }}>{examen.categoria || ""} · Examen con resultado en PDF</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {completado && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#059669", background: "rgba(16,185,129,0.1)", padding: "0.15rem 0.45rem", borderRadius: "20px" }}>PDF SUBIDO</span>}
          {!editable && !completado && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", background: "#F1F5F9", padding: "0.15rem 0.45rem", borderRadius: "20px" }}>🔒 BLOQUEADO</span>}
          <span style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>{abierto ? "▲" : "▼"}</span>
        </div>
      </div>

      {abierto && (
        <div style={S.parametrosWrap}>
          {/* PDF ya subido */}
          {urlGuardada ? (
            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "1rem 1.2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "1.8rem" }}>📄</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#059669", margin: 0, textTransform: "uppercase" }}>PDF subido correctamente</p>
                <a href={urlGuardada} target="_blank" rel="noreferrer"
                  style={{ fontSize: "0.75rem", color: "#2563EB", textDecoration: "underline" }}>
                  Ver PDF subido →
                </a>
              </div>
              {editable && (
                <button onClick={() => { setUrl(null); setArchivo(null); }}
                  style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", color: "#DC2626", borderRadius: "6px", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.75rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                  Cambiar PDF
                </button>
              )}
            </div>
          ) : editable ? (
            /* Uploader */
            <div style={{ border: "2px dashed #FCD34D", borderRadius: "10px", padding: "1.5rem", textAlign: "center", background: "#FFFBEB" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📤</div>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#92400E", margin: "0 0 0.25rem", textTransform: "uppercase" }}>
                Subir resultado en PDF
              </p>
              <p style={{ fontSize: "0.75rem", color: "#B45309", margin: "0 0 1rem" }}>
                Este examen requiere subir el resultado como archivo PDF
              </p>
              <input
                type="file"
                accept=".pdf"
                id={`pdf-input-${examen.id_examen}`}
                style={{ display: "none" }}
                onChange={e => setArchivo(e.target.files[0] || null)}
              />
              <label htmlFor={`pdf-input-${examen.id_examen}`}
                style={{ display: "inline-block", padding: "0.55rem 1.2rem", background: "#FFF", border: "1.5px solid #FCD34D", borderRadius: "8px", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.82rem", color: "#92400E", marginBottom: "0.75rem" }}>
                📁 Seleccionar PDF
              </label>
              {archivo && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <p style={{ fontSize: "0.8rem", color: "#374151", margin: 0, fontWeight: 600 }}>
                    ✅ {archivo.name}
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "#9CA3AF", margin: "0.1rem 0 0" }}>
                    {(archivo.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              )}
              {archivo && (
                <button onClick={handleSubir} disabled={subiendo}
                  style={{ padding: "0.6rem 1.4rem", background: subiendo ? "#E5E7EB" : "#D97706", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", textTransform: "uppercase", cursor: subiendo ? "not-allowed" : "pointer", opacity: subiendo ? 0.7 : 1 }}>
                  {subiendo ? "⏳ Subiendo…" : "📤 Subir PDF"}
                </button>
              )}
            </div>
          ) : (
            /* Sin PDF y bloqueado */
            <div style={{ padding: "1.5rem", textAlign: "center", color: "#9CA3AF", fontSize: "0.85rem" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>📄</div>
              PDF no subido aún
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   EXAMEN SOLO LECTURA
══════════════════════════════════════════════════════════ */
function ExamenSoloLectura({ examen }) {
  const [abierto, setAbierto] = useState(false);
  const esPDF     = examen.tipo_resultado === "PDF";
  const completado = esPDF ? !!examen.archivo_pdf : examen.todos_parametros_llenos;

  return (
    <div style={{ ...S.examenCard, borderColor: "#F1F5F9", opacity: 0.85 }}>
      <div style={{ ...S.examenHdr, cursor: "pointer" }} onClick={() => setAbierto(a => !a)}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
          <div style={{ ...S.examenIcono, background: completado ? "rgba(16,185,129,0.08)" : "rgba(107,114,128,0.08)", color: completado ? "#059669" : "#9CA3AF" }}>
            {completado ? "✓" : esPDF ? "📄" : "○"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: "#374151", margin: 0 }}>{examen.nombre_examen}</p>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.6rem", fontWeight: 700, background: esPDF ? "#FEF3C7" : "#EFF6FF", color: esPDF ? "#92400E" : "#1e3a5f", padding: "0.1rem 0.35rem", borderRadius: "20px" }}>
                {esPDF ? "PDF" : "PARÁMETROS"}
              </span>
            </div>
            <p style={{ fontSize: "0.7rem", color: "#9CA3AF", margin: 0 }}>{examen.especialista_nombre || "Otro especialista"} · {completado ? "Completado" : "Pendiente"}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", background: "#F1F5F9", padding: "0.12rem 0.4rem", borderRadius: "4px" }}>🔒 SOLO LECTURA</span>
          <span style={{ color: "#D1D5DB", fontSize: "0.85rem" }}>{abierto ? "▲" : "▼"}</span>
        </div>
      </div>

      {abierto && (
        <div style={{ ...S.parametrosWrap, background: "#FAFAFA" }}>
          {esPDF ? (
            examen.archivo_pdf ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0" }}>
                <span style={{ fontSize: "1.2rem" }}>📄</span>
                <a href={examen.archivo_pdf} target="_blank" rel="noreferrer" style={{ fontSize: "0.82rem", color: "#2563EB", textDecoration: "underline" }}>Ver PDF del resultado →</a>
              </div>
            ) : (
              <p style={{ fontSize: "0.82rem", color: "#9CA3AF" }}>PDF no subido aún</p>
            )
          ) : (
            <div style={S.parametrosGrid}>
              {(examen.parametros || []).map(p => (
                <div key={p.id_parametro} style={{ ...S.parametroCard, borderColor: "#F1F5F9", background: "#FAFAFA" }}>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.78rem", fontWeight: 700, color: "#6B7280", margin: "0 0 0.25rem", textTransform: "uppercase" }}>{p.nombre_parametro}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1rem", fontWeight: 700, color: p.valor_obtenido ? "#1F2937" : "#D1D5DB" }}>{p.valor_obtenido || "Sin resultado aún"}</span>
                    <span style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>{p.unidad || ""}</span>
                  </div>
                  <p style={{ fontSize: "0.68rem", color: "#B0B7C3", margin: "0.2rem 0 0" }}>
                    Rango: {p.rango_min ?? "—"} – {p.rango_max ?? "—"}
                    {p.descripcion_rango && p.descripcion_rango !== "General · 0-120 años" && (
                      <span style={{ marginLeft: "0.3rem", color: "#8B5CF6" }}>({p.descripcion_rango})</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ESTILOS
══════════════════════════════════════════════════════════ */
const S = {
  page:        { padding: "1.25rem", fontFamily: "'Barlow', sans-serif" },
  header:      { marginBottom: "1.25rem" },
  title:       { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.75rem", fontWeight: 800, color: "#1F2937", margin: 0, textTransform: "uppercase" },
  accent:      { color: "#8B5CF6" },
  sub:         { fontSize: "0.83rem", color: "#6B7280", margin: "0.2rem 0 0" },
  toast:       { padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid", fontSize: "0.85rem", marginBottom: "1rem", animation: "fadeIn 0.2s ease" },
  layout:      { display: "grid", gridTemplateColumns: "300px 1fr", gap: "1rem", alignItems: "start" },
  panelLeft:   { background: "#FFF", borderRadius: "12px", border: "1px solid #F1F5F9", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.03)", position: "sticky", top: "1rem" },
  searchInput: { width: "100%", padding: "0.45rem 0.7rem", border: "1px solid #E5E7EB", borderRadius: "7px", fontSize: "0.8rem", fontFamily: "'Barlow', sans-serif", outline: "none", background: "#F9FAFB", boxSizing: "border-box" },
  listaOrdenes:{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" },
  ordenItem:   { padding: "0.85rem 0.75rem", borderBottom: "1px solid #F8FAFC", transition: "all 0.15s" },
  ticketMono:  { fontFamily: "'Courier New', monospace", fontSize: "0.75rem", color: "#374151", background: "#F3F4F6", padding: "0.1rem 0.35rem", borderRadius: "4px" },
  estadoPill:  { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.6rem", fontWeight: 700, padding: "0.12rem 0.4rem", borderRadius: "20px", textTransform: "uppercase" },
  pacienteNombre: { fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: "0.85rem", color: "#1F2937", margin: "0.2rem 0 0" },
  fechaSmall:  { fontSize: "0.68rem", color: "#9CA3AF" },
  emptyLeft:   { padding: "2.5rem 1rem", textAlign: "center", color: "#9CA3AF", fontSize: "0.82rem" },
  panelRight:  { background: "#FFF", borderRadius: "12px", border: "1px solid #F1F5F9", overflow: "hidden", boxShadow: "0 2px 6px rgba(0,0,0,0.03)", minHeight: "400px" },
  emptyRight:  { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "400px", padding: "3rem", textAlign: "center" },
  spinner:     { width: "28px", height: "28px", border: "3px solid #F1F5F9", borderTop: "3px solid #8B5CF6", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  infoOrden:   { padding: "1.25rem 1.5rem", borderBottom: "1px solid #F1F5F9" },
  ticketGrande:{ fontFamily: "'Courier New', monospace", fontSize: "0.9rem", color: "#374151", background: "#F3F4F6", padding: "0.2rem 0.5rem", borderRadius: "5px" },
  estadoPillGrande: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, padding: "0.22rem 0.6rem", borderRadius: "20px", textTransform: "uppercase" },
  secHdr:      { display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.75rem 1.5rem", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" },
  secHdrIcon:  { fontSize: "1rem" },
  secHdrTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#1F2937", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, flex: 1 },
  examenCard:  { margin: "0.75rem 1.5rem", border: "1.5px solid", borderRadius: "10px", overflow: "hidden" },
  examenHdr:   { display: "flex", alignItems: "center", padding: "0.85rem 1rem", cursor: "pointer", background: "#FDFDFD", userSelect: "none" },
  examenIcono: { width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0, fontWeight: 700 },
  parametrosWrap: { padding: "0.85rem 1rem" },
  parametrosGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.65rem" },
  parametroCard:  { background: "#FFF", border: "1.5px solid", borderRadius: "8px", padding: "0.75rem" },
  valorInput:     { flex: 1, padding: "0.4rem 0.6rem", border: "1.5px solid", borderRadius: "6px", fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "#1F2937", outline: "none", width: "100%", boxSizing: "border-box" },
  obsInput:       { width: "100%", marginTop: "0.5rem", padding: "0.4rem 0.6rem", border: "1px solid #E5E7EB", borderRadius: "6px", fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#374151", resize: "vertical", outline: "none", boxSizing: "border-box" },
  btnEnviar:   { width: "100%", padding: "0.85rem", background: "linear-gradient(135deg, #7C3AED, #8B5CF6)", color: "#FFF", border: "none", borderRadius: "9px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.88rem", letterSpacing: "0.06em", textTransform: "uppercase", transition: "all 0.2s" },
  detalleWrap: { display: "flex", flexDirection: "column", paddingBottom: "1.5rem" },
};