import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt      = (n) => Number(n || 0).toLocaleString("es-EC");
const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;
const MESES    = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const PAGE_SIZE = 8;

// ─── MODAL BASE ───────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, children, wide, extraWide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const maxW = extraWide ? "960px" : wide ? "780px" : "560px";
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...modalBox, maxWidth: maxW }} onClick={(e) => e.stopPropagation()}>
        <div style={modalHead}>
          <div>
            <h3 style={modalTitle}>{title}</h3>
            {subtitle && <p style={modalSub}>{subtitle}</p>}
          </div>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "1.25rem 1.5rem 1.5rem", overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── BUSCADOR ─────────────────────────────────────────────────────────────────
function SearchBox({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Buscar…"}
      style={searchInput}
    />
  );
}

// ─── KPI CARD ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent, onClick }) {
  return (
    <div
      style={{ ...kpiCard, cursor: onClick ? "pointer" : "default", transition: "box-shadow 0.15s, transform 0.15s" }}
      onClick={onClick}
      onMouseEnter={(e) => { if (onClick) { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
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
      {onClick && <p style={{ margin: "0.6rem 0 0", fontSize: "0.68rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>Ver detalle →</p>}
    </div>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ estado }) {
  const map = {
    Validado:      { bg: "#D1FAE5", color: "#065F46" },
    "Por Validar": { bg: "#FEF3C7", color: "#92400E" },
    "En Proceso":  { bg: "#DBEAFE", color: "#1E40AF" },
    Generada:      { bg: "#F3F4F6", color: "#374151" },
    Devuelto:      { bg: "#FEE2E2", color: "#991B1B" },
  };
  const s = map[estado] || { bg: "#F3F4F6", color: "#374151" };
  return <span style={{ ...badgeBase, background: s.bg, color: s.color }}>{estado}</span>;
}

// ─── MINI BAR CHART (SVG, sin dependencias) ──────────────────────────────────
function BarChart({ items, colorFn }) {
  if (!items || items.length === 0) return null;
  const W = 520, H = 130, PAD = { top: 10, right: 10, bot: 36, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bot;
  const maxVal = Math.max(...items.map((d) => d.value), 1);
  const barW   = Math.max(12, Math.floor(innerW / items.length) - 6);
  const step   = innerW / items.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
      {/* grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = PAD.top + innerH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#F1F5F9" strokeWidth="1" />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">
              {frac === 0 ? "0" : Math.round(maxVal * frac)}
            </text>
          </g>
        );
      })}
      {/* bars */}
      {items.map((d, i) => {
        const barH  = Math.max(2, (d.value / maxVal) * innerH);
        const cx    = PAD.left + step * i + step / 2;
        const x     = cx - barW / 2;
        const y     = PAD.top + innerH - barH;
        const color = colorFn ? colorFn(d, i) : "#E88B3A";
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="3" fill={color} opacity="0.88" />
            {barH > 18 && (
              <text x={cx} y={y + barH / 2 + 4} textAnchor="middle" fontSize="9" fill="#FFF" fontWeight="700">
                {d.value}
              </text>
            )}
            <text
              x={cx} y={H - PAD.bot + 14}
              textAnchor="middle" fontSize="9" fill="#6B7280"
              style={{ fontFamily: "'Barlow', sans-serif" }}
            >
              {d.label.length > 8 ? d.label.slice(0, 8) + "…" : d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── DONUT CHART (SVG, sin dependencias) ─────────────────────────────────────
function DonutChart({ slices, size = 160 }) {
  const cx = size / 2, cy = size / 2, R = size * 0.38, r = size * 0.22;
  let angle = -Math.PI / 2;
  const total = slices.reduce((s, sl) => s + sl.value, 0) || 1;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: "block" }}>
      {slices.map((sl, i) => {
        const sweep = (sl.value / total) * 2 * Math.PI;
        const x1 = cx + R * Math.cos(angle), y1 = cy + R * Math.sin(angle);
        const x2 = cx + R * Math.cos(angle + sweep), y2 = cy + R * Math.sin(angle + sweep);
        const xi1 = cx + r * Math.cos(angle), yi1 = cy + r * Math.sin(angle);
        const xi2 = cx + r * Math.cos(angle + sweep), yi2 = cy + r * Math.sin(angle + sweep);
        const large = sweep > Math.PI ? 1 : 0;
        const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z`;
        angle += sweep;
        return <path key={i} d={d} fill={sl.color} opacity="0.88" />;
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.12} fontWeight="800" fill="#1F2937" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{total}</text>
      <text x={cx} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.07} fill="#9CA3AF" style={{ fontFamily: "'Barlow', sans-serif" }}>órdenes</text>
    </svg>
  );
}

// ─── SECCIÓN DE GRÁFICOS ──────────────────────────────────────────────────────
function ChartsSection({ kpis: k, ordenes, alertas }) {
  // Distribución de estados de órdenes
  const estadosSlices = [
    { label: "Por Validar", value: Number(k.pen_val || 0),     color: "#F59E0B" },
    { label: "Completados", value: Number(k.completados || 0), color: "#10B981" },
    { label: "En Proceso",  value: Math.max(0, Number(k.ord_hoy || 0) - Number(k.pen_val || 0) - Number(k.completados || 0)), color: "#3B82F6" },
  ].filter(s => s.value > 0);

  // Top insumos con stock bajo para el mini chart
  const topInsumos = alertas.slice(0, 6);
  const maxStock = Math.max(...topInsumos.map(a => a.stock_minimo), 1);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>

      {/* ── Distribución de órdenes ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>📊 Estado de Órdenes</span>
          <span style={{ fontSize: "0.72rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>Total hoy</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <DonutChart slices={estadosSlices.length > 0 ? estadosSlices : [{ value: 1, color: "#F1F5F9" }]} size={140} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {[
              { label: "Por Validar", value: k.pen_val,     color: "#F59E0B" },
              { label: "Completados", value: k.completados, color: "#10B981" },
              { label: "Órdenes Hoy", value: k.ord_hoy,     color: "#3B82F6" },
              { label: "Críticos",    value: k.criticos,    color: "#EF4444" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "0.75rem", color: "#6B7280", fontFamily: "'Barlow', sans-serif" }}>{item.label}</span>
                </div>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1F2937", fontFamily: "'Barlow Condensed', sans-serif" }}>{Number(item.value || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stock crítico visual ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardTitle}>📦 Insumos Críticos</span>
          <span style={{ fontSize: "0.72rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>{alertas.length} bajo mínimo</span>
        </div>
        {alertas.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 0", gap: "0.4rem" }}>
            <span style={{ fontSize: "2rem" }}>✅</span>
            <p style={{ ...emptyTxt, padding: 0 }}>Todos los insumos tienen stock suficiente</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.25rem" }}>
            {topInsumos.map((a, i) => {
              const pct = Math.min(100, Math.round((a.stock_actual / a.stock_minimo) * 100));
              const color = pct <= 50 ? "#EF4444" : pct <= 80 ? "#F59E0B" : "#10B981";
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#374151", fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>{a.insumo}</span>
                    <span style={{ fontSize: "0.72rem", color, fontFamily: "'Barlow', sans-serif", fontWeight: 700 }}>{a.stock_actual}/{a.stock_minimo} {a.unidad_medida}</span>
                  </div>
                  <div style={{ height: 7, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── MODAL: STOCK BAJO ────────────────────────────────────────────────────────
function ModalStockBajo({ open, onClose, alertas, onVerInventario }) {
  const [q, setQ] = useState("");
  const filtrado = alertas.filter((a) => {
    const term = q.toLowerCase();
    return !term || a.insumo?.toLowerCase().includes(term) || a.categoria?.toLowerCase().includes(term);
  });

  return (
    <Modal open={open} onClose={onClose} title="📦 Insumos con Stock Bajo" subtitle={`${alertas.length} insumo${alertas.length !== 1 ? "s" : ""} por debajo del mínimo requerido`} wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar insumo o categoría…" />
      {filtrado.length === 0 ? <p style={emptyTxt}>No hay insumos con stock bajo</p> : (
        <>
          <table style={tbl}>
            <thead>
              <tr>{["Insumo","Categoría","Stock Actual","Mínimo Req.","Faltante","Nivel"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtrado.map((a, i) => {
                const pct   = Math.min(100, Math.round((a.stock_actual / a.stock_minimo) * 100));
                const color = pct <= 50 ? "#EF4444" : "#F59E0B";
                const falta = a.stock_minimo - a.stock_actual;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFF" : "#FFFBEB" }}>
                    <td style={td}><strong style={{ color: "#1F2937" }}>{a.insumo}</strong></td>
                    <td style={{ ...td, color: "#9CA3AF" }}>{a.categoria || "—"}</td>
                    <td style={td}><span style={{ color, fontWeight: 700 }}>{a.stock_actual} {a.unidad_medida}</span></td>
                    <td style={{ ...td, color: "#9CA3AF" }}>{a.stock_minimo} {a.unidad_medida}</td>
                    <td style={td}>
                      <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.15rem 0.6rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700 }}>
                        +{falta} {a.unidad_medida}
                      </span>
                    </td>
                    <td style={{ ...td, minWidth: 90 }}>
                      <div style={{ height: 7, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: "0.68rem", color, fontWeight: 700 }}>{pct}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: "1rem", textAlign: "right" }}>
            <button
              style={{ background: "#E88B3A", color: "#FFF", border: "none", borderRadius: "8px", padding: "0.5rem 1.2rem", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
              onClick={() => { onClose(); onVerInventario(); }}
            >
              Ir a Inventario →
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}


function ModalUsuarios({ open, onClose }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [q, setQ]               = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    API.get("/dashboard/usuarios-activos-hoy")
      .then((r) => setUsuarios(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUsuarios([]))
      .finally(() => setLoading(false));
  }, [open]);

  const lista = usuarios.filter((u) => {
    const term = q.toLowerCase();
    return !term || u.nombres?.toLowerCase().includes(term) || u.apellidos?.toLowerCase().includes(term) || u.username?.toLowerCase().includes(term) || u.rol?.toLowerCase().includes(term);
  });

  return (
    <Modal open={open} onClose={onClose} title="👥 Usuarios Activos Hoy" subtitle={`${usuarios.length} usuarios han iniciado sesión hoy`} wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre, usuario o rol…" />
      {loading ? <p style={loadingTxt}>Cargando…</p> : lista.length === 0 ? <p style={emptyTxt}>No se encontraron usuarios</p> : (
        <table style={tbl}>
          <thead><tr>{["Nombre","Usuario","Rol","Último acceso"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {lista.map((u, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 ? "#FAFAFA" : "#FFF" }}>
                <td style={td}><strong>{u.nombres} {u.apellidos}</strong></td>
                <td style={td}><code style={{ background: "#F1F5F9", padding: "0.1rem 0.4rem", borderRadius: "4px", fontSize: "0.78rem" }}>{u.username}</code></td>
                <td style={td}><Badge estado={u.rol} /></td>
                <td style={{ ...td, color: "#9CA3AF" }}>{u.ultimo_acceso ? new Date(u.ultimo_acceso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

// ─── MODAL: ÓRDENES DEL DÍA — con scroll + paginado por usuario ──────────────
function ModalOrdenes({ open, onClose }) {
  const [grupos, setGrupos]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [q, setQ]               = useState("");
  const [expandido, setExpandido] = useState(null);
  const [paginas, setPaginas]   = useState({});   // { username: pageIndex }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setPaginas({});
    setExpandido(null);
    API.get("/dashboard/ordenes-por-usuario")
      .then((r) => setGrupos(Array.isArray(r.data) ? r.data : []))
      .catch(() => setGrupos([]))
      .finally(() => setLoading(false));
  }, [open]);

  const gruposFiltrados = grupos.map((g) => ({
    ...g,
    ordenes: g.ordenes.filter((o) => {
      const term = q.toLowerCase();
      return !term || o.numero_ticket?.toLowerCase().includes(term) || o.estado?.toLowerCase().includes(term) || o.paciente?.toLowerCase().includes(term);
    }),
  })).filter((g) => g.ordenes.length > 0 || !q);

  const getPage    = (key) => paginas[key] || 0;
  const setPage    = (key, p) => setPaginas((prev) => ({ ...prev, [key]: p }));

  return (
    <Modal open={open} onClose={onClose} title="📋 Órdenes del Día — Por Usuario" subtitle="Desglose de órdenes generadas por cada asistente" wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar ticket, estado o paciente…" />
      {loading ? <p style={loadingTxt}>Cargando…</p> : gruposFiltrados.length === 0 ? <p style={emptyTxt}>Sin órdenes registradas hoy</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
          {gruposFiltrados.map((g, gi) => {
            const key    = g.username || `g${gi}`;
            const page   = getPage(key);
            const total  = g.ordenes.length;
            const pages  = Math.ceil(total / PAGE_SIZE);
            const slice  = g.ordenes.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
            const isOpen = expandido === gi;
            const subtotal = g.ordenes.reduce((s, o) => s + Number(o.total || 0), 0);

            return (
              <div key={gi} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
                {/* cabecera del grupo */}
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "#F8FAFC", cursor: "pointer" }}
                  onClick={() => setExpandido(isOpen ? null : gi)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#E88B3A18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>👤</div>
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "#1F2937", fontFamily: "'Barlow', sans-serif" }}>{g.usuario}</p>
                      <p style={{ margin: 0, fontSize: "0.72rem", color: "#10B981", fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
                        {fmtMoney(subtotal)} recaudado
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ background: "#E88B3A", color: "#FFF", borderRadius: "20px", padding: "0.2rem 0.7rem", fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
                      {total} orden{total !== 1 ? "es" : ""}
                    </span>
                    <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* tabla con scroll + paginado */}
                {isOpen && (
                  <div>
                    <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                      <table style={{ ...tbl, margin: 0, borderRadius: 0 }}>
                        <thead style={{ position: "sticky", top: 0, background: "#FFF", zIndex: 1 }}>
                          <tr>{["Ticket","Paciente","Estado","Monto"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {slice.map((o, oi) => (
                            <tr key={oi} style={{ borderBottom: "1px solid #F1F5F9", background: oi % 2 ? "#FAFAFA" : "#FFF" }}>
                              <td style={td}><span style={ticketStyle}>{o.numero_ticket}</span></td>
                              <td style={td}>{o.paciente || "—"}</td>
                              <td style={td}><Badge estado={o.estado} /></td>
                              <td style={td}>{fmtMoney(o.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} style={{ ...td, fontWeight: 700, textAlign: "right", color: "#374151" }}>Subtotal:</td>
                            <td style={{ ...td, fontWeight: 700, color: "#10B981" }}>{fmtMoney(subtotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    {/* paginado */}
                    {pages > 1 && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderTop: "1px solid #F1F5F9", background: "#FAFAFA" }}>
                        <button style={pgBtn} disabled={page === 0} onClick={() => setPage(key, page - 1)}>‹ Ant</button>
                        <span style={{ fontSize: "0.75rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>
                          Página {page + 1} de {pages}
                        </span>
                        <button style={pgBtn} disabled={page >= pages - 1} onClick={() => setPage(key, page + 1)}>Sig ›</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── MODAL: INGRESOS / ARQUEO — con filtro de fechas ─────────────────────────
function ModalIngresos({ open, onClose }) {
  const hoyISO  = new Date().toISOString().split("T")[0];
  const [desde, setDesde]     = useState(hoyISO);
  const [hasta, setHasta]     = useState(hoyISO);
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const cargar = useCallback(() => {
    if (!desde || !hasta) return;
    setLoading(true);
    setError(null);
    Promise.all([
      API.get(`/dashboard/arqueo-hoy?desde=${desde}&hasta=${hasta}`),
      API.get(`/dashboard/ingresos-por-usuario?desde=${desde}&hasta=${hasta}`),
    ])
      .then(([arqueoRes, usuariosRes]) =>
        setData({
          arqueo:     arqueoRes.data,
          porUsuario: Array.isArray(usuariosRes.data) ? usuariosRes.data : [],
        })
      )
      .catch(() => setError("No se pudo cargar la información."))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  useEffect(() => { if (open) cargar(); }, [open, cargar]);

  const totalRecaudado = data
    ? Number(data.arqueo?.efectivo || 0) + Number(data.arqueo?.transferencia || 0) 
    : 0;

  const chartData = data?.porUsuario.map((u) => ({
    label: (u.usuario || "—").split(" ")[0],
    value: Number(u.total_generado || 0),
  })) || [];

  return (
    <Modal open={open} onClose={onClose} title="💵 Ingresos — Arqueo de Caja" subtitle="Filtra por rango de fechas para consultar la recaudación" wide>
      {/* ── Filtros de fecha ── */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginBottom: "1rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ ...sectionLabel, marginBottom: "0.25rem" }}>Desde</p>
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} style={dateInput} />
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: "0.25rem" }}>Hasta</p>
          <input type="date" value={hasta} min={desde} max={hoyISO} onChange={(e) => setHasta(e.target.value)} style={dateInput} />
        </div>
        <button
          onClick={cargar}
          style={{ padding: "0.48rem 1rem", background: "#E88B3A", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          🔍 Consultar
        </button>
        {desde !== hoyISO || hasta !== hoyISO ? (
          <button onClick={() => { setDesde(hoyISO); setHasta(hoyISO); }} style={{ padding: "0.48rem 0.8rem", background: "#F1F5F9", color: "#374151", border: "1px solid #E2E8F0", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", cursor: "pointer" }}>
            Hoy
          </button>
        ) : null}
      </div>

      {loading ? <p style={loadingTxt}>Cargando…</p> : error ? <p style={{ ...emptyTxt, color: "#EF4444" }}>{error}</p> : !data ? null : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* ── Tarjetas de método de pago ── */}
          {/* ── Tarjetas de método de pago ── */}
<div>
  <p style={sectionLabel}>📊 Desglose por Método de Pago</p>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
    {[
      { label: "Efectivo",       value: data.arqueo?.efectivo,       color: "#10B981", icon: "💵" },
      { label: "Transferencia",  value: data.arqueo?.transferencia,  color: "#3B82F6", icon: "🏦" },
    ].map((m) => (
      <div key={m.label} style={{ background: `${m.color}10`, border: `1px solid ${m.color}30`, borderRadius: "10px", padding: "0.9rem 1rem" }}>
        <p style={{ margin: "0 0 0.25rem", fontSize: "0.7rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.icon} {m.label}</p>
        <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.4rem", color: m.color }}>{fmtMoney(m.value)}</p>
      </div>
    ))}
  </div>

  {/* ── NUEVO: Reembolsos del período ── */}
  {(Number(data.arqueo?.reembolsos_efectivo) > 0 || Number(data.arqueo?.reembolsos_transferencia) > 0) && (
    <div style={{ marginTop: "0.75rem", padding: "0.7rem 1rem", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: "10px" }}>
      <p style={{ margin: "0 0 0.4rem", fontSize: "0.7rem", color: "#991B1B", fontFamily: "'Barlow', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
        ↩️ Reembolsos del período
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontFamily: "'Barlow', sans-serif" }}>
        <span style={{ color: "#7F1D1D" }}>💵 Efectivo: <strong>{fmtMoney(data.arqueo?.reembolsos_efectivo)}</strong></span>
        <span style={{ color: "#7F1D1D" }}>🏦 Transferencia: <strong>{fmtMoney(data.arqueo?.reembolsos_transferencia)}</strong></span>
      </div>
    </div>
  )}

  <div style={{ marginTop: "0.6rem", padding: "0.6rem 1rem", background: "#1F2937", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <span style={{ color: "#E5E7EB", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", fontWeight: 600 }}>Total recaudado (neto)</span>
    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.3rem", color: "#10B981" }}>{fmtMoney(totalRecaudado)}</span>
  </div>
</div>

          {/* ── Desglose por usuario ── */}
          {data.porUsuario.length > 0 && (
            <div>
              <p style={sectionLabel}>👤 Desglose por Asistente</p>
              {/* mini gráfico */}
              {chartData.length > 0 && (
                <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "0.75rem 0.5rem 0.25rem", marginBottom: "0.75rem" }}>
                  <BarChart items={chartData} colorFn={(_, i) => ["#E88B3A","#3B82F6","#10B981","#8B5CF6","#F59E0B","#EF4444"][i % 6]} />
                </div>
              )}
              <table style={tbl}>
  <thead>
    <tr>{["Asistente","Órdenes","Total Generado","Reembolsado"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
  </thead>
  <tbody>
    {data.porUsuario.map((u, i) => (
      <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 ? "#FAFAFA" : "#FFF" }}>
        <td style={td}><strong>{u.usuario}</strong></td>
        <td style={{ ...td, textAlign: "center" }}>
          <span style={{ background: "#E88B3A18", color: "#E88B3A", padding: "0.15rem 0.6rem", borderRadius: "20px", fontWeight: 700, fontSize: "0.78rem" }}>
            {u.total_ordenes}
          </span>
        </td>
        <td style={{ ...td, fontWeight: 700, color: "#10B981" }}>{fmtMoney(u.total_generado)}</td>
        <td style={{ ...td, color: u.total_reembolsado > 0 ? "#EF4444" : "#9CA3AF" }}>
          {u.total_reembolsado > 0 ? fmtMoney(u.total_reembolsado) : "—"}
        </td>
      </tr>
    ))}
  </tbody>
</table>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── MODAL: PACIENTES REGISTRADOS — con filtro de fechas ────────────────────
function ModalPacientes({ open, onClose }) {
  const hoyISO = new Date().toISOString().split("T")[0];
  const [desde, setDesde]     = useState("");   // vacío = sin límite inferior
  const [hasta, setHasta]     = useState("");   // vacío = sin límite superior
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [q, setQ]             = useState("");

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "100" });
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    API.get(`/pacientes?${params.toString()}`)
      .then((r) => setLista(Array.isArray(r.data) ? r.data : (r.data?.pacientes || [])))
      .catch(() => setError("No se pudo cargar la lista de pacientes."))
      .finally(() => setLoading(false));
  }, [desde, hasta]);

  useEffect(() => { if (open) cargar(); }, [open, cargar]);

  const filtrado = lista.filter((p) => {
    const term = q.toLowerCase();
    return !term || `${p.nombres} ${p.apellidos}`.toLowerCase().includes(term) || p.cedula?.includes(term);
  });

  const hayFiltro = desde || hasta;

  return (
    <Modal open={open} onClose={onClose} title="👤 Pacientes Registrados" subtitle={`${lista.length} pacientes${hayFiltro ? " en el rango seleccionado" : " en el sistema"}`} wide>
      {/* ── Filtros de fecha ── */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", marginBottom: "0.85rem", flexWrap: "wrap" }}>
        <div>
          <p style={{ ...sectionLabel, marginBottom: "0.25rem" }}>Desde</p>
          <input type="date" value={desde} max={hasta || hoyISO} onChange={(e) => setDesde(e.target.value)} style={dateInput} />
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: "0.25rem" }}>Hasta</p>
          <input type="date" value={hasta} min={desde} max={hoyISO} onChange={(e) => setHasta(e.target.value)} style={dateInput} />
        </div>
        <button
          onClick={cargar}
          style={{ padding: "0.48rem 1rem", background: "#E88B3A", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          🔍 Consultar
        </button>
        {hayFiltro ? (
          <button onClick={() => { setDesde(""); setHasta(""); }} style={{ padding: "0.48rem 0.8rem", background: "#F1F5F9", color: "#374151", border: "1px solid #E2E8F0", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", cursor: "pointer" }}>
            Todos
          </button>
        ) : null}
      </div>

      <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre o cédula…" />
      {loading ? <p style={loadingTxt}>Cargando…</p> : error ? <p style={{ ...emptyTxt, color: "#EF4444" }}>{error}</p> : filtrado.length === 0 ? <p style={emptyTxt}>No se encontraron pacientes</p> : (
        <table style={tbl}>
          <thead><tr>{["Nombre","Cédula","Teléfono","Correo"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtrado.slice(0, 50).map((p, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 ? "#FAFAFA" : "#FFF" }}>
                <td style={td}><strong>{p.nombres} {p.apellidos}</strong></td>
                <td style={td}>{p.cedula || "—"}</td>
                <td style={td}>{p.telefono || "—"}</td>
                <td style={{ ...td, color: "#9CA3AF" }}>{p.correo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

// ─── MODAL: RESULTADOS CRÍTICOS ───────────────────────────────────────────────
function ModalCriticos({ open, onClose }) {
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    API.get("/dashboard/resultados-criticos")
      .then((r) => setLista(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtrado = lista.filter((r) => {
    const term = q.toLowerCase();
    return !term || r.paciente?.toLowerCase().includes(term) || r.parametro?.toLowerCase().includes(term);
  });

  return (
    <Modal open={open} onClose={onClose} title="⚠️ Resultados Críticos" subtitle="Valores fuera del rango de referencia" wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por paciente o parámetro…" />
      {loading ? <p style={loadingTxt}>Cargando…</p> : filtrado.length === 0 ? <p style={emptyTxt}>No hay resultados críticos</p> : (
        <table style={tbl}>
          <thead><tr>{["Paciente","Parámetro","Valor","Rango Normal","Estado"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {filtrado.map((r, i) => {
              const alto = Number(r.valor_obtenido) > Number(r.rango_max);
              return (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 ? "#FFF5F5" : "#FFF" }}>
                  <td style={td}><strong>{r.paciente}</strong></td>
                  <td style={td}>{r.parametro}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#EF4444" }}>{r.valor_obtenido} {r.unidad}</td>
                  <td style={{ ...td, color: "#9CA3AF" }}>{r.rango_min} – {r.rango_max} {r.unidad}</td>
                  <td style={td}>
                    <span style={{ background: alto ? "#FEE2E2" : "#FEF3C7", color: alto ? "#991B1B" : "#92400E", padding: "0.15rem 0.6rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700 }}>
                      {alto ? "▲ Alto" : "▼ Bajo"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

// ─── MODAL: POR VALIDAR ───────────────────────────────────────────────────────
function ModalPorValidar({ open, onClose }) {
  const [lista, setLista]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ]             = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    API.get("/ordenes?estado=Por Validar&limit=100")
      .then((r) => setLista(Array.isArray(r.data) ? r.data : (r.data?.ordenes || [])))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtrado = lista.filter((o) => {
    const term = q.toLowerCase();
    return !term || o.numero_ticket?.toLowerCase().includes(term) || o.paciente?.toLowerCase().includes(term);
  });

  return (
    <Modal open={open} onClose={onClose} title="⏳ Órdenes Por Validar" subtitle={`${lista.length} órdenes pendientes de validación`} wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por ticket o paciente…" />
      {loading ? <p style={loadingTxt}>Cargando…</p> : filtrado.length === 0 ? <p style={emptyTxt}>No hay órdenes por validar</p> : (
        <>
          <table style={tbl}>
            <thead><tr>{["Ticket","Paciente","Fecha","Exámenes"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtrado.map((o, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 ? "#FFFBEB" : "#FFF" }}>
                  <td style={td}><span style={ticketStyle}>{o.numero_ticket}</span></td>
                  <td style={td}>{o.paciente || "—"}</td>
                  <td style={{ ...td, color: "#9CA3AF" }}>{o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString("es-EC") : "—"}</td>
                  <td style={td}>{o.total_examenes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: "1rem", textAlign: "right" }}>
            <button
              style={{ background: "#E88B3A", color: "#FFF", border: "none", borderRadius: "8px", padding: "0.5rem 1.2rem", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
              onClick={() => { onClose(); navigate("/admin/resultados"); }}
            >
              Ir a validar resultados →
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── MODAL: REPORTE MENSUAL PDF ───────────────────────────────────────────────
function ModalReportePDF({ open, onClose }) {
  const now   = new Date();
  const [mes,  setMes]  = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [anio, setAnio] = useState(String(now.getFullYear()));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const anios = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  const descargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await API.get(`/dashboard/secretaria/reporte?mes=${mes}&anio=${anio}`, { responseType: "blob" });
      const url  = URL.createObjectURL(new Blob([resp.data], { type: "text/csv;charset=utf-8;" }));
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `Reporte_${MESES[parseInt(mes) - 1]}_${anio}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el reporte. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="📄 Reporte Mensual" subtitle="Genera y descarga el reporte de órdenes del mes seleccionado">
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <p style={{ ...sectionLabel, marginBottom: "0.3rem" }}>Mes</p>
            <select value={mes} onChange={(e) => setMes(e.target.value)} style={dateInput}>
              {MESES.map((m, i) => (
                <option key={i} value={String(i + 1).padStart(2, "0")}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <p style={{ ...sectionLabel, marginBottom: "0.3rem" }}>Año</p>
            <select value={anio} onChange={(e) => setAnio(e.target.value)} style={dateInput}>
              {anios.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "1rem", border: "1px solid #E5E7EB" }}>
          <p style={{ margin: "0 0 0.25rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", fontWeight: 600 }}>
            📋 El reporte incluye:
          </p>
          <ul style={{ margin: "0.4rem 0 0 1rem", padding: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#6B7280", lineHeight: "1.7" }}>
            <li>ID y número de ticket de cada orden</li>
            <li>Fecha, estado y total facturado</li>
            <li>Nombre del paciente</li>
          </ul>
          <p style={{ margin: "0.75rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#9CA3AF" }}>
            Formato: CSV (compatible con Excel) · Codificación UTF-8
          </p>
        </div>

        {error && <p style={{ color: "#EF4444", fontSize: "0.8rem", fontFamily: "'Barlow', sans-serif", margin: 0 }}>⚠️ {error}</p>}

        <button
          onClick={descargar}
          disabled={loading}
          style={{
            padding: "0.65rem 1.25rem", background: loading ? "#9CA3AF" : "#1F2937",
            color: "#FFF", border: "none", borderRadius: "8px",
            fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.85rem",
            cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem"
          }}
        >
          {loading ? "Generando…" : "⬇ Descargar CSV"}
        </button>
      </div>
    </Modal>
  );
}

// ─── PANEL: INSUMOS CON STOCK CRÍTICO (colapsable + gráfico) ─────────────────
function PanelInsumos({ alertas, onVerInventario }) {
  const [abierto, setAbierto] = useState(true);

  if (alertas.length === 0) return null;

  const chartItems = alertas.slice(0, 10).map((a) => ({
    label: a.insumo,
    value: a.stock_actual,
    min:   a.stock_minimo,
  }));

  const W = 580, H = 140, PAD = { top: 10, right: 10, bot: 38, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bot;
  const maxVal = Math.max(...chartItems.map((d) => d.min), 1);
  const step   = innerW / chartItems.length;
  const barW   = Math.max(10, step - 8);

  return (
    <div style={{ border: "1px solid #FECACA", borderRadius: "12px", marginBottom: "1.25rem", overflow: "hidden", boxShadow: "0 1px 4px rgba(239,68,68,0.08)" }}>
      {/* cabecera clicable */}
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.85rem 1.25rem", background: "#FFF5F5", cursor: "pointer", borderBottom: abierto ? "1px solid #FECACA" : "none" }}
        onClick={() => setAbierto(!abierto)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1.1rem" }}>⚠️</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "#EF4444", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Insumos con Stock Crítico
          </span>
          <span style={{ background: "#EF4444", color: "#FFF", borderRadius: "20px", padding: "0.1rem 0.6rem", fontSize: "0.72rem", fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
            {alertas.length}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button style={linkBtn} onClick={(e) => { e.stopPropagation(); onVerInventario(); }}>Ver inventario →</button>
          <span style={{ color: "#9CA3AF", fontSize: "0.85rem" }}>{abierto ? "▲" : "▼"}</span>
        </div>
      </div>

      {abierto && (
        <div style={{ padding: "1rem 1.25rem 1.25rem", background: "#FFF" }}>
          {/* mini gráfico comparativo stock actual vs mínimo */}
          <p style={{ ...sectionLabel, marginBottom: "0.5rem" }}>Stock actual vs mínimo requerido</p>
          <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "0.75rem 0.5rem 0.25rem", marginBottom: "1rem" }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
              {[0, 0.5, 1].map((frac) => {
                const y = PAD.top + innerH * (1 - frac);
                return (
                  <g key={frac}>
                    <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="#F1F5F9" strokeWidth="1" />
                    <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#9CA3AF">{Math.round(maxVal * frac)}</text>
                  </g>
                );
              })}
              {chartItems.map((d, i) => {
                const cx       = PAD.left + step * i + step / 2;
                const bW       = barW / 2 - 1;
                // barra mínimo (gris)
                const minH     = Math.max(2, (d.min / maxVal) * innerH);
                const minY     = PAD.top + innerH - minH;
                // barra actual (rojo si bajo mínimo, verde si ok)
                const actH     = Math.max(2, (d.value / maxVal) * innerH);
                const actY     = PAD.top + innerH - actH;
                const color    = d.value <= d.min ? "#EF4444" : "#10B981";
                return (
                  <g key={i}>
                    {/* mínimo */}
                    <rect x={cx - bW - 1} y={minY} width={bW} height={minH} rx="2" fill="#E5E7EB" />
                    {/* actual */}
                    <rect x={cx + 1} y={actY} width={bW} height={actH} rx="2" fill={color} opacity="0.85" />
                    <text x={cx} y={H - PAD.bot + 14} textAnchor="middle" fontSize="8" fill="#6B7280" style={{ fontFamily: "'Barlow', sans-serif" }}>
                      {d.label.length > 7 ? d.label.slice(0, 7) + "…" : d.label}
                    </text>
                  </g>
                );
              })}
              {/* leyenda */}
              <rect x={PAD.left} y={H - 8} width="10" height="8" rx="2" fill="#E5E7EB" />
              <text x={PAD.left + 14} y={H - 1} fontSize="9" fill="#9CA3AF">Mínimo</text>
              <rect x={PAD.left + 60} y={H - 8} width="10" height="8" rx="2" fill="#EF4444" opacity="0.85" />
              <text x={PAD.left + 74} y={H - 1} fontSize="9" fill="#9CA3AF">Actual (bajo)</text>
              <rect x={PAD.left + 150} y={H - 8} width="10" height="8" rx="2" fill="#10B981" opacity="0.85" />
              <text x={PAD.left + 164} y={H - 1} fontSize="9" fill="#9CA3AF">Actual (ok)</text>
            </svg>
          </div>

          {/* tabla */}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Insumo","Stock Actual","Stock Mínimo","Necesita Reponer"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {alertas.map((a, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#FFF" : "#FFFBEB" }}>
                  <td style={td}><strong style={{ color: "#1F2937" }}>{a.insumo}</strong></td>
                  <td style={td}><span style={{ color: "#EF4444", fontWeight: 700 }}>{a.stock_actual} {a.unidad_medida}</span></td>
                  <td style={{ ...td, color: "#9CA3AF" }}>{a.stock_minimo} {a.unidad_medida}</td>
                  <td style={td}>
                    <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.15rem 0.6rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700 }}>
                      +{a.stock_minimo - a.stock_actual} {a.unidad_medida}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD PRINCIPAL ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [alertas, setAlertas] = useState([]);

  const [modal, setModal] = useState(null);
  const openModal  = useCallback((name) => setModal(name), []);
  const closeModal = useCallback(() => setModal(null), []);

  useEffect(() => {
    API.get("/dashboard/admin")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    API.get("/insumos/alertas")
      .then((r) => setAlertas(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAlertas([]));
  }, []);

  if (loading) return <Loader />;
  if (error)   return <ErrorMsg msg={error} />;

  const k      = data?.kpis || {};
  const ordenes = data?.ordenesDia || [];

  const kpis = [
    { icon: "👤", label: "Pacientes Registrados",  value: fmt(k.pac_hoy),          accent: "#3B82F6", onClick: () => openModal("pacientes") },
    { icon: "📋", label: "Órdenes Hoy",             value: fmt(k.ord_hoy),          accent: "#E88B3A", onClick: () => openModal("ordenes") },
    { icon: "⏳", label: "Por Validar",              value: fmt(k.pen_val),          accent: "#F59E0B", onClick: () => openModal("porValidar") },
    { icon: "✅", label: "Completados",              value: fmt(k.completados),      accent: "#10B981" },
    { icon: "⚠️", label: "Resultados Críticos",     value: fmt(k.criticos),         accent: "#EF4444", onClick: () => openModal("criticos") },
    { icon: "👥", label: "Usuarios Activos Hoy",    value: fmt(k.activos),          accent: "#8B5CF6", onClick: () => openModal("usuarios") },
    { icon: "💵", label: "Ingresos",                  value: fmtMoney(k.ingresos_hoy), accent: "#10B981", onClick: () => openModal("ingresos") },
    { icon: "📦", label: "Insumos con Stock Bajo",  value: fmt(k.stock_bajo),       accent: k.stock_bajo > 0 ? "#EF4444" : "#10B981", onClick: k.stock_bajo > 0 ? () => openModal("stockBajo") : undefined },
  ];

  return (
    <div style={page}>
      {/* ── MODALES ── */}
      <ModalUsuarios    open={modal === "usuarios"}   onClose={closeModal} />
      <ModalOrdenes     open={modal === "ordenes"}    onClose={closeModal} />
      <ModalIngresos    open={modal === "ingresos"}   onClose={closeModal} />
      <ModalPacientes   open={modal === "pacientes"}  onClose={closeModal} />
      <ModalCriticos    open={modal === "criticos"}   onClose={closeModal} />
      <ModalPorValidar  open={modal === "porValidar"} onClose={closeModal} />
      <ModalReportePDF  open={modal === "reporte"}    onClose={closeModal} />
      <ModalStockBajo   open={modal === "stockBajo"}  onClose={closeModal} alertas={alertas} onVerInventario={() => navigate("/admin/inventario")} />

      {/* ── ENCABEZADO ── */}
      <div style={header}>
        <div>
          <h2 style={pageH2}>Dashboard Administrativo</h2>
          <p style={pageSub}>
            Resumen operativo del día —{" "}
            {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <ActionBtn icon="📄" label="Reporte Mensual" onClick={() => openModal("reporte")} />
          <ActionBtn icon="✅" label="Ver Resultados"   onClick={() => navigate("/admin/resultados")} primary />
          <ActionBtn icon="📦" label="Ver Inventario"   onClick={() => navigate("/admin/inventario")} />
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={kpiGrid}>
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* ── GRÁFICOS ── */}
      <ChartsSection kpis={k} ordenes={ordenes} alertas={alertas} />

      {/* ── PANEL INSUMOS COLAPSABLE ── */}
      <PanelInsumos alertas={alertas} onVerInventario={() => navigate("/admin/inventario")} />

      {/* ── BLOQUE INFERIOR ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        {/* Órdenes del Día */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>📋 Órdenes del Día</span>
            <button style={linkBtn} onClick={() => openModal("ordenes")}>Ver detalle →</button>
          </div>
          {ordenes.length === 0 ? <p style={emptyTxt}>Sin órdenes registradas hoy</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>{["Ticket","Estado"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {ordenes.map((o, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}>
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
          <div style={cardHeader}><span style={cardTitle}>⚡ Accesos Rápidos</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
            {[
              { icon: "✅", label: "Validar Resultados",   path: "/admin/resultados", color: "#10B981" },
              { icon: "📦", label: "Gestionar Inventario", path: "/admin/inventario", color: "#E88B3A" },
              { icon: "👤", label: "Ver Pacientes",        path: "/admin/pacientes",  color: "#3B82F6" },
              { icon: "📋", label: "Ver Órdenes",          path: "/admin/ordenes",    color: "#8B5CF6" },
            ].map((a, i) => (
              <button key={i} onClick={() => navigate(a.path)} style={{ ...quickBtn, borderColor: `${a.color}30`, background: `${a.color}08` }}>
                <span style={{ fontSize: "1.4rem" }}>{a.icon}</span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#374151", fontWeight: 600 }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HELPERS UI ───────────────────────────────────────────────────────────────
function ActionBtn({ icon, label, onClick, primary }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "0.4rem",
      padding: "0.5rem 1rem", borderRadius: "8px", cursor: "pointer",
      fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", fontWeight: 600,
      border: primary ? "none" : "1px solid #E2E8F0",
      background: primary ? "#E88B3A" : "#F8FAFC",
      color: primary ? "#FFF" : "#374151",
    }}>{icon} {label}</button>
  );
}
function Loader()         { return <div style={{ padding: "3rem", textAlign: "center", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>Cargando dashboard…</div>; }
function ErrorMsg({ msg }) { return <div style={{ padding: "3rem", textAlign: "center", color: "#EF4444", fontFamily: "'Barlow', sans-serif" }}>Error: {msg}</div>; }

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const page        = { padding: "1.5rem", fontFamily: "'Barlow', sans-serif" };
const header      = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" };
const pageH2      = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "0.04em", color: "#1F2937", margin: 0, textTransform: "uppercase" };
const pageSub     = { fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const kpiGrid     = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" };
const kpiCard     = { background: "#FFF", borderRadius: "12px", padding: "1.1rem 1.25rem", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const kpiLabel    = { fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.35rem" };
const kpiValue    = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.8rem", margin: 0 };
const kpiSub      = { fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const kpiIcon     = { width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" };
const card        = { background: "#FFF", borderRadius: "12px", padding: "1.25rem", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const cardHeader  = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" };
const cardTitle   = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.06em", color: "#1F2937", textTransform: "uppercase" };
const linkBtn     = { background: "none", border: "none", color: "#E88B3A", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 600 };
const th          = { fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0.5rem 0.75rem", textAlign: "left", borderBottom: "2px solid #F1F5F9" };
const td          = { padding: "0.6rem 0.75rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151" };
const badgeBase   = { padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 600 };
const ticketStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#1F2937", letterSpacing: "0.05em" };
const emptyTxt    = { color: "#9CA3AF", fontSize: "0.82rem", textAlign: "center", padding: "2rem 0" };
const loadingTxt  = { color: "#9CA3AF", fontSize: "0.82rem", textAlign: "center", padding: "1.5rem 0" };
const quickBtn    = { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", padding: "1rem 0.75rem", borderRadius: "10px", cursor: "pointer", border: "1px solid", transition: "all 0.15s ease" };
const tbl         = { width: "100%", borderCollapse: "collapse", marginTop: "0.75rem" };
const searchInput = { width: "100%", boxSizing: "border-box", padding: "0.55rem 0.9rem", border: "1px solid #E5E7EB", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", outline: "none", marginBottom: "0.75rem" };
const sectionLabel = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.6rem" };
const dateInput   = { width: "100%", boxSizing: "border-box", padding: "0.48rem 0.75rem", border: "1px solid #E5E7EB", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", outline: "none", background: "#FFF" };
const pgBtn       = { padding: "0.3rem 0.75rem", border: "1px solid #E2E8F0", borderRadius: "6px", background: "#FFF", fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#374151", cursor: "pointer" };

// ── Modal styles ──
const overlay    = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" };
const modalBox   = { background: "#FFF", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" };
const modalHead  = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid #F1F5F9", flexShrink: 0 };
const modalTitle = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#1F2937", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" };
const modalSub   = { fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const closeBtn   = { background: "none", border: "none", fontSize: "1rem", cursor: "pointer", color: "#9CA3AF", padding: "0.25rem", lineHeight: 1 };