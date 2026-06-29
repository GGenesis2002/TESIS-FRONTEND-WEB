import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString("es-EC");
const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;

// ─── MODAL BASE ───────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, subtitle, children, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={overlay} onClick={onClose}>
      <div
        style={{ ...modalBox, maxWidth: wide ? "780px" : "560px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={modalHead}>
          <div>
            <h3 style={modalTitle}>{title}</h3>
            {subtitle && <p style={modalSub}>{subtitle}</p>}
          </div>
          <button style={closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "1.25rem 1.5rem 1.5rem" }}>{children}</div>
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
      style={{
        ...kpiCard,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.15s, transform 0.15s",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
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
      {onClick && (
        <p style={{ margin: "0.6rem 0 0", fontSize: "0.68rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>
          Ver detalle →
        </p>
      )}
    </div>
  );
}

// ─── BADGE ────────────────────────────────────────────────────────────────────
function Badge({ estado }) {
  const map = {
    Validado:    { bg: "#D1FAE5", color: "#065F46" },
    "Por Validar": { bg: "#FEF3C7", color: "#92400E" },
    "En Proceso": { bg: "#DBEAFE", color: "#1E40AF" },
    Generada:    { bg: "#F3F4F6", color: "#374151" },
    Devuelto:    { bg: "#FEE2E2", color: "#991B1B" },
  };
  const s = map[estado] || { bg: "#F3F4F6", color: "#374151" };
  return <span style={{ ...badgeBase, background: s.bg, color: s.color }}>{estado}</span>;
}

// ─── MODAL: USUARIOS ACTIVOS ──────────────────────────────────────────────────
function ModalUsuarios({ open, onClose }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

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
    return (
      !term ||
      u.nombres?.toLowerCase().includes(term) ||
      u.apellidos?.toLowerCase().includes(term) ||
      u.username?.toLowerCase().includes(term) ||
      u.rol?.toLowerCase().includes(term)
    );
  });

  return (
    <Modal open={open} onClose={onClose} title="👥 Usuarios Activos Hoy" subtitle={`${usuarios.length} usuarios han iniciado sesión hoy`} wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre, usuario o rol…" />
      {loading ? (
        <p style={loadingTxt}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p style={emptyTxt}>No se encontraron usuarios</p>
      ) : (
        <table style={tbl}>
          <thead>
            <tr>
              {["Nombre", "Usuario", "Rol", "Último acceso"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
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

// ─── MODAL: ÓRDENES DEL DÍA (por usuario) ────────────────────────────────────
function ModalOrdenes({ open, onClose }) {
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    API.get("/dashboard/ordenes-por-usuario")
      .then((r) => setGrupos(Array.isArray(r.data) ? r.data : []))
      .catch(() => setGrupos([]))
      .finally(() => setLoading(false));
  }, [open]);

  const gruposFiltrados = grupos.map((g) => ({
    ...g,
    ordenes: g.ordenes.filter((o) => {
      const term = q.toLowerCase();
      return (
        !term ||
        o.numero_ticket?.toLowerCase().includes(term) ||
        o.estado?.toLowerCase().includes(term) ||
        o.paciente?.toLowerCase().includes(term)
      );
    }),
  })).filter((g) => g.ordenes.length > 0 || !q);

  return (
    <Modal open={open} onClose={onClose} title="📋 Órdenes del Día — Por Usuario" subtitle="Desglose de órdenes generadas por cada asistente" wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar ticket, estado o paciente…" />
      {loading ? (
        <p style={loadingTxt}>Cargando…</p>
      ) : gruposFiltrados.length === 0 ? (
        <p style={emptyTxt}>Sin órdenes registradas hoy</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
          {gruposFiltrados.map((g, gi) => (
            <div key={gi} style={{ border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden" }}>
              {/* cabecera del grupo */}
              <div
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: "#F8FAFC", cursor: "pointer" }}
                onClick={() => setExpandido(expandido === gi ? null : gi)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#E88B3A18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>👤</div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "0.88rem", color: "#1F2937", fontFamily: "'Barlow', sans-serif" }}>{g.usuario}</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>{g.rol}</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <span style={{ background: "#E88B3A", color: "#FFF", borderRadius: "20px", padding: "0.2rem 0.7rem", fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
                    {g.ordenes.length} orden{g.ordenes.length !== 1 ? "es" : ""}
                  </span>
                  <span style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>{expandido === gi ? "▲" : "▼"}</span>
                </div>
              </div>
              {/* detalle órdenes */}
              {expandido === gi && (
                <table style={{ ...tbl, margin: 0, borderRadius: 0 }}>
                  <thead>
                    <tr>
                      {["Ticket", "Paciente", "Estado", "Monto"].map((h) => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {g.ordenes.map((o, oi) => (
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
                      <td style={{ ...td, fontWeight: 700, color: "#10B981" }}>{fmtMoney(g.ordenes.reduce((s, o) => s + Number(o.total || 0), 0))}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ─── MODAL: INGRESOS DEL DÍA ─────────────────────────────────────────────────
function ModalIngresos({ open, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      API.get("/dashboard/arqueo-hoy"),
      API.get("/dashboard/ingresos-por-usuario"),
    ])
      .then(([arqueoRes, usuariosRes]) => {
        setData({
          arqueo: arqueoRes.data,
          porUsuario: Array.isArray(usuariosRes.data) ? usuariosRes.data : [],
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="💵 Ingresos del Día" subtitle="Caja, métodos de pago y desglose por usuario" wide>
      {loading ? (
        <p style={loadingTxt}>Cargando…</p>
      ) : !data ? (
        <p style={emptyTxt}>No se pudieron cargar los datos de caja</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* ── Arqueo de caja ── */}
          <div>
            <p style={sectionLabel}>📊 Arqueo de Caja</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
              {[
                { label: "Efectivo", value: data.arqueo?.efectivo, color: "#10B981", icon: "💵" },
                { label: "Transferencia", value: data.arqueo?.transferencia, color: "#3B82F6", icon: "🏦" },
                { label: "Tarjeta", value: data.arqueo?.tarjeta, color: "#8B5CF6", icon: "💳" },
              ].map((m) => (
                <div key={m.label} style={{ background: `${m.color}10`, border: `1px solid ${m.color}30`, borderRadius: "10px", padding: "0.9rem 1rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.7rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>{m.icon} {m.label}</p>
                  <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.4rem", color: m.color }}>{fmtMoney(m.value)}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "0.6rem", padding: "0.6rem 1rem", background: "#1F2937", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#E5E7EB", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", fontWeight: 600 }}>Total recaudado</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.3rem", color: "#10B981" }}>
                {fmtMoney((Number(data.arqueo?.efectivo || 0) + Number(data.arqueo?.transferencia || 0) + Number(data.arqueo?.tarjeta || 0)))}
              </span>
            </div>
          </div>

          {/* ── Por usuario/asistente ── */}
          {data.porUsuario.length > 0 && (
            <div>
              <p style={sectionLabel}>👤 Desglose por Asistente</p>
              <table style={tbl}>
                <thead>
                  <tr>
                    {["Asistente", "Rol", "Órdenes", "Total Generado"].map((h) => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.porUsuario.map((u, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 ? "#FAFAFA" : "#FFF" }}>
                      <td style={td}><strong>{u.usuario}</strong></td>
                      <td style={td}><span style={{ fontSize: "0.72rem", color: "#6B7280" }}>{u.rol}</span></td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <span style={{ background: "#E88B3A18", color: "#E88B3A", padding: "0.15rem 0.6rem", borderRadius: "20px", fontWeight: 700, fontSize: "0.78rem" }}>
                          {u.total_ordenes}
                        </span>
                      </td>
                      <td style={{ ...td, fontWeight: 700, color: "#10B981" }}>{fmtMoney(u.total_generado)}</td>
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

// ─── MODAL: PACIENTES REGISTRADOS ────────────────────────────────────────────
function ModalPacientes({ open, onClose }) {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    API.get("/pacientes?limit=100")
      .then((r) => setLista(Array.isArray(r.data) ? r.data : (r.data?.pacientes || [])))
      .catch(() => setLista([]))
      .finally(() => setLoading(false));
  }, [open]);

  const filtrado = lista.filter((p) => {
    const term = q.toLowerCase();
    return !term || `${p.nombres} ${p.apellidos}`.toLowerCase().includes(term) || p.cedula?.includes(term);
  });

  return (
    <Modal open={open} onClose={onClose} title="👤 Pacientes Registrados" subtitle={`${lista.length} pacientes en el sistema`} wide>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar por nombre o cédula…" />
      {loading ? (
        <p style={loadingTxt}>Cargando…</p>
      ) : filtrado.length === 0 ? (
        <p style={emptyTxt}>No se encontraron pacientes</p>
      ) : (
        <table style={tbl}>
          <thead>
            <tr>
              {["Nombre", "Cédula", "Teléfono", "Correo"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
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
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

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
      {loading ? (
        <p style={loadingTxt}>Cargando…</p>
      ) : filtrado.length === 0 ? (
        <p style={emptyTxt}>No hay resultados críticos</p>
      ) : (
        <table style={tbl}>
          <thead>
            <tr>
              {["Paciente", "Parámetro", "Valor", "Rango Normal", "Estado"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
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
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
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
      {loading ? (
        <p style={loadingTxt}>Cargando…</p>
      ) : filtrado.length === 0 ? (
        <p style={emptyTxt}>No hay órdenes por validar</p>
      ) : (
        <>
          <table style={tbl}>
            <thead>
              <tr>
                {["Ticket", "Paciente", "Fecha", "Exámenes"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
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

// ─── DASHBOARD PRINCIPAL ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [alertas, setAlertas] = useState([]);

  // modales
  const [modal, setModal] = useState(null); // "usuarios" | "ordenes" | "ingresos" | "pacientes" | "criticos" | "porValidar"
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

  const k = data?.kpis || {};
  const ordenes = data?.ordenesDia || [];

  const kpis = [
    { icon: "👤", label: "Pacientes Registrados",  value: fmt(k.pac_hoy),     accent: "#3B82F6", onClick: () => openModal("pacientes") },
    { icon: "📋", label: "Órdenes Hoy",             value: fmt(k.ord_hoy),     accent: "#E88B3A", onClick: () => openModal("ordenes") },
    { icon: "⏳", label: "Por Validar",              value: fmt(k.pen_val),     accent: "#F59E0B", onClick: () => openModal("porValidar") },
    { icon: "✅", label: "Completados",              value: fmt(k.completados), accent: "#10B981" },
    { icon: "⚠️", label: "Resultados Críticos",     value: fmt(k.criticos),    accent: "#EF4444", onClick: () => openModal("criticos") },
    { icon: "👥", label: "Usuarios Activos Hoy",    value: fmt(k.activos),     accent: "#8B5CF6", onClick: () => openModal("usuarios") },
    { icon: "💵", label: "Ingresos del Día",         value: fmtMoney(k.ingresos_hoy), accent: "#10B981", onClick: () => openModal("ingresos") },
    { icon: "📦", label: "Insumos con Stock Bajo",  value: fmt(k.stock_bajo),  accent: k.stock_bajo > 0 ? "#EF4444" : "#10B981" },
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

      {/* ── ENCABEZADO ── */}
      <div style={header}>
        <div>
          <h2 style={pageH2}>Dashboard Administrativo</h2>
          <p style={pageSub}>
            Resumen operativo del día —{" "}
            {new Date().toLocaleDateString("es-EC", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <ActionBtn icon="✅" label="Ver Resultados"  onClick={() => navigate("/admin/resultados")} primary />
          <ActionBtn icon="📦" label="Ver Inventario"  onClick={() => navigate("/admin/inventario")} />
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={kpiGrid}>
        {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
      </div>

      {/* ── ALERTAS DE INVENTARIO ── */}
      {alertas.length > 0 && (
        <div style={{ ...card, borderLeft: "4px solid #EF4444", marginBottom: "1.25rem", borderRadius: "0 12px 12px 0" }}>
          <div style={cardHeader}>
            <span style={{ ...cardTitle, color: "#EF4444" }}>
              ⚠️ Insumos con Stock Crítico ({alertas.length})
            </span>
            <button style={linkBtn} onClick={() => navigate("/admin/inventario")}>Ver inventario →</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Insumo", "Stock Actual", "Stock Mínimo", "Necesita Reponer"].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
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

      {/* ── BLOQUE INFERIOR ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>

        {/* Órdenes del Día */}
        <div style={card}>
          <div style={cardHeader}>
            <span style={cardTitle}>📋 Órdenes del Día</span>
            <button style={linkBtn} onClick={() => openModal("ordenes")}>Ver detalle →</button>
          </div>
          {ordenes.length === 0 ? (
            <p style={emptyTxt}>Sin órdenes registradas hoy</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Ticket", "Estado"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
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
          <div style={cardHeader}>
            <span style={cardTitle}>⚡ Accesos Rápidos</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
            {[
              { icon: "✅", label: "Validar Resultados",   path: "/admin/resultados", color: "#10B981" },
              { icon: "📦", label: "Gestionar Inventario", path: "/admin/inventario", color: "#E88B3A" },
              { icon: "👤", label: "Ver Pacientes",        path: "/admin/pacientes",  color: "#3B82F6" },
              { icon: "📋", label: "Ver Órdenes",          path: "/admin/ordenes",    color: "#8B5CF6" },
            ].map((a, i) => (
              <button
                key={i}
                onClick={() => navigate(a.path)}
                style={{ ...quickBtn, borderColor: `${a.color}30`, background: `${a.color}08` }}
              >
                <span style={{ fontSize: "1.4rem" }}>{a.icon}</span>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#374151", fontWeight: 600 }}>
                  {a.label}
                </span>
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
function Loader() {
  return <div style={{ padding: "3rem", textAlign: "center", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>Cargando dashboard…</div>;
}
function ErrorMsg({ msg }) {
  return <div style={{ padding: "3rem", textAlign: "center", color: "#EF4444", fontFamily: "'Barlow', sans-serif" }}>Error: {msg}</div>;
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const page       = { padding: "1.5rem", fontFamily: "'Barlow', sans-serif" };
const header     = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" };
const pageH2     = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "0.04em", color: "#1F2937", margin: 0, textTransform: "uppercase" };
const pageSub    = { fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const kpiGrid    = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.25rem" };
const kpiCard    = { background: "#FFF", borderRadius: "12px", padding: "1.1rem 1.25rem", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const kpiLabel   = { fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.35rem" };
const kpiValue   = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.8rem", margin: 0 };
const kpiSub     = { fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const kpiIcon    = { width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" };
const card       = { background: "#FFF", borderRadius: "12px", padding: "1.25rem", border: "1px solid #F1F5F9", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const cardHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" };
const cardTitle  = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.06em", color: "#1F2937", textTransform: "uppercase" };
const linkBtn    = { background: "none", border: "none", color: "#E88B3A", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 600 };
const th         = { fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0.5rem 0.75rem", textAlign: "left", borderBottom: "2px solid #F1F5F9" };
const td         = { padding: "0.6rem 0.75rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151" };
const badgeBase  = { padding: "0.2rem 0.6rem", borderRadius: "20px", fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif", fontWeight: 600 };
const ticketStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#1F2937", letterSpacing: "0.05em" };
const emptyTxt   = { color: "#9CA3AF", fontSize: "0.82rem", textAlign: "center", padding: "2rem 0" };
const loadingTxt = { color: "#9CA3AF", fontSize: "0.82rem", textAlign: "center", padding: "1.5rem 0" };
const quickBtn   = { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", padding: "1rem 0.75rem", borderRadius: "10px", cursor: "pointer", border: "1px solid", transition: "all 0.15s ease" };
const tbl        = { width: "100%", borderCollapse: "collapse", marginTop: "0.75rem" };
const searchInput = { width: "100%", boxSizing: "border-box", padding: "0.55rem 0.9rem", border: "1px solid #E5E7EB", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", outline: "none", marginBottom: "0.25rem" };
const sectionLabel = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.6rem" };

// ── Modal styles ──
const overlay    = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" };
const modalBox   = { background: "#FFF", borderRadius: "16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" };
const modalHead  = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "1.25rem 1.5rem 0", borderBottom: "1px solid #F1F5F9", paddingBottom: "1rem" };
const modalTitle = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#1F2937", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" };
const modalSub   = { fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const closeBtn   = { background: "none", border: "none", fontSize: "1rem", cursor: "pointer", color: "#9CA3AF", padding: "0.25rem", lineHeight: 1 };