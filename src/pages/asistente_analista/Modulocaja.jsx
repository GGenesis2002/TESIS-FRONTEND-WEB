import { useState, useEffect } from "react";
import API from "../../services/api";

// ─── MÉTODOS DE PAGO ──────────────────────────────────────────────────────────
const METODOS = ["Efectivo", "Transferencia"];

const estadoColor = {
  "Generada":    { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6" },
  "Pagada":      { bg: "rgba(16,185,129,0.12)",  color: "#10B981" },
  "En Proceso":  { bg: "rgba(139,92,246,0.12)",  color: "#8B5CF6" },
  "Por Validar": { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B" },
  "Validada":    { bg: "rgba(16,185,129,0.12)",  color: "#059669" },
  "Entregada":   { bg: "rgba(107,114,128,0.12)", color: "#6B7280" },
  "Cancelada":   { bg: "rgba(239,68,68,0.12)",   color: "#EF4444" },
};

const FONT  = "'Barlow', sans-serif";
const FONTC = "'Barlow Condensed', sans-serif";
const DARK  = "#1F2937";
const ORANGE = "#E88B3A";

// Función auxiliar para verificar si una fecha es hoy
const isToday = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const hoy = new Date();
  return d.getDate() === hoy.getDate() &&
         d.getMonth() === hoy.getMonth() &&
         d.getFullYear() === hoy.getFullYear();
};

export default function ModuloCaja() {
  const [ordenesGeneradas, setOrdenesGeneradas] = useState([]);
  const [pagosHistorial, setPagosHistorial]     = useState([]); // Renombrado para indicar que trae todo
  const [loading, setLoading]                   = useState(false);
  
  // Estados de Filtros
  const [buscar, setBuscar]                     = useState("");
  const [filtroTiempo, setFiltroTiempo]         = useState("hoy"); // "hoy" | "todos" | "fecha"
  const [fechaEspecifica, setFechaEspecifica]   = useState("");
  
  const [vistaTab, setVistaTab]                 = useState("cobrar"); // "cobrar" | "reporte"
  const [msg, setMsg]                           = useState(null);

  // Modal cobro
  const [showCobro, setShowCobro]   = useState(null);
  const [formCobro, setFormCobro]   = useState({ monto: "", metodo_pago: "Efectivo" });
  const [procesando, setProcesando] = useState(false);

  // Modal detalle orden
  const [showDetalle, setShowDetalle] = useState(null);

  // ── CARGA DE DATOS ────────────────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    try {
      // NOTA: Asegúrate de que el endpoint de pagos ahora traiga el historial completo 
      // (ej. "/pagos/todos") en lugar de solo los de hoy, para que el filtro funcione.
      const [resOrdenes, resPagos] = await Promise.all([
        API.get("/pagos/ordenes-generadas").catch(() => ({ data: [] })),
        API.get("/pagos/todos").catch(() => ({ data: [] })), // <-- Endpoint ajustado
      ]);
      setOrdenesGeneradas(Array.isArray(resOrdenes.data) ? resOrdenes.data : []);
      setPagosHistorial(Array.isArray(resPagos.data) ? resPagos.data : []);
    } catch (e) {
      console.error("Error al cargar datos de caja:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // ── COBRO ─────────────────────────────────────────────────────────────────
  const abrirCobro = (orden) => {
    setFormCobro({ monto: parseFloat(orden.total || 0).toFixed(2), metodo_pago: "Efectivo" });
    setShowCobro(orden);
    setMsg(null);
  };

  const handleProcesarCobro = async () => {
    if (!formCobro.monto || parseFloat(formCobro.monto) <= 0)
      return setMsg({ type: "error", text: "Ingresa un monto válido." });
    setProcesando(true);
    setMsg(null);
    try {
      await API.post("/pagos/procesar", {
        id_orden:    showCobro.id_orden,
        monto:       parseFloat(formCobro.monto),
        metodo_pago: formCobro.metodo_pago,
      });
      setMsg({ type: "success", text: "✅ Pago registrado. La orden ahora está PAGADA." });
      setTimeout(() => {
        setShowCobro(null);
        cargar();
      }, 1200);
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.error || "Error al procesar el cobro." });
    } finally {
      setProcesando(false);
    }
  };

  // ── FILTROS Y KPIs ────────────────────────────────────────────────────────
  const aplicarFiltros = (item, campoFecha) => {
    const valorFecha = item[campoFecha];
    
    // 1. Filtro de Texto (incluimos la fecha formateada por si el usuario la tipea en el buscador)
    const fechaStr = valorFecha ? new Date(valorFecha).toLocaleDateString("es-EC") : "";
    const txt = `${item.nombres || ""} ${item.apellidos || ""} ${item.numero_ticket || ""} ${item.cedula || ""} ${fechaStr}`.toLowerCase();
    const matchTexto = txt.includes(buscar.toLowerCase());

    // 2. Filtro de Tiempo
    let matchTiempo = true;
    if (filtroTiempo === "hoy") {
      matchTiempo = isToday(valorFecha);
    } else if (filtroTiempo === "fecha" && fechaEspecifica) {
      if (!valorFecha) return false;
      const d = new Date(valorFecha);
      const isoDate = d.toISOString().split('T')[0]; // Convertimos a YYYY-MM-DD local
      matchTiempo = (isoDate === fechaEspecifica);
    }

    return matchTexto && matchTiempo;
  };

  const ordenesFiltradas = ordenesGeneradas.filter(o => aplicarFiltros(o, "fecha_orden"));
  const pagosFiltrados   = pagosHistorial.filter(p => aplicarFiltros(p, "fecha_pago"));

  // KPIs dinámicos basados en lo que se está viendo (hoy, todos o fecha específica)
  const totalRecaudado    = pagosFiltrados.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
  const totalTransacciones = pagosFiltrados.length;
  const porMetodo = pagosFiltrados.reduce((acc, p) => {
    acc[p.metodo_pago] = (acc[p.metodo_pago] || 0) + parseFloat(p.monto || 0);
    return acc;
  }, {});

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "1.25rem", fontFamily: FONT, color: DARK }}>

      {/* ── HEADER ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontFamily: FONTC, fontSize: "1.85rem", fontWeight: 800, color: DARK, margin: 0, textTransform: "uppercase" }}>
            MÓDULO DE <span style={{ color: ORANGE }}>CAJA</span>
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#6B7280", margin: "0.2rem 0 0" }}>
            Procesamiento de cobros y reporte de pagos
          </p>
        </div>
        <button onClick={cargar} disabled={loading} style={S.btnRefresh}>
          {loading ? "…" : "↻ Actualizar"}
        </button>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: "#F3F4F6", borderRadius: "10px", padding: "0.25rem", gap: "0.25rem", marginBottom: "1.5rem", width: "fit-content" }}>
        {[
          { key: "cobrar",  label: `💳 Cobrar (${ordenesFiltradas.length})` },
          { key: "reporte", label: `📊 Reporte (${totalTransacciones})` },
        ].map(t => (
          <button key={t.key} onClick={() => setVistaTab(t.key)} style={{
            ...S.tabBtn,
            background: vistaTab === t.key ? "#FFF" : "transparent",
            color:      vistaTab === t.key ? DARK : "#6B7280",
            fontWeight: vistaTab === t.key ? 700 : 500,
            boxShadow:  vistaTab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BARRA DE FILTROS UNIFICADA ── */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        {/* Buscador de Texto */}
        <div style={{ ...S.searchWrap, flex: "1 1 300px", maxWidth: "400px" }}>
          <span style={{ color: "#9CA3AF" }}>🔍</span>
          <input
            placeholder="Buscar paciente, cédula, ticket o fecha..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={S.searchInput}
          />
        </div>

        {/* Filtro de Tiempo */}
        <select 
          value={filtroTiempo} 
          onChange={e => setFiltroTiempo(e.target.value)}
          style={{ ...S.input, flex: "0 1 180px" }}
        >
          <option value="hoy">Solo Hoy</option>
          <option value="todos">Todos los registros</option>
          <option value="fecha">Fecha específica</option>
        </select>

        {/* Selector de Fecha (Solo visible si selecciona "Fecha específica") */}
        {filtroTiempo === "fecha" && (
          <input
            type="date"
            value={fechaEspecifica}
            onChange={e => setFechaEspecifica(e.target.value)}
            style={{ ...S.input, flex: "0 1 180px" }}
          />
        )}
      </div>

      {/* ══════════════════════════════════
          VISTA: COBRAR
      ══════════════════════════════════ */}
      {vistaTab === "cobrar" && (
        <div style={S.tableCard}>
          <div style={S.tableHead}>
            <span style={{ flex: "0 0 130px" }}>TICKET</span>
            <span style={{ flex: 2 }}>PACIENTE</span>
            <span style={{ flex: 1 }}>FECHA</span>
            <span style={{ flex: "0 0 100px", textAlign: "right" }}>TOTAL</span>
            <span style={{ flex: "0 0 110px", textAlign: "center" }}>COBRAR</span>
          </div>

          {loading ? (
            <div style={S.empty}>Cargando...</div>
          ) : ordenesFiltradas.length === 0 ? (
            <div style={S.empty}>
              {buscar || filtroTiempo !== "todos" ? "Sin resultados para los filtros aplicados." : "No hay órdenes pendientes."}
            </div>
          ) : (
            ordenesFiltradas.map((o, i) => (
              <div
                key={o.id_orden}
                style={{ ...S.tableRow, background: i % 2 === 0 ? "#FFF" : "#F9FAFB" }}
                onMouseEnter={e => e.currentTarget.style.background = "#FFF7ED"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#FFF" : "#F9FAFB"}
              >
                <div style={{ flex: "0 0 130px" }}>
                  <span style={S.ticketBadge}>{o.numero_ticket || `#${o.id_orden}`}</span>
                </div>
                <div style={{ flex: 2 }}>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem", color: DARK, margin: 0 }}>
                    {o.nombres ? `${o.nombres} ${o.apellidos}` : `Paciente #${o.id_paciente}`}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: 0 }}>
                    {o.cedula || "—"}
                  </p>
                </div>
                <div style={{ flex: 1, fontSize: "0.82rem", color: "#6B7280" }}>
                  {o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString("es-EC") : "—"}
                </div>
                <div style={{ flex: "0 0 100px", textAlign: "right" }}>
                  <span style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: DARK }}>
                    ${parseFloat(o.total || 0).toFixed(2)}
                  </span>
                </div>
                <div style={{ flex: "0 0 110px", display: "flex", justifyContent: "center", gap: "0.4rem" }}>
                  <button onClick={() => setShowDetalle(o)} style={S.btnVer} title="Ver detalle">👁️</button>
                  <button onClick={() => abrirCobro(o)} style={S.btnCobrar} title="Registrar cobro">💳 Cobrar</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ══════════════════════════════════
          VISTA: REPORTE
      ══════════════════════════════════ */}
      {vistaTab === "reporte" && (
        <>
          {/* KPIs resumen dinámicos */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "0.85rem", marginBottom: "1.5rem" }}>
            <KpiBox icon="💰" label="Total Recaudado"  value={`$${totalRecaudado.toFixed(2)}`} color="#10B981" />
            <KpiBox icon="🧾" label="Transacciones"    value={totalTransacciones}               color={ORANGE} />
            {Object.entries(porMetodo).map(([metodo, monto]) => (
              <KpiBox key={metodo} icon="💳" label={metodo} value={`$${monto.toFixed(2)}`} color="#3B82F6" />
            ))}
          </div>

          <div style={S.tableCard}>
            <div style={S.tableHead}>
              <span style={{ flex: "0 0 130px" }}>TICKET</span>
              <span style={{ flex: 2 }}>PACIENTE</span>
              <span style={{ flex: 1 }}>MÉTODO</span>
              <span style={{ flex: 1 }}>FECHA / HORA</span>
              <span style={{ flex: "0 0 110px", textAlign: "right" }}>MONTO</span>
            </div>

            {loading ? (
              <div style={S.empty}>Cargando...</div>
            ) : pagosFiltrados.length === 0 ? (
              <div style={S.empty}>No hay pagos registrados para los filtros actuales.</div>
            ) : (
              pagosFiltrados.map((p, i) => (
                <div key={p.id_pago || i} style={{ ...S.tableRow, background: i % 2 === 0 ? "#FFF" : "#F9FAFB" }}>
                  <div style={{ flex: "0 0 130px" }}>
                    <span style={S.ticketBadge}>{p.numero_ticket || `#${p.id_orden}`}</span>
                  </div>
                  <div style={{ flex: 2 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.875rem", color: DARK, margin: 0 }}>
                      {p.nombres ? `${p.nombres} ${p.apellidos}` : `Orden #${p.id_orden}`}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: 0 }}>
                      Atendido por: @{p.secretaria || "—"}
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={S.metodoBadge}>{p.metodo_pago || "—"}</span>
                  </div>
                  <div style={{ flex: 1, fontSize: "0.82rem", color: "#6B7280" }}>
                    {p.fecha_pago
                      ? new Date(p.fecha_pago).toLocaleString("es-EC", { day: '2-digit', month: '2-digit', year: 'numeric', hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </div>
                  <div style={{ flex: "0 0 110px", textAlign: "right" }}>
                    <span style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: "#10B981" }}>
                      ${parseFloat(p.monto || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════
          MODALES (Detalle de Orden y Cobro - Se mantienen igual)
      ══════════════════════════════════ */}
      
      {/* Modal Detalle */}
      {showDetalle && (
        <Overlay onClose={() => setShowDetalle(null)}>
          <ModalHeader title="DETALLE" titleOrange="ORDEN" subtitle={showDetalle.numero_ticket || `Orden #${showDetalle.id_orden}`} onClose={() => setShowDetalle(null)} />
          <div style={S.modalBody}>
            {(() => {
              const o = showDetalle;
              const ec = estadoColor[o.estado] || { bg: "#F8FAFC", color: "#6B7280" };
              return (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                    <DetalleItem label="Ticket"   value={o.numero_ticket || `#${o.id_orden}`} />
                    <DetalleItem label="Estado" value={<span style={{ background: ec.bg, color: ec.color, fontFamily: FONTC, fontWeight: 700, fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "6px" }}>{o.estado}</span>} />
                    <DetalleItem label="Paciente" value={o.nombres ? `${o.nombres} ${o.apellidos}` : `#${o.id_paciente}`} />
                    <DetalleItem label="Cédula"   value={o.cedula || "—"} />
                    <DetalleItem label="Total"    value={`$${parseFloat(o.total || 0).toFixed(2)}`} />
                    <DetalleItem label="Fecha"    value={o.fecha_orden ? new Date(o.fecha_orden).toLocaleString("es-EC") : "—"} />
                  </div>
                  <div style={{ display: "flex", gap: "0.75rem" }}>
                    <button onClick={() => { setShowDetalle(null); abrirCobro(o); }} style={{ ...S.btnFull, flex: 1 }}>💳 PROCEDER AL COBRO</button>
                    <button onClick={() => setShowDetalle(null)} style={S.btnCancel}>Cerrar</button>
                  </div>
                </>
              );
            })()}
          </div>
        </Overlay>
      )}

      {/* Modal Cobro */}
      {showCobro && (
        <Overlay onClose={() => !procesando && setShowCobro(null)}>
          <ModalHeader title="REGISTRAR" titleOrange="COBRO" subtitle={`Orden: ${showCobro.numero_ticket || `#${showCobro.id_orden}`}`} onClose={() => !procesando && setShowCobro(null)} />
          <div style={S.modalBody}>
            <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem", border: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontFamily: FONTC, fontSize: "0.68rem", color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Paciente</p>
                  <p style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: DARK, margin: 0 }}>{showCobro.nombres ? `${showCobro.nombres} ${showCobro.apellidos}` : `#${showCobro.id_paciente}`}</p>
                  <p style={{ fontFamily: FONT, fontSize: "0.78rem", color: "#6B7280", margin: "0.15rem 0 0" }}>CI: {showCobro.cedula || "—"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: FONTC, fontSize: "0.68rem", color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Total Orden</p>
                  <p style={{ fontFamily: FONTC, fontSize: "1.4rem", fontWeight: 800, color: "#10B981", margin: 0 }}>${parseFloat(showCobro.total || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>

            {msg && <Alert msg={msg} />}

            <div style={{ marginBottom: "1rem" }}>
              <label style={S.label}>Monto a Cobrar *</label>
              <input type="number" step="0.01" min="0" value={formCobro.monto} onChange={e => setFormCobro(f => ({ ...f, monto: e.target.value }))} style={{ ...S.input, width: "100%" }} placeholder="0.00" />
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={S.label}>Método de Pago *</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {METODOS.map(m => {
                  const activo = formCobro.metodo_pago === m;
                  return (
                   <button 
                  key={m} 
                  type="button" 
                  onClick={() => setFormCobro(f => ({ ...f, metodo_pago: m }))} 
                  style={{ 
                    padding: "0.65rem", 
                    borderRadius: "8px", 
                    border: `1.5px solid ${activo ? ORANGE : "#E5E7EB"}`, 
                    background: activo ? `${ORANGE}15` : "#FAFAFA", 
                    color: activo ? ORANGE : "#374151", 
                    fontFamily: FONTC, 
                    fontWeight: activo ? 700 : 500, 
                    fontSize: "0.82rem", 
                    cursor: "pointer", 
                    transition: "all 0.15s" 
                  }}
                >
                  {m === "Efectivo" ? "💵" : "🏦"} {m}
                </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={handleProcesarCobro} disabled={procesando} style={{ ...S.btnFull, flex: 1, opacity: procesando ? 0.7 : 1 }}>{procesando ? "Procesando..." : "✅ CONFIRMAR COBRO"}</button>
              <button onClick={() => setShowCobro(null)} disabled={procesando} style={S.btnCancel}>Cancelar</button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTES Y ESTILOS (Sin cambios significativos, se omiten aquí para legibilidad pero debes mantenerlos igual que en tu código original) ────
function KpiBox({ icon, label, value, color }) {
  return (
    <div style={{ background: "#FFF", borderRadius: "10px", padding: "1rem 1.25rem", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
        <span style={{ fontSize: "1rem" }}>{icon}</span>
        <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>{label}</p>
      </div>
      <p style={{ fontFamily: FONTC, fontSize: "1.6rem", fontWeight: 800, color, margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function Overlay({ children, onClose }) {
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={e => e.target === e.currentTarget && onClose()}><div style={{ background: "#FFF", borderRadius: "16px", width: "100%", maxWidth: "520px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}><div style={{ overflowY: "auto", flex: 1 }}>{children}</div></div></div>;
}

function ModalHeader({ title, titleOrange, subtitle, onClose }) {
  return <div style={{ background: "#1F2937", padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><div><h3 style={{ fontFamily: FONTC, fontWeight: 800, fontSize: "1.35rem", color: "#FFF", margin: 0, textTransform: "uppercase" }}>{title} <span style={{ color: "#E88B3A" }}>{titleOrange}</span></h3><p style={{ fontFamily: FONT, fontSize: "0.75rem", color: "#94A3B8", margin: "0.2rem 0 0" }}>{subtitle}</p></div><button onClick={onClose} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "1.2rem", cursor: "pointer" }}>✕</button></div>;
}

function Alert({ msg }) {
  return <div style={{ padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem", background: msg.type === "error" ? "#FEF2F2" : "#F0FDF4", color: msg.type === "error" ? "#DC2626" : "#16A34A", border: `1px solid ${msg.type === "error" ? "#FECACA" : "#BBF7D0"}`, fontSize: "0.85rem" }}>{msg.text}</div>;
}

function DetalleItem({ label, value }) {
  return <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem 1rem" }}><p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.25rem" }}>{label}</p><p style={{ fontFamily: FONT, fontSize: "0.9rem", fontWeight: 600, color: "#1F2937", margin: 0 }}>{value || "—"}</p></div>;
}

const S = {
  btnRefresh:  { background: "rgba(232,139,58,0.1)", border: "1px solid rgba(232,139,58,0.25)", color: "#E88B3A", padding: "0.5rem 1.1rem", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.84rem", cursor: "pointer" },
  tabBtn:      { border: "none", borderRadius: "7px", padding: "0.45rem 1rem", fontFamily: FONTC, fontSize: "0.8rem", letterSpacing: "0.03em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" },
  searchWrap:  { display: "flex", alignItems: "center", gap: "0.6rem", background: "#FFF", border: "1.5px solid #E5E7EB", borderRadius: "8px", padding: "0.6rem 1rem", boxSizing: "border-box" },
  searchInput: { flex: 1, border: "none", outline: "none", fontFamily: FONT, fontSize: "0.875rem", background: "transparent" },
  tableCard:   { background: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  tableHead:   { display: "flex", alignItems: "center", padding: "0.75rem 1.25rem", background: "#1F2937", fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" },
  tableRow:    { display: "flex", alignItems: "center", padding: "0.85rem 1.25rem", borderBottom: "1px solid #F3F4F6", transition: "background 0.15s" },
  empty:       { textAlign: "center", padding: "3rem", color: "#9CA3AF", fontFamily: FONT, fontSize: "0.875rem" },
  ticketBadge: { background: "#F1F5F9", color: "#374151", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.04em" },
  metodoBadge: { background: "rgba(59,130,246,0.1)", color: "#2563EB", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.75rem", fontFamily: FONTC, fontWeight: 700 },
  btnVer:      { background: "rgba(232,139,58,0.1)", border: "1px solid rgba(232,139,58,0.25)", borderRadius: "6px", width: "30px", height: "30px", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#E88B3A" },
  btnCobrar:   { background: "#10B981", border: "none", borderRadius: "7px", padding: "0.35rem 0.7rem", cursor: "pointer", fontFamily: FONTC, fontWeight: 700, fontSize: "0.75rem", color: "#FFF", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.25rem" },
  btnFull:     { width: "100%", padding: "0.75rem", background: "#1F2937", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase" },
  btnCancel:   { padding: "0.75rem 1.25rem", background: "#F1F5F9", color: "#374151", border: "none", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", whiteSpace: "nowrap" },
  modalBody:   { padding: "1.5rem" },
  label:       { fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "#6B7280", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" },
  input:       { padding: "0.65rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontFamily: FONT, fontSize: "0.9rem", color: "#1F2937", background: "#FAFAFA", outline: "none", boxSizing: "border-box" },
};