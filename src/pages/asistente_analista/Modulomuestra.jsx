import { useState, useEffect } from "react";
import API from "../../services/api";

// ─── CONSTANTES DE DISEÑO ─────────────────────────────────────────────────────
const FONT  = "'Barlow', sans-serif";
const FONTC = "'Barlow Condensed', sans-serif";
const DARK  = "#1F2937";
const ORANGE = "#E88B3A";

// Color del indicador visual según el recipiente
const getColorTubo = (nombre = "") => {
    const n = nombre.toLowerCase();
    if (n.includes("lila") || n.includes("edta"))  return "#8B5CF6";
    if (n.includes("roja") || n.includes("rojo"))   return "#EF4444";
    if (n.includes("azul") || n.includes("citrato"))return "#3B82F6";
    if (n.includes("verde")|| n.includes("heparina"))return "#10B981";
    if (n.includes("gris") || n.includes("fluoruro"))return "#6B7280";
    if (n.includes("amarilla")|| n.includes("sst")) return "#EAB308";
    if (n.includes("celeste"))                       return "#38BDF8";
    if (n.includes("orina"))                         return "#F59E0B";
    if (n.includes("heces"))                         return "#92400E";
    return "#E88B3A";
};

// Icono por categoría de examen
const iconoCategoria = (nombre = "") => {
    const n = nombre.toLowerCase();
    if (n.includes("hemat") || n.includes("sangre")) return "🩸";
    if (n.includes("orina") || n.includes("urin"))   return "🧪";
    if (n.includes("heces") || n.includes("cop"))    return "🧫";
    if (n.includes("quim") || n.includes("bioquim")) return "⚗️";
    if (n.includes("micro"))                          return "🔬";
    if (n.includes("hormon") || n.includes("inmun")) return "💉";
    return "🧬";
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function ModuloMuestra() {
    const [ordenesPagadas, setOrdenesPagadas] = useState([]);
    const [loading, setLoading]               = useState(false);
    const [buscar, setBuscar]                 = useState("");
    const [vistaTab, setVistaTab]             = useState("registrar");
    const [msg, setMsg]                       = useState(null);

    // Modal toma
    const [showToma, setShowToma]         = useState(null);
    const [guardando, setGuardando]       = useState(false);
    const [resultadoToma, setResultadoToma] = useState(null);

    // Insumos y recipientes detectados al abrir el modal
    const [insumosPrevios, setInsumosPrevios]   = useState([]);
    const [loadingInsumos, setLoadingInsumos]   = useState(false);
    const [categorias, setCategorias]           = useState([]);   // agrupado por categoría
    // recipientes que se enviarán al backend (auto-detectados, sin selección manual)
    const [recipientes, setRecipientes]         = useState([]);

    // Modal detalle orden
    const [showDetalle, setShowDetalle] = useState(null);

    // Búsqueda por código
    const [codigoBuscar, setCodigoBuscar]           = useState("");
    const [buscandoCodigo, setBuscandoCodigo]       = useState(false);
    const [muestraEncontrada, setMuestraEncontrada] = useState(null);
    const [errorBusqueda, setErrorBusqueda]         = useState("");

    // Historial
    const [historial, setHistorial]               = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [filtroFecha, setFiltroFecha]           = useState("todos"); // "hoy" | "todos"
    const [buscarHistorial, setBuscarHistorial]   = useState("");

    

    // ── Cargar órdenes pagadas ────────────────────────────────────────────────
    const cargar = async () => {
        setLoading(true);
        try {
            const res = await API.get("/ordenes?estado=Pagada").catch(() => ({ data: [] }));
            setOrdenesPagadas(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { cargar(); }, []);

    // ── Abrir modal: cargar insumos y construir recipientes automáticamente ──
    const abrirToma = async (orden) => {
        setShowToma(orden);
        setResultadoToma(null);
        setMsg(null);
        setInsumosPrevios([]);
        setRecipientes([]);
        setCategorias([]);
        setLoadingInsumos(true);

        try {
            const { data } = await API.get(`/muestras/insumos/${orden.id_orden}`);
            const listaInsumos   = data.insumos        || [];
            const recipientesAuto = data.recipientes_auto || [];
            const categoriasData  = data.categorias    || [];

            setInsumosPrevios(listaInsumos);
            setCategorias(categoriasData);

            // Los recipientes vienen listos del backend — nombre del insumo = tipo_recipiente
            // No necesitamos inferir nada: si el insumo se llama "Tubo Lila", ESO es el recipiente.
            if (recipientesAuto.length > 0) {
                setRecipientes(recipientesAuto.map(r => ({
                    id_tipo_muestra: r.id_tipo_muestra,
                    tipo_recipiente: r.tipo_recipiente,
                    nombre_insumo:   r.nombre_insumo,
                    examenes:        r.examenes,
                })));
            } else {
                // Orden sin insumos vinculados en inventario
                setRecipientes([]);
            }

        } catch (e) {
            console.warn("No se pudieron cargar insumos:", e?.response?.status);
            setInsumosPrevios(null);
            setRecipientes([]);
        } finally {
            setLoadingInsumos(false);
        }
    };

    // ── Confirmar toma ────────────────────────────────────────────────────────
    const handleRegistrarToma = async () => {
        setGuardando(true);
        setMsg(null);
        try {
            const { data } = await API.post("/muestras/recoleccion", {
                id_orden:    showToma.id_orden,
                recipientes: recipientes,
            });
            setResultadoToma(data);
            cargar();
        } catch (err) {
            setMsg({ type: "error", text: err.response?.data?.error || "Error al registrar la muestra." });
        } finally {
            setGuardando(false);
        }
    };

    // ── Cargar historial ──────────────────────────────────────────────────────
    const cargarHistorial = async () => {
        setLoadingHistorial(true);
        try {
            const res = await API.get("/muestras/historial").catch(() => ({ data: [] }));
            setHistorial(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingHistorial(false);
        }
    };

    useEffect(() => {
        if (vistaTab === "historial") cargarHistorial();
    }, [vistaTab]);

    // Hoy en formato ISO local para comparar con fecha_orden
    const hoyISO = new Date().toISOString().slice(0, 10);

    const historialFiltrado = historial.filter(o => {
        const txt = `${o.nombres || ""} ${o.apellidos || ""} ${o.numero_ticket || ""} ${o.cedula || ""}`.toLowerCase();
        const coincideTexto = txt.includes(buscarHistorial.toLowerCase());
        const fechaOrden = o.fecha_orden ? o.fecha_orden.slice(0, 10) : "";
        const coincideFecha = filtroFecha === "todos" || fechaOrden === hoyISO;
        return coincideTexto && coincideFecha;
    });

    const ESTADO_BADGE = {
        "Pagada":        { bg: "#EFF6FF", color: "#1D4ED8", label: "Pagada" },
        "Muestra Tomada":{ bg: "#FEF3C7", color: "#92400E", label: "Muestra Tomada" },
        "En Proceso":    { bg: "#F0FDF4", color: "#15803D", label: "En Proceso" },
        "Por Validar":   { bg: "#FFF7ED", color: "#C2410C", label: "Por Validar" },
        "Validada":      { bg: "#F0FDF4", color: "#065F46", label: "Validada" },
        "Entregada":     { bg: "#F8FAFC", color: "#374151", label: "Entregada" },
    };

    // ── Buscar por código ─────────────────────────────────────────────────────
    const handleBuscarCodigo = async () => {
        if (!codigoBuscar.trim()) return;
        setBuscandoCodigo(true);
        setMuestraEncontrada(null);
        setErrorBusqueda("");
        try {
            const { data } = await API.get(`/muestras/buscar/${codigoBuscar.trim().toUpperCase()}`);
            setMuestraEncontrada(data);
        } catch {
            setErrorBusqueda("No se encontró ninguna muestra con ese código.");
        } finally {
            setBuscandoCodigo(false);
        }
    };

    const ordenesFiltradas = ordenesPagadas.filter(o => {
        const txt = `${o.nombres || ""} ${o.apellidos || ""} ${o.numero_ticket || ""}`.toLowerCase();
        return txt.includes(buscar.toLowerCase());
    });

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: "1.25rem", fontFamily: FONT, color: DARK }}>

            {/* HEADER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                    <h2 style={{ fontFamily: FONTC, fontSize: "1.85rem", fontWeight: 800, color: DARK, margin: 0, textTransform: "uppercase" }}>
                        TOMA DE <span style={{ color: ORANGE }}>MUESTRA</span>
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "#6B7280", margin: "0.2rem 0 0" }}>
                        Al confirmar, la orden pasa a <strong>En Proceso</strong> y el inventario se descuenta automáticamente
                    </p>
                </div>
                <button onClick={cargar} disabled={loading} style={S.btnRefresh}>
                    {loading ? "…" : "↻ Actualizar"}
                </button>
            </div>

            {/* TABS */}
            <div style={{ display: "flex", background: "#F3F4F6", borderRadius: "10px", padding: "0.25rem", gap: "0.25rem", marginBottom: "1.5rem", width: "fit-content" }}>
                {[
                    { key: "registrar", label: `🧪 Registrar Toma (${ordenesPagadas.length})` },
                    { key: "buscar",    label: "🔍 Buscar por Código" },
                    { key: "historial", label: "📋 Historial" },
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

            {/* ══ VISTA: REGISTRAR ══ */}
            {vistaTab === "registrar" && (
                <>
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem" }}>
                        <div style={{ ...S.searchWrap, flex: 1 }}>
                            <span style={{ color: "#9CA3AF" }}>🔍</span>
                            <input
                                placeholder="Buscar por paciente o ticket..."
                                value={buscar}
                                onChange={e => setBuscar(e.target.value)}
                                style={S.searchInput}
                            />
                            {buscar && (
                                <button onClick={() => setBuscar("")} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
                            )}
                        </div>
                    </div>

                    <div style={S.tableCard}>
                        <div style={S.tableHead}>
                            <span style={{ flex: "0 0 130px" }}>TICKET</span>
                            <span style={{ flex: 2 }}>PACIENTE</span>
                            <span style={{ flex: 1 }}>FECHA</span>
                            <span style={{ flex: "0 0 100px", textAlign: "right" }}>TOTAL</span>
                            <span style={{ flex: "0 0 120px", textAlign: "center" }}>MUESTRA</span>
                        </div>

                        {loading ? (
                            <div style={S.empty}>Cargando órdenes pagadas...</div>
                        ) : ordenesFiltradas.length === 0 ? (
                            <div style={S.empty}>
                                {buscar ? "Sin resultados." : "No hay órdenes pagadas pendientes."}
                            </div>
                        ) : (
                            ordenesFiltradas.map((o, i) => (
                                <div key={o.id_orden}
                                    style={{ ...S.tableRow, background: i % 2 === 0 ? "#FFF" : "#F9FAFB" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#F0FDF4"}
                                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#FFF" : "#F9FAFB"}
                                >
                                    <div style={{ flex: "0 0 130px" }}>
                                        <span style={S.ticketBadge}>{o.numero_ticket || `#${o.id_orden}`}</span>
                                    </div>
                                    <div style={{ flex: 2 }}>
                                        <p style={{ fontWeight: 600, fontSize: "0.875rem", color: DARK, margin: 0 }}>
                                            {o.nombres ? `${o.nombres} ${o.apellidos}` : `Paciente #${o.id_paciente}`}
                                        </p>
                                        <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: 0 }}>{o.cedula || "—"}</p>
                                    </div>
                                    <div style={{ flex: 1, fontSize: "0.82rem", color: "#6B7280" }}>
                                        {o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString("es-EC") : "—"}
                                    </div>
                                    <div style={{ flex: "0 0 100px", textAlign: "right" }}>
                                        <span style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: DARK }}>
                                            ${parseFloat(o.total || 0).toFixed(2)}
                                        </span>
                                    </div>
                                    <div style={{ flex: "0 0 120px", display: "flex", justifyContent: "center", gap: "0.4rem" }}>
                                        <button onClick={() => setShowDetalle(o)} style={S.btnVer} title="Ver detalle">👁️</button>
                                        <button onClick={() => abrirToma(o)} style={S.btnTomar}>🧪 Tomar</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {/* ══ VISTA: BUSCAR POR CÓDIGO ══ */}
            {vistaTab === "buscar" && (
                <div style={{ maxWidth: "580px" }}>
                    <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1.25rem", display: "flex", gap: "0.65rem" }}>
                        <span>💡</span>
                        <p style={{ fontFamily: FONT, fontSize: "0.82rem", color: "#1D4ED8", margin: 0 }}>
                            Ingresa el número de ticket del recipiente (ej: <strong>LAB-EBF6</strong>) para localizar la muestra.
                        </p>
                    </div>

                    <div style={{ display: "flex", gap: "0.6rem", marginBottom: "1.25rem" }}>
                        <input
                            placeholder="Ej: LAB-EBF6"
                            value={codigoBuscar}
                            onChange={e => {
                                setCodigoBuscar(e.target.value.toUpperCase());
                                setMuestraEncontrada(null);
                                setErrorBusqueda("");
                            }}
                            onKeyDown={e => e.key === "Enter" && handleBuscarCodigo()}
                            style={{ ...S.input, flex: 1, fontFamily: "'Courier New', monospace", fontSize: "1rem", fontWeight: 700, letterSpacing: "0.08em" }}
                        />
                        <button onClick={handleBuscarCodigo} disabled={buscandoCodigo || !codigoBuscar.trim()}
                            style={{ ...S.btnFull, width: "auto", padding: "0 1.5rem", opacity: (!codigoBuscar.trim() || buscandoCodigo) ? 0.6 : 1 }}>
                            {buscandoCodigo ? "..." : "🔍 Buscar"}
                        </button>
                    </div>

                    {errorBusqueda && (
                        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "0.85rem 1rem" }}>
                            <p style={{ fontFamily: FONT, fontSize: "0.85rem", color: "#DC2626", margin: 0 }}>⚠️ {errorBusqueda}</p>
                        </div>
                    )}

                    {muestraEncontrada && Array.isArray(muestraEncontrada) && (() => {
                        const primera = muestraEncontrada[0];
                        return (
                            <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: "12px", padding: "1.25rem", marginTop: "0.75rem" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                                    <div>
                                        <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#16A34A", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.2rem" }}>✓ MUESTRA ENCONTRADA</p>
                                        <p style={{ fontFamily: FONTC, fontSize: "1.1rem", fontWeight: 700, color: DARK, margin: 0 }}>
                                            {primera.paciente_nombres ? `${primera.paciente_nombres} ${primera.paciente_apellidos}` : "—"}
                                        </p>
                                    </div>
                                    <div style={{ background: "#FFF", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "0.4rem 0.75rem", textAlign: "center" }}>
                                        <p style={{ fontFamily: "'Courier New', monospace", fontSize: "1rem", fontWeight: 700, color: DARK, margin: 0 }}>{primera.codigo_muestra}</p>
                                        <p style={{ fontFamily: FONTC, fontSize: "0.65rem", color: "#16A34A", margin: 0, textTransform: "uppercase" }}>Código / Ticket</p>
                                    </div>
                                </div>

                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
                                    <DetalleItem label="Estado orden" value={primera.estado_orden} />
                                    <DetalleItem label="Fecha / Hora" value={primera.fecha_recoleccion ? `${primera.fecha_recoleccion} ${primera.hora_recoleccion || ""}`.trim() : "—"} />
                                </div>

                                <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
                                    🧪 INSUMOS REGISTRADOS ({muestraEncontrada.length})
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                    {muestraEncontrada.map((m, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#FFF", borderRadius: "8px", padding: "0.5rem 0.75rem", border: "1px solid #D1FAE5" }}>
                                            <div style={{ width: "10px", height: "22px", borderRadius: "2px", background: getColorTubo(m.tipo_recipiente), flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontFamily: FONT, fontSize: "0.82rem", fontWeight: 700, color: DARK, margin: 0 }}>{m.tipo_recipiente || "No especificado"}</p>
                                                {m.tipo_muestra_nombre && (
                                                <p style={{ fontFamily: FONT, fontSize: "0.72rem", color: "#6B7280", margin: 0 }}>{m.tipo_muestra_nombre}</p>
                                            )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* ══ VISTA: HISTORIAL ══ */}
            {vistaTab === "historial" && (
                <>
                    {/* Controles: filtro fecha + buscador + refresh */}
                    <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
                        {/* Filtro Hoy / Todos */}
                        <div style={{ display: "flex", background: "#F3F4F6", borderRadius: "8px", padding: "0.2rem", gap: "0.2rem" }}>
                            {[{ key: "hoy", label: "📅 Hoy" }, { key: "todos", label: "📂 Todos" }].map(f => (
                                <button key={f.key} onClick={() => setFiltroFecha(f.key)} style={{
                                    ...S.tabBtn,
                                    background: filtroFecha === f.key ? "#FFF" : "transparent",
                                    color:      filtroFecha === f.key ? DARK : "#6B7280",
                                    fontWeight: filtroFecha === f.key ? 700 : 500,
                                    boxShadow:  filtroFecha === f.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                                    fontSize: "0.78rem",
                                }}>
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Buscador */}
                        <div style={{ ...S.searchWrap, flex: 1, minWidth: "200px" }}>
                            <span style={{ color: "#9CA3AF" }}>🔍</span>
                            <input
                                placeholder="Paciente, ticket, cédula..."
                                value={buscarHistorial}
                                onChange={e => setBuscarHistorial(e.target.value)}
                                style={S.searchInput}
                            />
                            {buscarHistorial && (
                                <button onClick={() => setBuscarHistorial("")} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
                            )}
                        </div>

                        {/* Refresh */}
                        <button onClick={cargarHistorial} disabled={loadingHistorial} style={S.btnRefresh}>
                            {loadingHistorial ? "…" : "↻ Actualizar"}
                        </button>
                    </div>

                    {/* Contador */}
                    <p style={{ fontFamily: FONTC, fontSize: "0.72rem", color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.6rem" }}>
                        {historialFiltrado.length} registro{historialFiltrado.length !== 1 ? "s" : ""}{filtroFecha === "hoy" ? " hoy" : " en total"}
                    </p>

                    <div style={S.tableCard}>
                        <div style={S.tableHead}>
                            <span style={{ flex: "0 0 130px" }}>TICKET</span>
                            <span style={{ flex: 2 }}>PACIENTE</span>
                            <span style={{ flex: "0 0 95px" }}>CÉDULA</span>
                            <span style={{ flex: 1 }}>FECHA</span>
                            <span style={{ flex: "0 0 130px", textAlign: "center" }}>ESTADO</span>
                        </div>

                        {loadingHistorial ? (
                            <div style={S.empty}>Cargando historial...</div>
                        ) : historialFiltrado.length === 0 ? (
                            <div style={S.empty}>
                                {buscarHistorial || filtroFecha === "hoy"
                                    ? "Sin resultados para este filtro."
                                    : "No hay registros en el historial."}
                            </div>
                        ) : (
                            historialFiltrado.map((o, i) => {
                                const badge = ESTADO_BADGE[o.estado] || { bg: "#F3F4F6", color: "#374151", label: o.estado };
                                return (
                                    <div key={o.id_orden}
                                        style={{ ...S.tableRow, background: i % 2 === 0 ? "#FFF" : "#F9FAFB" }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#F8FAFC"}
                                        onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#FFF" : "#F9FAFB"}
                                    >
                                        <div style={{ flex: "0 0 130px" }}>
                                            <span style={S.ticketBadge}>{o.numero_ticket || `#${o.id_orden}`}</span>
                                        </div>
                                        <div style={{ flex: 2 }}>
                                            <p style={{ fontWeight: 600, fontSize: "0.875rem", color: DARK, margin: 0 }}>
                                                {o.nombres ? `${o.nombres} ${o.apellidos}` : `Paciente #${o.id_paciente}`}
                                            </p>
                                        </div>
                                        <div style={{ flex: "0 0 95px", fontSize: "0.8rem", color: "#6B7280" }}>
                                            {o.cedula || "—"}
                                        </div>
                                        <div style={{ flex: 1, fontSize: "0.82rem", color: "#6B7280" }}>
                                            {o.fecha_orden
                                                ? new Date(o.fecha_orden).toLocaleDateString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric" })
                                                : "—"}
                                        </div>
                                        <div style={{ flex: "0 0 130px", display: "flex", justifyContent: "center" }}>
                                            <span style={{
                                                background: badge.bg, color: badge.color,
                                                padding: "0.2rem 0.65rem", borderRadius: "6px",
                                                fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700,
                                                letterSpacing: "0.04em", whiteSpace: "nowrap",
                                            }}>
                                                {badge.label}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* ══ MODAL — DETALLE ORDEN ══ */}
            {showDetalle && (
                <Overlay onClose={() => setShowDetalle(null)}>
                    <ModalHeader title="DETALLE" titleOrange="ORDEN"
                        subtitle={showDetalle.numero_ticket || `Orden #${showDetalle.id_orden}`}
                        onClose={() => setShowDetalle(null)} />
                    <div style={S.modalBody}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
                            <DetalleItem label="Ticket"   value={showDetalle.numero_ticket || `#${showDetalle.id_orden}`} />
                            <DetalleItem label="Estado"   value="Pagada" />
                            <DetalleItem label="Paciente" value={showDetalle.nombres ? `${showDetalle.nombres} ${showDetalle.apellidos}` : `#${showDetalle.id_paciente}`} />
                            <DetalleItem label="Total"    value={`$${parseFloat(showDetalle.total || 0).toFixed(2)}`} />
                            <DetalleItem label="Fecha"    value={showDetalle.fecha_orden ? new Date(showDetalle.fecha_orden).toLocaleString("es-EC") : "—"} />
                            <DetalleItem label="Cédula"   value={showDetalle.cedula || "—"} />
                        </div>
                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button onClick={() => { setShowDetalle(null); abrirToma(showDetalle); }} style={{ ...S.btnFull, flex: 1 }}>
                                🧪 REGISTRAR MUESTRA
                            </button>
                            <button onClick={() => setShowDetalle(null)} style={S.btnCancel}>Cerrar</button>
                        </div>
                    </div>
                </Overlay>
            )}

            {/* ══ MODAL — FORMULARIO TOMA ══ */}
            {showToma && !resultadoToma && (
                <Overlay onClose={() => !guardando && setShowToma(null)}>
                    <ModalHeader
                        title="REGISTRAR" titleOrange="MUESTRA"
                        subtitle={`Orden: ${showToma.numero_ticket || `#${showToma.id_orden}`}`}
                        onClose={() => !guardando && setShowToma(null)}
                    />
                    <div style={S.modalBody}>

                        {/* Paciente + código */}
                        <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1.25rem", border: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <p style={{ fontFamily: FONTC, fontSize: "0.68rem", color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.15rem" }}>Paciente</p>
                                <p style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: DARK, margin: 0 }}>
                                    {showToma.nombres ? `${showToma.nombres} ${showToma.apellidos}` : `#${showToma.id_paciente}`}
                                </p>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <p style={{ fontFamily: FONTC, fontSize: "0.65rem", color: "#9CA3AF", textTransform: "uppercase", margin: "0 0 0.15rem" }}>Código del recipiente</p>
                                <span style={{ ...S.ticketBadge, fontSize: "0.95rem", background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
                                    ✏️ {showToma.numero_ticket || `#${showToma.id_orden}`}
                                </span>
                            </div>
                        </div>

                        {/* ── RECIPIENTES DETECTADOS POR CATEGORÍA ── */}
                        <div style={{ marginBottom: "1.25rem" }}>
                            <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.6rem" }}>
                                🧪 INSUMOS REQUERIDOS
                            </p>

                            {loadingInsumos ? (
                                <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "1.25rem", textAlign: "center", color: "#9CA3AF", fontSize: "0.82rem" }}>
                                    Detectando recipientes desde inventario...
                                </div>
                            ) : categorias.length === 0 && recipientes.length === 0 ? (
                                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "0.85rem 1rem" }}>
                                    <p style={{ fontFamily: FONT, fontSize: "0.82rem", color: "#DC2626", margin: 0 }}>
                                        ⚠️ Esta orden no tiene insumos vinculados. Configura las recetas en Inventario antes de registrar la muestra.
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                                    {categorias.map((cat, ci) => (
                                        <div key={ci} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
                                            {/* Cabecera de categoría */}
                                            <div style={{ background: "#1F2937", padding: "0.55rem 0.9rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                                    <span style={{ fontSize: "1rem" }}>{iconoCategoria(cat.nombre)}</span>
                                                    <span style={{ fontFamily: FONTC, fontSize: "0.78rem", fontWeight: 700, color: "#FFF", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                                                        {cat.nombre}
                                                    </span>
                                                </div>
                                                <span style={{ fontFamily: FONT, fontSize: "0.7rem", color: "#94A3B8" }}>
                                                    {cat.examenes.join(" · ")}
                                                </span>
                                            </div>

                                            {/* Recipientes de esta categoría */}
                                            <div style={{ padding: "0.5rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.4rem", background: "#FAFAFA" }}>
                                                {cat.recipientes.map((rec, ri) => (
                                                    <div key={ri} style={{ display: "flex", alignItems: "center", gap: "0.65rem", background: "#FFF", borderRadius: "8px", padding: "0.55rem 0.85rem", border: "1px solid #F1F5F9" }}>
                                                        {/* Indicador de color del tubo */}
                                                        <div style={{
                                                            width: "8px", height: "30px", borderRadius: "2px", flexShrink: 0,
                                                            background: getColorTubo(rec.tipo_recipiente),
                                                            border: "1px solid rgba(0,0,0,0.12)",
                                                        }} />
                                                        <div style={{ flex: 1 }}>
                                                            <p style={{ fontFamily: FONT, fontSize: "0.85rem", fontWeight: 700, color: DARK, margin: 0 }}>
                                                                {rec.tipo_recipiente}
                                                            </p>
                                                        </div>
                                                        {/* Badge de auto-detectado */}
                                                        <span style={{ fontFamily: FONTC, fontSize: "0.62rem", background: "#D1FAE5", color: "#065F46", padding: "0.15rem 0.5rem", borderRadius: "4px", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                            ✓ Auto
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── INSUMOS QUE SE DESCONTARÁN ── */}
                        {insumosPrevios && insumosPrevios.length > 0 && (
                            <div style={{ marginBottom: "1.25rem" }}>
                                <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
                                    🧴 INSUMOS QUE SE DESCONTARÁN DEL INVENTARIO
                                </p>
                                <div style={{ background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E5E7EB", overflow: "hidden" }}>
                                    <div style={{ display: "flex", background: "#1F2937", padding: "0.45rem 0.85rem" }}>
                                        <span style={{ flex: 2, ...S.thTxt }}>INSUMO</span>
                                        <span style={{ flex: 2, ...S.thTxt }}>EXAMEN</span>
                                        <span style={{ flex: "0 0 90px", textAlign: "right", ...S.thTxt }}>CANTIDAD</span>
                                        <span style={{ flex: "0 0 80px", textAlign: "right", ...S.thTxt }}>STOCK</span>
                                    </div>
                                    {insumosPrevios.map((ins, i) => {
                                        const stockResultante = ins.stock_actual - ins.cantidad;
                                        const stockBajo = stockResultante <= ins.stock_minimo;
                                        return (
                                            <div key={i} style={{
                                                display: "flex", alignItems: "center", padding: "0.55rem 0.85rem",
                                                borderBottom: i < insumosPrevios.length - 1 ? "1px solid #F1F5F9" : "none",
                                                background: stockBajo ? "#FFFBEB" : (i % 2 === 0 ? "#FFF" : "#F9FAFB"),
                                            }}>
                                                <div style={{ flex: 2 }}>
                                                    <p style={{ fontFamily: FONT, fontSize: "0.82rem", fontWeight: 600, color: DARK, margin: 0 }}>{ins.insumo}</p>
                                                    <p style={{ fontFamily: FONT, fontSize: "0.7rem", color: "#9CA3AF", margin: 0 }}>{ins.unidad_medida}</p>
                                                </div>
                                                <div style={{ flex: 2 }}>
                                                    <p style={{ fontFamily: FONT, fontSize: "0.78rem", color: "#6B7280", margin: 0 }}>{ins.examenes}</p>
                                                </div>
                                                <div style={{ flex: "0 0 90px", textAlign: "right" }}>
                                                    <span style={{ fontFamily: FONTC, fontSize: "0.9rem", fontWeight: 800, color: "#DC2626" }}>-{ins.cantidad}</span>
                                                </div>
                                                <div style={{ flex: "0 0 80px", textAlign: "right" }}>
                                                    {stockBajo ? (
                                                        <span style={{ background: "#FEF3C7", color: "#92400E", padding: "0.15rem 0.45rem", borderRadius: "5px", fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700 }}>
                                                            ⚠️ {stockResultante}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontFamily: FONTC, fontSize: "0.82rem", fontWeight: 700, color: "#374151" }}>{stockResultante}</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {msg && <Alert msg={msg} />}

                        <div style={{ display: "flex", gap: "0.75rem" }}>
                            <button
                                onClick={handleRegistrarToma}
                                disabled={guardando || recipientes.length === 0}
                                style={{ ...S.btnFull, flex: 1, opacity: (guardando || recipientes.length === 0) ? 0.6 : 1 }}
                            >
                                {guardando ? "Registrando..." : `✅ CONFIRMAR TOMA (${recipientes.length} recipiente${recipientes.length !== 1 ? "s" : ""})`}
                            </button>
                            <button onClick={() => setShowToma(null)} disabled={guardando} style={S.btnCancel}>Cancelar</button>
                        </div>
                    </div>
                </Overlay>
            )}

            {/* ══ MODAL — RESULTADO ══ */}
            {showToma && resultadoToma && (
                <Overlay onClose={() => { setShowToma(null); setResultadoToma(null); }}>
                    <ModalHeader title="MUESTRA" titleOrange="EN PROCESO"
                        subtitle="Orden actualizada — inventario descontado automáticamente"
                        onClose={() => { setShowToma(null); setResultadoToma(null); }} />
                    <div style={S.modalBody}>

                        {/* Código a escribir */}
                        <div style={{ textAlign: "center", padding: "1.5rem", background: "#F0FDF4", borderRadius: "12px", border: "2px dashed #86EFAC", marginBottom: "1.25rem" }}>
                            <p style={{ fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700, color: "#16A34A", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
                                ✓ CÓDIGO DEL RECIPIENTE
                            </p>
                            <p style={{ fontFamily: "'Courier New', monospace", fontSize: "2.5rem", fontWeight: 800, color: DARK, margin: "0 0 0.5rem", letterSpacing: "0.08em" }}>
                                {resultadoToma.codigo_a_escribir}
                            </p>
                            <p style={{ fontFamily: FONT, fontSize: "0.8rem", color: "#16A34A", margin: 0 }}>
                                ✏️ Escríbelo en <strong>cada recipiente</strong> con marcador permanente
                            </p>
                        </div>

                        {/* Lista de muestras registradas */}
                        {resultadoToma.muestras_registradas?.length > 0 && (
                            <div style={{ marginBottom: "1.25rem" }}>
                                <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
                                    🧪 INSUMOS REGISTRADOS ({resultadoToma.muestras_registradas.length})
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                                    {resultadoToma.muestras_registradas.map((m, i) => (
                                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "#F8FAFC", borderRadius: "8px", padding: "0.5rem 0.75rem", border: "1px solid #E5E7EB" }}>
                                            <div style={{ width: "10px", height: "22px", borderRadius: "2px", background: getColorTubo(m.tipo_recipiente), flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
                                            <div style={{ flex: 1 }}>
                                                <p style={{ fontFamily: FONT, fontSize: "0.82rem", fontWeight: 700, color: DARK, margin: 0 }}>{m.tipo_recipiente}</p>
                                            </div>
                                            <span style={{ fontFamily: FONTC, fontSize: "0.65rem", background: "#D1FAE5", color: "#065F46", padding: "0.15rem 0.45rem", borderRadius: "4px", fontWeight: 700 }}>✓ Registrado</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Insumos descontados */}
                        {resultadoToma.insumos_descontados?.length > 0 && (
                            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem" }}>
                                <p style={{ fontFamily: FONTC, fontSize: "0.65rem", fontWeight: 700, color: "#92400E", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.4rem" }}>
                                    Insumos descontados del inventario
                                </p>
                                {resultadoToma.insumos_descontados.map((ins, i) => (
                                    <p key={i} style={{ fontFamily: FONT, fontSize: "0.8rem", color: "#92400E", margin: "0.15rem 0 0" }}>
                                        • {ins.nombre}: -{ins.cantidad} {ins.unidad_medida}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "0.75rem 1rem", marginBottom: "1.25rem" }}>
                            <p style={{ fontFamily: FONT, fontSize: "0.82rem", color: "#92400E", margin: 0 }}>
                                {resultadoToma.instruccion}
                            </p>
                        </div>

                        <button onClick={() => { setShowToma(null); setResultadoToma(null); }} style={S.btnFull}>
                            ✓ LISTO — CONTINUAR
                        </button>
                    </div>
                </Overlay>
            )}
        </div>
    );
}

// ─── SUB-COMPONENTES ──────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
    return (
        <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div style={{ background: "#FFF", borderRadius: "16px", width: "100%", maxWidth: "580px", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
                <div style={{ overflowY: "auto", flex: 1 }}>{children}</div>
            </div>
        </div>
    );
}

function ModalHeader({ title, titleOrange, subtitle, onClose }) {
    return (
        <div style={{ background: "#1F2937", padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.35rem", color: "#FFF", margin: 0, textTransform: "uppercase" }}>
                    {title} <span style={{ color: "#E88B3A" }}>{titleOrange}</span>
                </h3>
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#94A3B8", margin: "0.2rem 0 0" }}>{subtitle}</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>
    );
}

function Alert({ msg }) {
    return (
        <div style={{
            padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem",
            background: msg.type === "error" ? "#FEF2F2" : "#F0FDF4",
            color:      msg.type === "error" ? "#DC2626"  : "#16A34A",
            border:    `1px solid ${msg.type === "error" ? "#FECACA" : "#BBF7D0"}`,
            fontSize: "0.85rem", fontFamily: "'Barlow', sans-serif",
        }}>
            {msg.text}
        </div>
    );
}

function DetalleItem({ label, value }) {
    return (
        <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "0.65rem 0.85rem" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.2rem" }}>{label}</p>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.875rem", fontWeight: 600, color: "#1F2937", margin: 0 }}>{value || "—"}</p>
        </div>
    );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const S = {
    btnRefresh:  { background: "rgba(232,139,58,0.1)", border: "1px solid rgba(232,139,58,0.25)", color: "#E88B3A", padding: "0.5rem 1.1rem", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer" },
    tabBtn:      { border: "none", borderRadius: "7px", padding: "0.45rem 1rem", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem", letterSpacing: "0.03em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" },
    searchWrap:  { display: "flex", alignItems: "center", gap: "0.6rem", background: "#FFF", border: "1.5px solid #E5E7EB", borderRadius: "8px", padding: "0.6rem 1rem" },
    searchInput: { flex: 1, border: "none", outline: "none", fontFamily: "'Barlow', sans-serif", fontSize: "0.875rem", background: "transparent" },
    tableCard:   { background: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
    tableHead:   { display: "flex", alignItems: "center", padding: "0.75rem 1.25rem", background: "#1F2937", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" },
    tableRow:    { display: "flex", alignItems: "center", padding: "0.85rem 1.25rem", borderBottom: "1px solid #F3F4F6", transition: "background 0.15s" },
    empty:       { textAlign: "center", padding: "3rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif", fontSize: "0.875rem" },
    ticketBadge: { background: "#F1F5F9", color: "#374151", padding: "0.2rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: "0.04em" },
    btnVer:      { background: "rgba(232,139,58,0.1)", border: "1px solid rgba(232,139,58,0.25)", borderRadius: "6px", width: "30px", height: "30px", cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#E88B3A" },
    btnTomar:    { background: "#059669", border: "none", borderRadius: "7px", padding: "0.35rem 0.7rem", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.75rem", color: "#FFF", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.25rem" },
    btnFull:     { width: "100%", padding: "0.75rem", background: "#1F2937", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase" },
    btnCancel:   { padding: "0.75rem 1.25rem", background: "#F1F5F9", color: "#374151", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", whiteSpace: "nowrap" },
    modalBody:   { padding: "1.5rem" },
    label:       { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "#6B7280", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" },
    input:       { padding: "0.65rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "#1F2937", background: "#FAFAFA", outline: "none", boxSizing: "border-box" },
    thTxt:       { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.62rem", color: "#94A3B8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" },
};