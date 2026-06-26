import { useState, useEffect, useCallback } from "react";
import API from "../../services/api";

// ─── CAPA DE ACCESO A DATOS ───────────────────────────────────────────────────
const api = {
  // Insumos
  getInsumos:        ()         => API.get("/insumos").then(r => r.data),
  getCategorias:     ()         => API.get("/insumos/categorias").then(r => r.data),
  crear:             (body)     => API.post("/insumos", body).then(r => r.data),
  actualizar:        (id, body) => API.put(`/insumos/${id}`, body).then(r => r.data),
  eliminar:          (id)       => API.delete(`/insumos/${id}`).then(r => r.data),
  // Categorías
  crearCategoria:    (body)     => API.post("/insumos/categorias", body).then(r => r.data),
  actualizarCat:     (id, body) => API.put(`/insumos/categorias/${id}`, body).then(r => r.data),
  eliminarCat:       (id)       => API.delete(`/insumos/categorias/${id}`).then(r => r.data),
  // Movimientos
  getMovimientos:    ()         => API.get("/insumos/movimientos").then(r => r.data),
  movimiento:        (body)     => API.post("/insumos/movimiento", body).then(r => r.data),
  // Alertas
  getAlertas:        ()         => API.get("/insumos/alertas").then(r => r.data),
  // Usos adicionales
  getUsosAdicionales: ()        => API.get("/usos-adicionales").then(r => r.data),
  // Recetas
  getExamenes:       ()         => API.get("/examenes").then(r => {
    const d = r.data;
    return Array.isArray(d) ? d : (d?.examenes ?? []);
  }),
  getRecetas:        ()         => API.get("/insumos/recetas").then(r => r.data),
  crearReceta:       (body)     => API.post("/insumos/receta", body).then(r => r.data),
  eliminarReceta:    (id)       => API.delete(`/insumos/receta/${id}`).then(r => r.data),
  // Tipos de Muestra (catálogo — se asignan desde el insumo, no desde la receta)
  getTiposMuestra:   ()         => API.get("/tipo-muestra").then(r => r.data),
  crearTipoMuestra:  (body)     => API.post("/tipo-muestra", body).then(r => r.data),
  eliminarTipoMuestra:(id)      => API.delete(`/tipo-muestra/${id}`).then(r => r.data),
};

// ─── COMPONENTES REUTILIZABLES ────────────────────────────────────────────────

function StockBadge({ actual, minimo }) {
  if (actual <= 0)      return <Chip bg="#FEE2E2" color="#991B1B">Sin Stock</Chip>;
  if (actual <= minimo) return <Chip bg="#FEF3C7" color="#92400E">Stock Bajo</Chip>;
  return <Chip bg="#D1FAE5" color="#065F46">OK</Chip>;
}

function Chip({ bg, color, children }) {
  return (
    <span style={{
      padding: "0.2rem 0.65rem", borderRadius: "20px",
      fontSize: "0.72rem", fontFamily: "'Barlow', sans-serif",
      fontWeight: 700, background: bg, color,
      display: "inline-block", whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  const ok = msg.tipo === "ok";
  return (
    <div style={{
      position: "fixed", top: "80px", right: "1.5rem", zIndex: 500,
      background: ok ? "#D1FAE5" : "#FEE2E2",
      color: ok ? "#065F46" : "#991B1B",
      border: `1px solid ${ok ? "#86EFAC" : "#FCA5A5"}`,
      padding: "0.75rem 1.25rem", borderRadius: "10px",
      fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem",
      fontWeight: 600, boxShadow: "0 4px 15px rgba(0,0,0,0.1)", maxWidth: "380px",
    }}>
      {ok ? "✅" : "❌"} {msg.texto}
    </div>
  );
}

function Modal({ title, onClose, children, width = "520px" }) {
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, width, maxWidth: "95vw" }}>
        <div style={modalHead}>
          <span style={modalTitleSt}>{title}</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: "1.25rem" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "", disabled = false, rows }) {
  const baseStyle = {
    ...finput,
    background: disabled ? "#F3F4F6" : "#FFF",
    color: disabled ? "#9CA3AF" : "#1F2937",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <label style={flabel}>{label}</label>
      {rows ? (
        <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled}
          style={{ ...baseStyle, resize: "vertical" }} />
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} disabled={disabled} style={baseStyle} />
      )}
    </div>
  );
}

function IconBtn({ icon, title, onClick, color, disabled = false }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{
      background: disabled ? "#F3F4F620" : `${color}15`,
      border: `1px solid ${disabled ? "#E2E8F0" : `${color}30`}`,
      borderRadius: "6px", width: "30px", height: "30px",
      cursor: disabled ? "not-allowed" : "pointer", fontSize: "0.85rem",
      display: "flex", alignItems: "center", justifyContent: "center",
      opacity: disabled ? 0.4 : 1,
    }}>
      {icon}
    </button>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <tr>
      <td colSpan={99} style={{ textAlign: "center", padding: "3rem 1rem" }}>
        <p style={{ fontSize: "2rem", margin: "0 0 0.4rem" }}>{icon}</p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.95rem", color: "#374151", margin: "0 0 0.25rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</p>
        {subtitle && <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#9CA3AF", margin: 0 }}>{subtitle}</p>}
      </td>
    </tr>
  );
}

// ─── FORMULARIO INSUMO ────────────────────────────────────────────────────────
function FormInsumo({ initial, categorias, tiposMuestra = [], onSave, onClose, onAlert }) {
  const [f, setF] = useState({
    id_categoria_insumo: initial?.id_categoria_insumo ?? "",
    nombre:              initial?.nombre              ?? "",
    descripcion:         initial?.descripcion         ?? "",
    unidad_medida:       initial?.unidad_medida       ?? "",
    stock_actual:        initial?.stock_actual        ?? 0,
    stock_minimo:        initial?.stock_minimo        ?? 0,
    // Tipo de muestra: propiedad directa del insumo (un solo valor o null)
    id_tipo_muestra:     initial?.id_tipo_muestra     ?? "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!f.nombre.trim())        return onAlert?.("Campo obligatorio", "El nombre del insumo es obligatorio.");
    if (!f.unidad_medida.trim()) return onAlert?.("Campo obligatorio", "La unidad de medida es obligatoria.");
    setSaving(true);
    try {
      await onSave({ ...f, id_tipo_muestra: f.id_tipo_muestra || null });
      onClose();
    }
    catch (e) { onAlert?.("Error al guardar", e?.response?.data?.error || "No se pudo guardar el insumo."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div style={grid2}>
        <Field label="Nombre del Insumo *" value={f.nombre} onChange={v => set("nombre", v)} />
        <Field label="Unidad de Medida *" value={f.unidad_medida} onChange={v => set("unidad_medida", v)} placeholder="ml, unidades, mg…" />
      </div>
      <div style={grid2}>
        {/* Categoría */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <label style={flabel}>Categoría</label>
          <select style={finput} value={f.id_categoria_insumo}
            onChange={e => set("id_categoria_insumo", e.target.value)}>
            <option value="">-- Sin categoría --</option>
            {categorias.map(c => (
              <option key={c.id_categoria_insumo} value={c.id_categoria_insumo}>{c.nombre}</option>
            ))}
          </select>
        </div>
        {/* Tipo de muestra: un select simple, opcional */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <label style={flabel}>🧪 Tipo de Muestra</label>
          <select
            style={{
              ...finput,
              borderColor: f.id_tipo_muestra ? "#7C3AED" : "#E2E8F0",
              background:  f.id_tipo_muestra ? "#F5F3FF" : "#FFF",
              color:       f.id_tipo_muestra ? "#5B21B6" : "#374151",
            }}
            value={f.id_tipo_muestra}
            onChange={e => set("id_tipo_muestra", e.target.value)}
          >
            <option value="">— No requiere (guantes, reactivos…) —</option>
            {tiposMuestra.map(t => (
              <option key={t.id_tipo_muestra} value={t.id_tipo_muestra}>{t.nombre}</option>
            ))}
          </select>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.68rem", color: "#9CA3AF" }}>
            Solo para insumos de toma de muestra (tubos, hisopos, lancetas…)
          </span>
        </div>
      </div>
      <Field label="Descripción" value={f.descripcion} onChange={v => set("descripcion", v)}
        placeholder="Descripción del insumo…" rows={2} />
      <div style={grid2}>
        <Field label="Stock Inicial" type="number" value={f.stock_actual}
          onChange={v => set("stock_actual", +v)} disabled={!!initial} />
        <Field label="Stock Mínimo" type="number" value={f.stock_minimo}
          onChange={v => set("stock_minimo", +v)} />
      </div>
      {!!initial && (
        <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#9CA3AF", margin: 0 }}>
          ℹ️ Para modificar el stock usa "Registrar Movimiento" desde la tabla.
        </p>
      )}
      <div style={footerRow}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={submit} disabled={saving} style={btnPrimary}>
          {saving ? "Guardando…" : "💾 Guardar"}
        </button>
      </div>
    </div>
  );
}

// ─── FORMULARIO CATEGORÍA ─────────────────────────────────────────────────────
function FormCategoria({ initial, onSave, onClose, onAlert }) {
  const [f, setF] = useState(initial || { nombre: "", descripcion: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!f.nombre.trim()) return onAlert?.("Campo obligatorio", "El nombre de la categoría es obligatorio.");
    setSaving(true);
    try { await onSave(f); onClose(); }
    catch (e) { onAlert?.("Error al guardar", e?.response?.data?.error || "No se pudo guardar la categoría."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <Field label="Nombre de la Categoría *" value={f.nombre}
        onChange={v => set("nombre", v)} placeholder="Ej: Reactivos, Material descartable…" />
      <Field label="Descripción (opcional)" value={f.descripcion}
        onChange={v => set("descripcion", v)}
        placeholder="Breve descripción de los insumos en esta categoría…"
        rows={3} />
      <div style={footerRow}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={submit} disabled={saving} style={btnPrimary}>
          {saving ? "Guardando…" : "💾 Guardar Categoría"}
        </button>
      </div>
    </div>
  );
}

// ─── FORMULARIO MOVIMIENTO ────────────────────────────────────────────────────
function FormMovimiento({ insumo, onSave, onClose, onAlert }) {
  const [f, setF] = useState({
    id_insumo: insumo.id_insumo, tipo_movimiento: "ENTRADA", cantidad: 1, observacion: "",
  });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const [saving, setSaving] = useState(false);

  const stockResultante = f.tipo_movimiento === "ENTRADA"
    ? insumo.stock_actual + Number(f.cantidad)
    : insumo.stock_actual - Number(f.cantidad);

  const submit = async () => {
    if (f.cantidad <= 0) return onAlert?.("Cantidad inválida", "La cantidad debe ser mayor a 0.");
    if (f.tipo_movimiento === "SALIDA" && f.cantidad > insumo.stock_actual)
      return onAlert?.("Stock insuficiente", `No puedes retirar más de ${insumo.stock_actual} ${insumo.unidad_medida} disponibles.`);
    setSaving(true);
    try { await onSave(f); onClose(); }
    catch (e) { onAlert?.("Error al registrar", e?.response?.data?.error || "No se pudo registrar el movimiento."); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {/* Info insumo */}
      <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem 1rem", border: "1px solid #E2E8F0" }}>
        <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", color: "#1F2937" }}>
          {insumo.nombre}
        </p>
        <p style={{ margin: "0.25rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#9CA3AF" }}>
          Stock actual: <strong style={{ color: "#1F2937" }}>{insumo.stock_actual}</strong> {insumo.unidad_medida}
          &nbsp;·&nbsp; Mínimo: <strong style={{ color: "#1F2937" }}>{insumo.stock_minimo}</strong>
        </p>
      </div>

      {/* Tipo movimiento */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <label style={flabel}>Tipo de Movimiento</label>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          {[
            ["ENTRADA", "⬆️ Entrada", "#10B981", "#D1FAE5", "#065F46"],
            ["SALIDA",  "⬇️ Salida",  "#EF4444", "#FEE2E2", "#991B1B"],
          ].map(([val, lbl, border, bg, color]) => (
            <button key={val} onClick={() => set("tipo_movimiento", val)} style={{
              flex: 1, padding: "0.65rem", borderRadius: "8px", cursor: "pointer",
              fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.82rem",
              border: f.tipo_movimiento === val ? `2px solid ${border}` : "1px solid #E2E8F0",
              background: f.tipo_movimiento === val ? bg : "#F8FAFC",
              color: f.tipo_movimiento === val ? color : "#9CA3AF",
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      <Field label="Cantidad *" type="number" value={f.cantidad} onChange={v => set("cantidad", +v)} />
      <Field label="Observación" value={f.observacion} onChange={v => set("observacion", v)}
        placeholder="Motivo del movimiento…" />

      {/* Preview stock resultante */}
      <div style={{
        background: stockResultante < insumo.stock_minimo ? "#FEF3C7" : "#F0FDF4",
        border: `1px solid ${stockResultante < insumo.stock_minimo ? "#F59E0B" : "#86EFAC"}`,
        borderRadius: "8px", padding: "0.65rem 1rem",
      }}>
        <p style={{
          margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem",
          color: stockResultante < insumo.stock_minimo ? "#92400E" : "#166534", fontWeight: 600,
        }}>
          {stockResultante < insumo.stock_minimo ? "⚠️" : "✅"} Stock resultante:{" "}
          <strong>{stockResultante}</strong> {insumo.unidad_medida}
          {stockResultante < insumo.stock_minimo && " — Quedará bajo el mínimo"}
        </p>
      </div>

      <div style={footerRow}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={submit} disabled={saving} style={btnPrimary}>
          {saving ? "Registrando…" : "📋 Registrar Movimiento"}
        </button>
      </div>
    </div>
  );
}

// ─── FORMULARIO RECETA (multi-insumo) ────────────────────────────────────────
function FormReceta({ insumos, examenes, recetas = [], onSave, onClose, onAlert }) {
  const [idExamen, setIdExamen] = useState("");
  const [filas,    setFilas]    = useState([{ id_insumo: "", cantidad_usada: 1 }]);
  const [saving,   setSaving]   = useState(false);
  const [progreso, setProgreso] = useState(null);

  // Edición inline de un insumo ya vinculado
  const [editandoId, setEditandoId] = useState(null); // id_examen_insumo en edición
  const [cantEdit,   setCantEdit]   = useState(1);
  const [guardandoEdit, setGuardandoEdit] = useState(false);

  // Insumos que el examen seleccionado YA tiene vinculados (vienen de la BD)
  const yaVinculados = idExamen
    ? recetas.filter(r => String(r.id_examen) === String(idExamen))
    : [];
  const idsYaVinculados = yaVinculados.map(r => String(r.id_insumo));

  // Al cambiar de examen, limpiamos las filas para evitar dejar seleccionado
  // un insumo que en realidad pertenece a otro examen
  const handleCambiarExamen = (valor) => {
    setIdExamen(valor);
    setFilas([{ id_insumo: "", cantidad_usada: 1 }]);
    setEditandoId(null);
  };

  const empezarEdicion = (receta) => {
    setEditandoId(receta.id_examen_insumo);
    setCantEdit(receta.cantidad_usada);
  };

  const guardarEdicion = async (receta) => {
    if (!cantEdit || cantEdit <= 0) return onAlert?.("Cantidad inválida", "Ingresa una cantidad mayor a 0.");
    setGuardandoEdit(true);
    try {
      await onSave({ id_examen: receta.id_examen, id_insumo: receta.id_insumo, cantidad_usada: cantEdit });
      receta.cantidad_usada = cantEdit; // refleja el cambio al instante en el resumen
      setEditandoId(null);
      onAlert?.("Cantidad actualizada", `Ahora se vincula con ${cantEdit} unidad(es).`, "ok");
    } catch {
      onAlert?.("Error", "No se pudo actualizar la cantidad.");
    } finally {
      setGuardandoEdit(false);
    }
  };

  const elegidos = filas.map(f => String(f.id_insumo)).filter(Boolean);
  const setFila  = (idx, campo, valor) =>
    setFilas(prev => prev.map((f, i) => i === idx ? { ...f, [campo]: valor } : f));
  const agregarFila = () => setFilas(prev => [...prev, { id_insumo: "", cantidad_usada: 1 }]);
  const quitarFila  = (idx) => setFilas(prev => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if (!idExamen) return onAlert?.("Campo obligatorio", "Selecciona un examen antes de vincular.");
    const validas = filas.filter(f => f.id_insumo && f.cantidad_usada > 0);
    if (validas.length === 0) return onAlert?.("Sin insumos", "Agrega al menos un insumo con cantidad válida.");

    setSaving(true);
    let ok = 0, errores = 0;
    for (const fila of validas) {
      try {
        await onSave({ id_examen: idExamen, id_insumo: fila.id_insumo, cantidad_usada: fila.cantidad_usada });
        ok++;
      } catch { errores++; }
    }
    setProgreso({ ok, err: errores, total: validas.length });
    setSaving(false);
    if (errores === 0) setTimeout(onClose, 900);
  };

  // Un insumo NO debe aparecer en el dropdown si:
  //  - ya está elegido en otra fila de este mismo formulario, o
  //  - ya está vinculado a este examen en la base de datos (receta existente)
  const disponibles = (idxActual) =>
    insumos.filter(i => {
      const id = String(i.id_insumo);
      if (id === String(filas[idxActual].id_insumo)) return true;
      if (idsYaVinculados.includes(id)) return false;
      return !elegidos.includes(id);
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Banner */}
      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "0.75rem 1rem" }}>
        <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#1E40AF" }}>
          🔗 Elige el examen y agrega <strong>todos los insumos</strong> que consume de una sola vez.
          El sistema los vinculará en paralelo y descontará el stock automáticamente al procesar cada orden.
        </p>
      </div>

      {/* Selector de examen */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <label style={flabel}>Examen *</label>
        <select style={finput} value={idExamen} onChange={e => handleCambiarExamen(e.target.value)}>
          <option value="">-- Seleccionar examen --</option>
          {examenes.map(e => (
            <option key={e.id_examen} value={e.id_examen}>{e.nombre_examen}</option>
          ))}
        </select>
      </div>

      {/* Resumen de insumos ya vinculados a este examen — editable */}
      {idExamen && (
        yaVinculados.length > 0 ? (
          <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "8px", padding: "0.65rem 0.9rem" }}>
            <p style={{ margin: "0 0 0.4rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              ✓ Este examen ya tiene {yaVinculados.length} insumo{yaVinculados.length !== 1 ? "s" : ""} vinculado{yaVinculados.length !== 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              {yaVinculados.map(r => (
                <div key={r.id_examen_insumo} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem",
                  background: "#DCFCE7", borderRadius: "8px", padding: "0.3rem 0.4rem 0.3rem 0.7rem",
                }}>
                  <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", fontWeight: 600, color: "#166534" }}>
                    {r.nombre_insumo || `Insumo #${r.id_insumo}`}
                  </span>

                  {editandoId === r.id_examen_insumo ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <input
                        type="number" min="1" autoFocus value={cantEdit}
                        onChange={e => setCantEdit(+e.target.value)}
                        onKeyDown={e => e.key === "Enter" && guardarEdicion(r)}
                        style={{ ...finput, width: "64px", fontSize: "0.78rem", padding: "0.25rem 0.4rem", textAlign: "center" }}
                      />
                      <button
                        onClick={() => guardarEdicion(r)} disabled={guardandoEdit}
                        title="Guardar cantidad"
                        style={{ background: "#166534", color: "#FFF", border: "none", borderRadius: "5px", width: "26px", height: "26px", cursor: "pointer", fontSize: "0.75rem" }}
                      >✓</button>
                      <button
                        onClick={() => setEditandoId(null)} disabled={guardandoEdit}
                        title="Cancelar"
                        style={{ background: "#FFF", color: "#6B7280", border: "1px solid #D1D5DB", borderRadius: "5px", width: "26px", height: "26px", cursor: "pointer", fontSize: "0.75rem" }}
                      >✕</button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <span style={{
                        fontFamily: "'Barlow', sans-serif", fontSize: "0.74rem", fontWeight: 700,
                        background: "#166534", color: "#FFF", padding: "0.15rem 0.55rem", borderRadius: "20px",
                      }}>
                        {r.cantidad_usada}
                      </span>
                      <button
                        onClick={() => empezarEdicion(r)}
                        title="Editar cantidad"
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", color: "#166534", padding: "0.1rem 0.2rem" }}
                      >✏️</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p style={{ margin: "0.5rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#15803D" }}>
              No aparecen en la lista de abajo. Usa ✏️ para cambiar la cantidad de un insumo ya vinculado.
            </p>
          </div>
        ) : (
          <div style={{ background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: "8px", padding: "0.6rem 0.9rem" }}>
            <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#92400E" }}>
              Este examen todavía no tiene insumos vinculados.
            </p>
          </div>
        )
      )}

      {/* Filas de insumos */}
      <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "0.75rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <label style={flabel}>Insumos que consume ({filas.length})</label>
          <button onClick={agregarFila} style={{
            padding: "0.3rem 0.8rem", background: "#EFF6FF", color: "#1E40AF",
            border: "1px solid #BFDBFE", borderRadius: "6px", cursor: "pointer",
            fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.78rem",
          }}>+ Agregar insumo</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 32px", gap: "0.5rem", marginBottom: "0.4rem", padding: "0 0.1rem" }}>
          <span style={{ ...flabel, fontSize: "0.67rem" }}>Insumo</span>
          <span style={{ ...flabel, fontSize: "0.67rem" }}>Cantidad</span>
          <span />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          {filas.map((fila, idx) => {
            const insumoSel = insumos.find(i => String(i.id_insumo) === String(fila.id_insumo));
            return (
              <div key={idx} style={{
                display: "grid", gridTemplateColumns: "1fr 110px 32px",
                gap: "0.5rem", alignItems: "center",
                background: "#F8FAFC", borderRadius: "8px", padding: "0.45rem 0.6rem",
                border: "1px solid #E2E8F0",
              }}>
                <select
                  style={{ ...finput, fontSize: "0.8rem", padding: "0.4rem 0.5rem" }}
                  value={fila.id_insumo}
                  onChange={e => setFila(idx, "id_insumo", e.target.value)}
                >
                  <option value="">-- Insumo --</option>
                  {disponibles(idx).map(i => (
                    <option key={i.id_insumo} value={i.id_insumo}>
                      {i.nombre} ({i.unidad_medida})
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <input
                    type="number" min="1" value={fila.cantidad_usada}
                    onChange={e => setFila(idx, "cantidad_usada", +e.target.value)}
                    style={{ ...finput, fontSize: "0.82rem", padding: "0.4rem 0.5rem", textAlign: "center" }}
                  />
                  {insumoSel && (
                    <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.68rem", color: "#9CA3AF", whiteSpace: "nowrap" }}>
                      {insumoSel.unidad_medida}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => quitarFila(idx)}
                  disabled={filas.length === 1}
                  title="Quitar este insumo"
                  style={{
                    background: filas.length === 1 ? "#F3F4F6" : "#FEE2E2",
                    border: "none", borderRadius: "6px", width: "30px", height: "30px",
                    cursor: filas.length === 1 ? "default" : "pointer",
                    fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center",
                    color: filas.length === 1 ? "#D1D5DB" : "#991B1B",
                  }}
                >✕</button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Resumen */}
      {filas.filter(f => f.id_insumo && f.cantidad_usada > 0).length > 0 && (
        <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "8px", padding: "0.6rem 0.85rem" }}>
          <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#166534", fontWeight: 600 }}>
            ✅ Se vincularán <strong>{filas.filter(f => f.id_insumo && f.cantidad_usada > 0).length}</strong> insumo(s) al examen seleccionado
          </p>
        </div>
      )}

      {/* Feedback progreso */}
      {progreso && (
        <div style={{
          background: progreso.err === 0 ? "#D1FAE5" : "#FEF3C7",
          border: `1px solid ${progreso.err === 0 ? "#86EFAC" : "#F59E0B"}`,
          borderRadius: "8px", padding: "0.6rem 0.85rem",
        }}>
          <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem",
            color: progreso.err === 0 ? "#065F46" : "#92400E", fontWeight: 600 }}>
            {progreso.err === 0
              ? `✅ ${progreso.ok} vinculación(es) guardadas correctamente`
              : `⚠️ ${progreso.ok} correctas · ${progreso.err} con error — revisa los insumos duplicados`}
          </p>
        </div>
      )}

      <div style={footerRow}>
        <button onClick={onClose} style={btnSec}>Cancelar</button>
        <button onClick={submit} disabled={saving} style={btnPrimary}>
          {saving
            ? "Vinculando…"
            : `🔗 Vincular ${filas.filter(f => f.id_insumo).length} insumo(s)`}
        </button>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function AdminInventario() {
  const [insumos,      setInsumos]      = useState([]);
  const [categorias,   setCategorias]   = useState([]);
  const [alertas,      setAlertas]      = useState([]);
  const [movimientos,  setMovimientos]  = useState([]);
  const [examenes,     setExamenes]     = useState([]);
  const [recetas,      setRecetas]      = useState([]);
  const [tiposMuestra, setTiposMuestra] = useState([]);
  // Panel tipos de muestra (pestaña propia junto a Insumos)
  const [nuevoTipo,    setNuevoTipo]    = useState("");
  const [savingTipo,   setSavingTipo]   = useState(false);

  const [usosAdicionales, setUsosAdicionales] = useState([]);
  const [pendientesUA,    setPendientesUA]    = useState(0);
  const [uaProcesando,    setUaProcesando]    = useState(null);
  const [uaModalRechazo,  setUaModalRechazo]  = useState(null);  // reporte seleccionado
  const [uaMotivoRechazo, setUaMotivoRechazo] = useState("");
  const [uaFiltro,        setUaFiltro]        = useState("todos");
  const [tab,       setTab]       = useState("insumos");
  const [buscar,    setBuscar]    = useState({ insumos: "", categorias: "", recetas: "", movimientos: "" });
  const [modal,     setModal]     = useState(null);
  const [sel,       setSel]       = useState(null);
  const [toast,     setToast]     = useState(null);
  // Modales diseñados (reemplazan alert / window.confirm nativos)
  const [notifModal,   setNotifModal]   = useState(null); // { tipo, titulo, mensaje }
  const [confirmModal, setConfirmModal] = useState(null); // { titulo, mensaje, onOk }
  const showNotif   = (titulo, mensaje, tipo = "error") => setNotifModal({ tipo, titulo, mensaje });
  const showConfirm = (titulo, mensaje, onOk) => setConfirmModal({ titulo, mensaje, onOk });
  // Manual de usuario
  const [showManual, setShowManual] = useState(false);
  // Filtro tipo movimiento
  const [tipoMovFiltro, setTipoMovFiltro] = useState("TODOS");
  // Paginación movimientos
  const MOV_PAGE = 50;
  const [movPage, setMovPage] = useState(1);
  // Última actualización
  const [ultimaActualizacion, setUltimaActualizacion] = useState(null);

  // ── CARGA ─────────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [ins, cats, alts, movs, exs, recs, tipos, uas] = await Promise.allSettled([
        api.getInsumos(), api.getCategorias(), api.getAlertas(),
        api.getMovimientos(), api.getExamenes(), api.getRecetas(),
        api.getTiposMuestra(), api.getUsosAdicionales(),
      ]);
      if (ins.status   === "fulfilled") setInsumos(Array.isArray(ins.value)    ? ins.value   : []);
      if (cats.status  === "fulfilled") setCategorias(Array.isArray(cats.value)? cats.value  : []);
      if (alts.status  === "fulfilled") setAlertas(Array.isArray(alts.value)   ? alts.value  : []);
      if (movs.status  === "fulfilled") { setMovimientos(Array.isArray(movs.value) ? movs.value : []); setMovPage(1); }
      if (exs.status   === "fulfilled") setExamenes(Array.isArray(exs.value)   ? exs.value   : []);
      if (recs.status  === "fulfilled") setRecetas(Array.isArray(recs.value)   ? recs.value  : []);
      if (tipos.status === "fulfilled") setTiposMuestra(Array.isArray(tipos.value) ? tipos.value : []);
      if (uas.status   === "fulfilled") {
        const listaUA = Array.isArray(uas.value) ? uas.value : [];
        setUsosAdicionales(listaUA);
        setPendientesUA(listaUA.filter(u => u.estado === "USO_ADICIONAL_PENDIENTE").length);
      }
      setUltimaActualizacion(new Date());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // ── TOAST ─────────────────────────────────────────────────────────────────
  const toastOk  = (texto) => { setToast({ tipo: "ok",  texto }); setTimeout(() => setToast(null), 3500); };
  const toastErr = (texto) => { setToast({ tipo: "err", texto }); setTimeout(() => setToast(null), 4000); };

  // ── HELPERS BÚSQUEDA ──────────────────────────────────────────────────────
  const getBuscar = (t) => buscar[t] || "";
  const setBuscarTab = (t, v) => setBuscar(prev => ({ ...prev, [t]: v }));

  // ── HANDLERS INSUMOS ──────────────────────────────────────────────────────
  const handleCrear = async (data) => {
    await api.crear(data); await cargar(); toastOk("Insumo creado correctamente.");
  };
  const handleEditar = async (data) => {
    await api.actualizar(sel.id_insumo, data); await cargar(); toastOk("Insumo actualizado.");
  };
  const handleEliminar = async (ins) => {
    showConfirm(
      "¿Desactivar insumo?",
      `El insumo "${ins.nombre}" quedará oculto pero su historial de movimientos se conservará.`,
      async () => {
        try { await api.eliminar(ins.id_insumo); await cargar(); toastOk("Insumo desactivado."); }
        catch { toastErr("Error al desactivar el insumo."); }
      }
    );
  };
  const handleMovimiento = async (data) => {
    await api.movimiento(data);
    await cargar();
    // Actualizar el insumo seleccionado en memoria para que el modal muestre stock correcto
    const insActualizado = await api.getInsumos().catch(() => null);
    if (insActualizado) {
      const nuevo = insActualizado.find(i => i.id_insumo === data.id_insumo);
      if (nuevo) setSel(nuevo);
    }
    toastOk("Movimiento registrado y stock actualizado.");
  };

  // ── HANDLERS CATEGORÍAS ───────────────────────────────────────────────────
  const handleCrearCat = async (data) => {
    await api.crearCategoria(data); await cargar(); toastOk("Categoría creada correctamente.");
  };
  const handleEditarCat = async (data) => {
    await api.actualizarCat(sel.id_categoria_insumo, data); await cargar(); toastOk("Categoría actualizada.");
  };
  const handleEliminarCat = async (cat) => {
    showConfirm(
      "¿Eliminar categoría?",
      `"${cat.nombre}" solo puede eliminarse si no tiene insumos activos asociados.`,
      async () => {
        try { await api.eliminarCat(cat.id_categoria_insumo); await cargar(); toastOk("Categoría eliminada."); }
        catch (e) { toastErr(e?.response?.data?.error || "No se puede eliminar: tiene insumos activos."); }
      }
    );
  };

  // ── HANDLERS RECETAS ──────────────────────────────────────────────────────
  const handleReceta = async (data) => {
    await api.crearReceta(data);
    api.getRecetas().then(r => setRecetas(Array.isArray(r) ? r : [])).catch(() => {});
  };
  const handleRecetaClose = async () => {
    setModal(null); await cargar(); toastOk("Vinculaciones guardadas. El descuento automático ya está activo.");
  };
  const handleEliminarReceta = async (id) => {
    showConfirm(
      "¿Eliminar vinculación?",
      "El examen dejará de descontar este insumo automáticamente.",
      async () => {
        try { await api.eliminarReceta(id); await cargar(); toastOk("Vinculación eliminada."); }
        catch { toastErr("Error al eliminar la vinculación."); }
      }
    );
  };

  // ── HANDLERS TIPOS DE MUESTRA ─────────────────────────────────────────────
  const handleCrearTipo = async () => {
    if (!nuevoTipo.trim()) return;
    setSavingTipo(true);
    try {
      await api.crearTipoMuestra({ nombre: nuevoTipo.trim() });
      setNuevoTipo("");
      const tipos = await api.getTiposMuestra();
      setTiposMuestra(Array.isArray(tipos) ? tipos : []);
      toastOk(`Tipo "${nuevoTipo.trim()}" creado.`);
    } catch (e) { toastErr(e?.response?.data?.error || "Error al crear tipo de muestra"); }
    finally { setSavingTipo(false); }
  };
  const handleEliminarTipo = async (tipo) => {
    showConfirm(
      "¿Eliminar tipo de muestra?",
      `"${tipo.nombre}" no puede eliminarse si hay insumos activos con este tipo.`,
      async () => {
        try {
          await api.eliminarTipoMuestra(tipo.id_tipo_muestra);
          const tipos = await api.getTiposMuestra();
          setTiposMuestra(Array.isArray(tipos) ? tipos : []);
          toastOk("Tipo eliminado.");
        } catch (e) { toastErr(e?.response?.data?.error || "No se puede eliminar: tiene insumos activos."); }
      }
    );
  };

  // ── FILTROS ───────────────────────────────────────────────────────────────
  const q = getBuscar(tab);

  const insumosFiltrados = insumos.filter(i =>
    i.nombre?.toLowerCase().includes(getBuscar("insumos").toLowerCase()) ||
    i.categoria_nombre?.toLowerCase().includes(getBuscar("insumos").toLowerCase())
  );

  const catsFiltradas = categorias.filter(c =>
    c.nombre?.toLowerCase().includes(getBuscar("categorias").toLowerCase()) ||
    (c.descripcion || "").toLowerCase().includes(getBuscar("categorias").toLowerCase())
  );

  const recetasFiltradas = recetas.filter(r =>
    (r.nombre_examen || "").toLowerCase().includes(getBuscar("recetas").toLowerCase()) ||
    (r.nombre_insumo || "").toLowerCase().includes(getBuscar("recetas").toLowerCase())
  );

  const movsFiltrados = movimientos.filter(m => {
    const textoOk = (
      (m.insumo || m.nombre_insumo || "").toLowerCase().includes(getBuscar("movimientos").toLowerCase()) ||
      (m.observacion || "").toLowerCase().includes(getBuscar("movimientos").toLowerCase()) ||
      (m.usuario_nombre || m.username || "").toLowerCase().includes(getBuscar("movimientos").toLowerCase())
    );
    const tipoOk = tipoMovFiltro === "TODOS" || m.tipo_movimiento === tipoMovFiltro;
    return textoOk && tipoOk;
  });

  // Paginación movimientos
  const movsPaginados   = movsFiltrados.slice(0, movPage * MOV_PAGE);
  const hayMasMov       = movsFiltrados.length > movPage * MOV_PAGE;

  const criticos = insumos.filter(i => i.stock_actual <= i.stock_minimo).length;

  // ── PESTAÑAS ──────────────────────────────────────────────────────────────
  const tabs = [
    ["insumos",       `📦 Insumos (${insumos.length})`],
    ["tipos",         `🧪 Tipos de Muestra (${tiposMuestra.length})`],
    ["categorias",    `🏷️ Categorías (${categorias.length})`],
    ["recetas",       `🔗 Recetas (${recetas.length})`],
    ["movimientos",   `📋 Movimientos (${movimientos.length})`],
    ["alertas",       alertas.length > 0 ? `⚠️ Alertas (${alertas.length})` : "⚠️ Alertas"],
    ["usos",          pendientesUA > 0 ? `📋 Usos Adicionales (${pendientesUA} ⚠️)` : "📋 Usos Adicionales"],
  ];

  return (
    <div style={page}>
      <Toast msg={toast} />

      {/* ── ENCABEZADO ── */}
      <div style={header}>
        <div>
          <h2 style={pageH2}>Inventario de Insumos</h2>
          <p style={pageSub}>
            {insumos.length} insumos · {categorias.length} categorías
            {criticos > 0
              ? ` · ⚠️ ${criticos} con stock bajo`
              : " · ✅ Stock en orden"}
            {ultimaActualizacion && (
              <span style={{ marginLeft: "0.5rem", color: "#D1D5DB" }}>
                · Act. {ultimaActualizacion.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {/* Botón Manual de Usuario */}
          <button onClick={() => setShowManual(true)} title="Manual de usuario" style={{
            ...btnSec,
            padding: "0.55rem 0.9rem",
            display: "flex", alignItems: "center", gap: "0.4rem",
            borderColor: "#C4B5FD", color: "#5B21B6", background: "#F5F3FF",
          }}>
            📖 <span style={{ fontWeight: 700, fontSize: "0.82rem" }}>Manual</span>
          </button>
          {/* Botón refrescar */}
          <button onClick={cargar} disabled={loading} title="Refrescar datos" style={{
            ...btnSec,
            padding: "0.55rem 0.85rem",
            opacity: loading ? 0.5 : 1,
          }}>
            {loading ? "⏳" : "🔄"}
          </button>

          {tab === "insumos" && (
            <button onClick={() => setModal("crear")} style={btnPrimary}>+ Nuevo Insumo</button>
          )}
          {tab === "categorias" && (
            <button onClick={() => { setSel(null); setModal("crearCat"); }} style={btnPrimary}>
              + Nueva Categoría
            </button>
          )}
          {tab === "recetas" && (
            <button onClick={() => setModal("receta")} style={btnPrimary}>🔗 Nueva Vinculación</button>
          )}
        </div>
      </div>

      {/* ── PESTAÑAS ── */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        {tabs.map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              ...tabBtn,
              ...(tab === key ? tabActive : {}),
              // Alerta roja en tab Alertas si hay pendientes
              ...(key === "alertas" && alertas.length > 0 && tab !== key
                ? { borderColor: "#FCA5A5", color: "#991B1B", background: "#FEF2F2" }
                : {}),
              ...(key === "usos" && pendientesUA > 0 && tab !== key
                ? { borderColor: "#FED7AA", color: "#C2410C", background: "#FFF7ED" }
                : {}),
            }}>
            {lbl}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>
          <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>⏳</p>
          Cargando inventario…
        </div>
      ) : (
        <>
          {/* ═══ PESTAÑA 1 — INSUMOS ══════════════════════════════════════════ */}
          {tab === "insumos" && (
            <>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <input
                  placeholder="🔍 Buscar por nombre o categoría…"
                  value={getBuscar("insumos")}
                  onChange={e => setBuscarTab("insumos", e.target.value)}
                  style={searchInput}
                />
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF" }}>
                  {insumosFiltrados.length} de {insumos.length}
                </span>
              </div>
              <div style={tableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Insumo", "Categoría", "Unidad", "Stock Actual", "Stock Mínimo", "Estado", "Tipo Muestra", "Acciones"].map(c => (
                        <th key={c} style={th}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {insumosFiltrados.length === 0 ? (
                      <EmptyState icon="📦" title="Sin insumos" subtitle={getBuscar("insumos") ? "Ningún insumo coincide con la búsqueda" : "Usa '+ Nuevo Insumo' para registrar el primero"} />
                    ) : insumosFiltrados.map(ins => (
                      <tr key={ins.id_insumo} style={{ borderBottom: "1px solid #F1F5F9" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={td}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "#1F2937" }}>{ins.nombre}</p>
                          {ins.descripcion && (
                            <p style={{ margin: 0, fontSize: "0.72rem", color: "#9CA3AF" }}>
                              {ins.descripcion.length > 45 ? ins.descripcion.slice(0, 45) + "…" : ins.descripcion}
                            </p>
                          )}
                        </td>
                        <td style={td}>{ins.categoria_nombre || <span style={{ color: "#D1D5DB" }}>—</span>}</td>
                        <td style={td}>{ins.unidad_medida}</td>
                        <td style={{
                          ...td,
                          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.05rem",
                          color: ins.stock_actual <= 0 ? "#EF4444" : ins.stock_actual <= ins.stock_minimo ? "#F59E0B" : "#1F2937",
                        }}>{ins.stock_actual}</td>
                        <td style={{ ...td, color: "#6B7280" }}>{ins.stock_minimo}</td>
                        <td style={td}><StockBadge actual={ins.stock_actual} minimo={ins.stock_minimo} /></td>
                        {/* Tipo de Muestra del insumo */}
                        <td style={td}>
                          {ins.tipos_muestra_nombres
                            ? ins.tipos_muestra_nombres.split(",").map((t, i) => (
                                <Chip key={i} bg="#EDE9FE" color="#5B21B6">{t.trim()}</Chip>
                              ))
                            : <span style={{ color: "#E5E7EB", fontSize: "0.75rem" }}>—</span>
                          }
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: "0.4rem" }}>
                            <IconBtn icon="⬆️" title="Registrar Entrada/Salida"
                              onClick={() => { setSel(ins); setModal("movimiento"); }} color="#E88B3A" />
                            <IconBtn icon="✏️" title="Editar insumo"
                              onClick={() => { setSel(ins); setModal("editar"); }} color="#3B82F6" />
                            <IconBtn icon="🗑️" title="Desactivar insumo"
                              onClick={() => handleEliminar(ins)} color="#EF4444" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ═══ PESTAÑA 2 — CATEGORÍAS ═══════════════════════════════════════ */}
          {tab === "categorias" && (
            <>
              <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "10px", padding: "0.9rem 1.1rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.2rem" }}>🏷️</span>
                <div>
                  <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Categorías de Insumos
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#16A34A" }}>
                    Organiza los insumos del inventario agrupándolos por tipo. Una categoría solo puede eliminarse si no tiene insumos activos vinculados.
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <input
                  placeholder="🔍 Buscar categoría…"
                  value={getBuscar("categorias")}
                  onChange={e => setBuscarTab("categorias", e.target.value)}
                  style={searchInput}
                />
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF" }}>
                  {catsFiltradas.length} de {categorias.length}
                </span>
              </div>

              <div style={tableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["#", "Nombre", "Descripción", "Insumos vinculados", "Acciones"].map(c => (
                        <th key={c} style={th}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {catsFiltradas.length === 0 ? (
                      <EmptyState icon="🏷️" title="Sin categorías"
                        subtitle={categorias.length === 0 ? "Usa '+ Nueva Categoría' para crear la primera" : "Ninguna categoría coincide con la búsqueda"} />
                    ) : catsFiltradas.map((cat, idx) => {
                      const vinculados = insumos.filter(i => i.id_categoria_insumo === cat.id_categoria_insumo);
                      const conStockBajo = vinculados.filter(i => i.stock_actual <= i.stock_minimo).length;
                      return (
                        <tr key={cat.id_categoria_insumo}
                          style={{ borderBottom: "1px solid #F1F5F9" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ ...td, color: "#D1D5DB", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{idx + 1}</td>
                          <td style={td}>
                            <span style={{ fontWeight: 700, color: "#1F2937", fontSize: "0.88rem" }}>{cat.nombre}</span>
                          </td>
                          <td style={{ ...td, color: "#6B7280", fontSize: "0.8rem", maxWidth: "280px" }}>
                            {cat.descripcion || <span style={{ color: "#D1D5DB" }}>Sin descripción</span>}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            {vinculados.length > 0 ? (
                              <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", flexWrap: "wrap" }}>
                                <Chip bg="#DBEAFE" color="#1E40AF">{vinculados.length} insumo{vinculados.length !== 1 ? "s" : ""}</Chip>
                                {conStockBajo > 0 && <Chip bg="#FEF3C7" color="#92400E">⚠️ {conStockBajo} bajo mínimo</Chip>}
                              </div>
                            ) : (
                              <Chip bg="#F3F4F6" color="#9CA3AF">Sin insumos</Chip>
                            )}
                          </td>
                          <td style={td}>
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              <IconBtn icon="✏️" title="Editar categoría"
                                onClick={() => { setSel(cat); setModal("editarCat"); }} color="#3B82F6" />
                              <IconBtn icon="🗑️"
                                title={vinculados.length > 0 ? "No se puede eliminar: tiene insumos activos" : "Eliminar categoría"}
                                onClick={() => handleEliminarCat(cat)} color="#EF4444"
                                disabled={vinculados.length > 0} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tarjetas resumen */}
              {categorias.length > 0 && (
                <div style={{ marginTop: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.75rem" }}>
                  {categorias.map(cat => {
                    const vinculados   = insumos.filter(i => i.id_categoria_insumo === cat.id_categoria_insumo);
                    const conStockBajo = vinculados.filter(i => i.stock_actual <= i.stock_minimo).length;
                    return (
                      <div key={cat.id_categoria_insumo} style={{
                        background: "#FFF", borderRadius: "10px", border: "1px solid #F1F5F9",
                        padding: "0.85rem 1rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                      }}>
                        <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.95rem", color: "#1F2937", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                          {cat.nombre}
                        </p>
                        <p style={{ margin: "0.4rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF" }}>
                          {vinculados.length} insumo{vinculados.length !== 1 ? "s" : ""}
                          {conStockBajo > 0 && (
                            <span style={{ color: "#F59E0B", fontWeight: 700 }}> · ⚠️ {conStockBajo} bajo mínimo</span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ═══ PESTAÑA 2 — TIPOS DE MUESTRA ════════════════════════════════ */}
          {tab === "tipos" && (
            <>
              <div style={{ background: "#F5F3FF", border: "1px solid #C4B5FD", borderRadius: "10px", padding: "0.9rem 1.1rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.3rem" }}>🧪</span>
                <div>
                  <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#5B21B6", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Catálogo de Tipos de Muestra
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#7C3AED" }}>
                    Define los tipos de muestra del laboratorio. Al crear o editar un insumo,
                    podrás asignarle uno de estos tipos para que la orden sepa qué recolectar.
                  </p>
                </div>
              </div>

              {/* ── Agregar nuevo tipo ── */}
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1.25rem", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <p style={{ margin: "0 0 0.75rem", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.8rem", color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  + Nuevo Tipo de Muestra
                </p>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                  <input
                    placeholder="Ej: Sangre venosa, Orina, Heces, Secreción…"
                    value={nuevoTipo}
                    onChange={e => setNuevoTipo(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCrearTipo()}
                    style={{ ...finput, maxWidth: "360px" }}
                  />
                  <button
                    onClick={handleCrearTipo}
                    disabled={savingTipo || !nuevoTipo.trim()}
                    style={{
                      ...btnPrimary,
                      opacity: savingTipo || !nuevoTipo.trim() ? 0.5 : 1,
                      cursor: savingTipo || !nuevoTipo.trim() ? "not-allowed" : "pointer",
                    }}>
                    {savingTipo ? "Guardando…" : "+ Agregar"}
                  </button>
                </div>
              </div>

              {/* ── Lista de tipos ── */}
              <div style={tableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F5F3FF" }}>
                      {["#", "Nombre del Tipo", "Insumos con este tipo", "Acciones"].map(c => (
                        <th key={c} style={{ ...th, color: "#5B21B6" }}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tiposMuestra.length === 0 ? (
                      <EmptyState icon="🧪" title="Sin tipos de muestra"
                        subtitle="Agrega los tipos que maneja tu laboratorio (sangre venosa, orina, heces…)" />
                    ) : tiposMuestra.map((tipo, idx) => {
                      const insumosConTipo = insumos.filter(i => i.id_tipo_muestra === tipo.id_tipo_muestra);
                      return (
                        <tr key={tipo.id_tipo_muestra} style={{ borderBottom: "1px solid #F1F5F9" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ ...td, color: "#D1D5DB", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>{idx + 1}</td>
                          <td style={td}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <span style={{
                                width: "8px", height: "8px", borderRadius: "50%",
                                background: "#7C3AED", flexShrink: 0,
                              }} />
                              <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1F2937" }}>
                                {tipo.nombre}
                              </span>
                            </div>
                          </td>
                          <td style={td}>
                            {insumosConTipo.length === 0 ? (
                              <Chip bg="#F3F4F6" color="#9CA3AF">Sin insumos asignados</Chip>
                            ) : (
                              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                                <Chip bg="#EDE9FE" color="#5B21B6">{insumosConTipo.length} insumo{insumosConTipo.length !== 1 ? "s" : ""}</Chip>
                                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#9CA3AF", alignSelf: "center" }}>
                                  {insumosConTipo.slice(0, 3).map(i => i.nombre).join(", ")}
                                  {insumosConTipo.length > 3 && "…"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td style={td}>
                            <IconBtn
                              icon="🗑️"
                              title={insumosConTipo.length > 0
                                ? "No se puede eliminar: tiene insumos activos asignados"
                                : "Eliminar tipo de muestra"}
                              onClick={() => handleEliminarTipo(tipo)}
                              color="#EF4444"
                              disabled={insumosConTipo.length > 0}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tiposMuestra.length > 0 && (
                <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.73rem", color: "#9CA3AF", marginTop: "0.6rem" }}>
                  💡 Para asignar un tipo de muestra a un insumo, usa ✏️ Editar en la pestaña Insumos.
                </p>
              )}
            </>
          )}

          {/* ═══ PESTAÑA 3 — RECETAS ══════════════════════════════════════════ */}
          {tab === "recetas" && (
            <>
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "0.9rem 1.1rem", marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.3rem" }}>🔗</span>
                <div>
                  <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Descuento Automático de Insumos
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#3B82F6" }}>
                    Cada vinculación define cuántas unidades se descuentan al procesar un examen.
                    El trigger <strong>tr_inventario_consolidado_orden</strong> ejecuta el descuento al pasar a "En Proceso".
                    El tipo de muestra se toma directo del insumo — configúralo en <strong>Insumos → Editar</strong>.
                  </p>
                </div>
              </div>

              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
                <input
                  placeholder="🔍 Buscar por examen o insumo…"
                  value={getBuscar("recetas")}
                  onChange={e => setBuscarTab("recetas", e.target.value)}
                  style={searchInput}
                />
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF" }}>
                  {recetasFiltradas.length} de {recetas.length}
                </span>
              </div>

              <div style={tableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Examen", "Insumo Vinculado", "Cantidad", "Tipo Muestra del Insumo", "Acciones"].map(c => (
                        <th key={c} style={th}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recetasFiltradas.length === 0 ? (
                      <EmptyState icon="🔗" title="Sin vinculaciones"
                        subtitle={recetas.length === 0 ? "Usa '+ Nueva Vinculación' para comenzar" : "Ninguna vinculación coincide con la búsqueda"} />
                    ) : recetasFiltradas.map((r, i) => {
                      const tipoNombre = r.tipo_muestra_nombre;
                      return (
                        <tr key={r.id_examen_insumo || i} style={{ borderBottom: "1px solid #F1F5F9" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

                          {/* Examen */}
                          <td style={td}>
                            <span style={{ fontWeight: 600, color: "#1F2937", fontSize: "0.85rem" }}>
                              {r.nombre_examen || `Examen #${r.id_examen}`}
                            </span>
                          </td>

                          {/* Insumo */}
                          <td style={td}>
                            <span style={{ color: "#374151", fontSize: "0.83rem" }}>
                              {r.nombre_insumo || `Insumo #${r.id_insumo}`}
                            </span>
                            <br />
                            <span style={{ fontSize: "0.72rem", color: "#9CA3AF", fontFamily: "'Barlow', sans-serif" }}>
                              {r.unidad_medida || ""}
                            </span>
                          </td>

                          {/* Cantidad */}
                          <td style={{ ...td, textAlign: "center" }}>
                            <span style={{
                              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
                              fontSize: "1.05rem", color: "#E88B3A",
                              background: "#FEF3C7", padding: "0.15rem 0.6rem", borderRadius: "6px",
                            }}>
                              {r.cantidad_usada}
                            </span>
                          </td>

                          {/* Tipo muestra — viene del insumo, solo lectura */}
                          <td style={td}>
                            {tipoNombre
                              ? <Chip bg="#EDE9FE" color="#5B21B6">🧪 {tipoNombre}</Chip>
                              : <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#D1D5DB", fontStyle: "italic" }}>No aplica</span>
                            }
                          </td>

                          {/* Acciones */}
                          <td style={td}>
                            <IconBtn icon="🗑️" title="Eliminar vinculación"
                              onClick={() => handleEliminarReceta(r.id_examen_insumo)} color="#EF4444" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.72rem", color: "#9CA3AF", marginTop: "0.6rem" }}>
                💡 El tipo de muestra se define en cada insumo. Para cambiarlo, ve a la pestaña <strong>Insumos → ✏️ Editar</strong>.
              </p>
            </>
          )}

          {/* ═══ PESTAÑA 4 — MOVIMIENTOS ══════════════════════════════════════ */}
          {tab === "movimientos" && (
            <>
              <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  placeholder="🔍 Buscar por insumo, responsable u observación…"
                  value={getBuscar("movimientos")}
                  onChange={e => setBuscarTab("movimientos", e.target.value)}
                  style={{ ...searchInput, width: "320px" }}
                />
                {/* Filtro tipo */}
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {[["TODOS", "#374151", "#F8FAFC"], ["ENTRADA", "#065F46", "#D1FAE5"], ["SALIDA", "#991B1B", "#FEE2E2"]].map(([val, color, bg]) => (
                    <button key={val} onClick={() => { setTipoMovFiltro(val); setMovPage(1); }} style={{
                      padding: "0.4rem 0.85rem", borderRadius: "8px", cursor: "pointer",
                      fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.75rem",
                      border: tipoMovFiltro === val ? `1.5px solid ${color}` : "1px solid #E2E8F0",
                      background: tipoMovFiltro === val ? bg : "#F8FAFC",
                      color: tipoMovFiltro === val ? color : "#9CA3AF",
                    }}>{val}</button>
                  ))}
                </div>
                <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF", marginLeft: "auto" }}>
                  {movsFiltrados.length} registro{movsFiltrados.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={tableWrap}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC" }}>
                      {["Fecha", "Insumo", "Tipo", "Cantidad", "Responsable", "Observación"].map(c => (
                        <th key={c} style={th}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movsPaginados.length === 0 ? (
                      <EmptyState icon="📋" title="Sin movimientos" subtitle="No hay registros que coincidan con los filtros" />
                    ) : movsPaginados.map((m, i) => {
                      const esEntrada = m.tipo_movimiento === "ENTRADA";
                      return (
                        <tr key={m.id_movimiento || i} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ ...td, fontSize: "0.78rem", color: "#9CA3AF", whiteSpace: "nowrap" }}>
                            {new Date(m.fecha).toLocaleDateString()}{" "}
                            {new Date(m.fecha).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td style={td}>
                            <span style={{ fontWeight: 600, color: "#1F2937" }}>
                              {m.insumo || m.nombre_insumo || `#${m.id_insumo}`}
                            </span>
                          </td>
                          <td style={td}>
                            <Chip bg={esEntrada ? "#D1FAE5" : "#FEE2E2"} color={esEntrada ? "#065F46" : "#991B1B"}>
                              {esEntrada ? "⬆️ ENTRADA" : "⬇️ SALIDA"}
                            </Chip>
                          </td>
                          <td style={{
                            ...td,
                            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1rem",
                            color: esEntrada ? "#10B981" : "#EF4444", textAlign: "center",
                          }}>
                            {esEntrada ? "+" : "-"}{m.cantidad}
                          </td>
                          <td style={{ ...td, fontSize: "0.78rem" }}>{m.usuario_nombre || m.username || "—"}</td>
                          <td style={{ ...td, fontSize: "0.78rem", color: "#6B7280", maxWidth: "200px" }}>
                            {m.observacion || <span style={{ color: "#D1D5DB" }}>Sin observación</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Paginación */}
              {hayMasMov && (
                <div style={{ textAlign: "center", marginTop: "1rem" }}>
                  <button onClick={() => setMovPage(p => p + 1)} style={{
                    ...btnSec, padding: "0.5rem 1.5rem", fontSize: "0.82rem",
                  }}>
                    Ver más ({movsFiltrados.length - movPage * MOV_PAGE} restantes)
                  </button>
                </div>
              )}
            </>
          )}

          {/* ═══ PESTAÑA 5 — ALERTAS ══════════════════════════════════════════ */}
          {tab === "alertas" && (
            <>
              {alertas.length === 0 ? (
                <div style={{ ...tableWrap, padding: "3.5rem", textAlign: "center" }}>
                  <p style={{ fontSize: "2.5rem", margin: "0 0 0.5rem" }}>✅</p>
                  <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#065F46", fontSize: "1rem", letterSpacing: "0.05em" }}>
                    SIN ALERTAS PENDIENTES
                  </p>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#9CA3AF" }}>
                    Todos los insumos tienen stock por encima del nivel mínimo.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "10px", padding: "0.85rem 1.1rem", marginBottom: "1.25rem", display: "flex", gap: "0.6rem", alignItems: "center" }}>
                    <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                    <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#92400E", fontWeight: 600 }}>
                      {alertas.length} insumo{alertas.length !== 1 ? "s" : ""} requiere{alertas.length === 1 ? "" : "n"} reposición urgente.
                    </p>
                  </div>
                  <div style={tableWrap}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#FEF3C7" }}>
                          {["Insumo", "Stock Actual", "Stock Mínimo", "Déficit", "Fecha Alerta", "Estado"].map(c => (
                            <th key={c} style={{ ...th, color: "#92400E" }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {alertas.map((a, i) => {
                          const deficit = Math.max(0, a.stock_minimo - a.stock_actual);
                          return (
                            <tr key={a.id_insumo ?? a.id_reporte ?? i} style={{ borderBottom: "1px solid #FEF3C7" }}>
                              <td style={td}><span style={{ fontWeight: 700, color: "#92400E" }}>{a.insumo}</span></td>
                              <td style={{ ...td, color: "#EF4444", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.05rem" }}>
                                {a.stock_actual}
                              </td>
                              <td style={td}>{a.stock_minimo}</td>
                              <td style={td}><Chip bg="#FEE2E2" color="#991B1B">Necesita {deficit} más</Chip></td>
                              <td style={{ ...td, fontSize: "0.78rem", color: "#9CA3AF" }}>
                                {a.fecha_reporte ? new Date(a.fecha_reporte).toLocaleDateString() : "—"}
                              </td>
                              <td style={td}><Chip bg="#FEF3C7" color="#92400E">{a.estado || "PENDIENTE"}</Chip></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
          {/* ═══ PESTAÑA — USOS ADICIONALES ══════════════════════════════════ */}
          {tab === "usos" && (
            <>
              <div style={{ marginBottom: "1.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                  <div>
                    <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.1rem", color: "#1F2937", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Informes de Usos Adicionales
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "#6B7280", margin: "0.2rem 0 0", fontFamily: "'Barlow', sans-serif" }}>
                      Insumos extra reportados por la analista fuera de la receta automática.
                      {pendientesUA > 0
                        ? <strong style={{ color: "#C2410C" }}> {pendientesUA} pendiente{pendientesUA > 1 ? "s" : ""} de revisión.</strong>
                        : " Todo al día ✅"}
                    </p>
                  </div>
                  <div style={{ display: "flex", background: "#F3F4F6", borderRadius: "8px", padding: "0.2rem", gap: "0.2rem" }}>
                    {[
                      { key: "todos",      label: `Todos (${usosAdicionales.length})` },
                      { key: "pendientes", label: `⏳ Pendientes (${pendientesUA})` },
                    ].map(f => (
                      <button key={f.key} onClick={() => setUaFiltro(f.key)} style={{
                        padding: "0.4rem 0.85rem", border: "none", borderRadius: "6px", cursor: "pointer",
                        fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", fontWeight: 700,
                        background: uaFiltro === f.key ? "#FFF" : "transparent",
                        color: uaFiltro === f.key ? (f.key === "pendientes" ? "#C2410C" : "#1F2937") : "#6B7280",
                        boxShadow: uaFiltro === f.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        transition: "all 0.15s",
                      }}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {pendientesUA > 0 && (
                  <div style={{ marginTop: "0.85rem", background: "#FFF7ED", border: "1.5px solid #FED7AA", borderRadius: "10px", padding: "0.75rem 1.1rem", fontSize: "0.83rem", color: "#92400E", fontFamily: "'Barlow', sans-serif", display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                    <span>Hay <strong>{pendientesUA}</strong> uso{pendientesUA > 1 ? "s" : ""} adicional{pendientesUA > 1 ? "es" : ""} esperando revisión. Si <strong>apruebas</strong>, el stock se descuenta automáticamente. Si <strong>rechazas</strong>, el inventario no cambia.</span>
                  </div>
                )}
              </div>

              {(() => {
                const listaUA = uaFiltro === "pendientes"
                  ? usosAdicionales.filter(u => u.estado === "USO_ADICIONAL_PENDIENTE")
                  : usosAdicionales;
                if (listaUA.length === 0) return (
                  <div style={{ ...tableWrap, padding: "3.5rem", textAlign: "center" }}>
                    <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>📋</p>
                    <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#9CA3AF" }}>
                      {uaFiltro === "pendientes" ? "No hay usos adicionales pendientes." : "Aún no se han registrado usos adicionales."}
                    </p>
                  </div>
                );
                return (
                  <div style={tableWrap}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC" }}>
                          {["Insumo", "Cantidad", "Orden", "Motivo", "Reportado por", "Fecha", "Estado", "Acciones"].map(c => (
                            <th key={c} style={{ ...th, textAlign: c === "Acciones" ? "center" : "left" }}>{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {listaUA.map((r, i) => {
                          const isPend = r.estado === "USO_ADICIONAL_PENDIENTE";
                          const enProc = uaProcesando === r.id_reporte;
                          const badgeMap = {
                            USO_ADICIONAL_PENDIENTE: { bg: "#FEF3C7", color: "#92400E", label: "⏳ Pendiente" },
                            USO_ADICIONAL_APROBADO:  { bg: "#D1FAE5", color: "#065F46", label: "✅ Aprobado" },
                            USO_ADICIONAL_RECHAZADO: { bg: "#FEE2E2", color: "#991B1B", label: "❌ Rechazado" },
                          };
                          const badge = badgeMap[r.estado] || { bg: "#F3F4F6", color: "#374151", label: r.estado };
                          return (
                            <tr key={r.id_reporte} style={{ background: i % 2 === 0 ? "#FFF" : "#FAFAFA", borderTop: "1px solid #F1F5F9", opacity: enProc ? 0.6 : 1 }}>
                              <td style={{ ...td, fontWeight: 700 }}>
                                {r.insumo_nombre}
                                <div style={{ fontSize: "0.72rem", color: "#9CA3AF", fontWeight: 400 }}>Stock: {r.stock_actual} {r.unidad_medida}</div>
                              </td>
                              <td style={td}>
                                <span style={{ fontWeight: 700, color: isPend ? "#C2410C" : "#374151", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1rem" }}>{r.cantidad}</span>
                                <span style={{ fontSize: "0.75rem", color: "#9CA3AF", marginLeft: "0.25rem" }}>{r.unidad_medida}</span>
                              </td>
                              <td style={td}>{r.numero_ticket ? <span style={{ fontWeight: 600 }}>{r.numero_ticket}</span> : <span style={{ color: "#D1D5DB" }}>—</span>}</td>
                              <td style={{ ...td, maxWidth: "180px" }}>
                                <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px" }} title={r.motivo}>{r.motivo || "—"}</span>
                              </td>
                              <td style={{ ...td, fontSize: "0.8rem" }}>{r.reportado_por || r.username_reporta || "—"}</td>
                              <td style={{ ...td, fontSize: "0.76rem", color: "#6B7280", whiteSpace: "nowrap" }}>
                                {new Date(r.fecha_reporte).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
                                <br /><span style={{ color: "#9CA3AF" }}>{new Date(r.fecha_reporte).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}</span>
                              </td>
                              <td style={td}>
                                <span style={{ padding: "0.2rem 0.7rem", borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700, background: badge.bg, color: badge.color, display: "inline-block", whiteSpace: "nowrap" }}>
                                  {badge.label}
                                </span>
                              </td>
                              <td style={{ ...td, textAlign: "center" }}>
                                {isPend ? (
                                  <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center" }}>
                                    <button disabled={enProc}
                                      onClick={async () => {
                                        if (!window.confirm(`¿Aprobar el uso de ${r.cantidad} ${r.unidad_medida} de "${r.insumo_nombre}"?\nEsto descontará esa cantidad del inventario.`)) return;
                                        setUaProcesando(r.id_reporte);
                                        try {
                                          const { data } = await API.post(`/usos-adicionales/${r.id_reporte}/aprobar`);
                                          toastOk(data.msg || "Aprobado correctamente.");
                                          cargar();
                                        } catch(e) { toastErr(e.response?.data?.error || "No se pudo aprobar."); }
                                        finally { setUaProcesando(null); }
                                      }}
                                      style={{ padding: "0.35rem 0.75rem", borderRadius: "7px", background: "#D1FAE5", color: "#065F46", border: "1.5px solid #6EE7B7", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.78rem", opacity: enProc ? 0.5 : 1 }}>
                                      {enProc ? "…" : "✅ Aprobar"}
                                    </button>
                                    <button disabled={enProc}
                                      onClick={() => { setUaModalRechazo(r); setUaMotivoRechazo(""); }}
                                      style={{ padding: "0.35rem 0.75rem", borderRadius: "7px", background: "#FEE2E2", color: "#991B1B", border: "1.5px solid #FCA5A5", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.78rem", opacity: enProc ? 0.5 : 1 }}>
                                      ❌ Rechazar
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>
                                    {r.estado === "USO_ADICIONAL_APROBADO" ? "Stock descontado" : "Sin efecto"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </>
          )}
        </>
      )}

      {/* ── MODAL DE RECHAZO — USO ADICIONAL ── */}
      {uaModalRechazo && (
        <Modal title="❌ Rechazar Uso Adicional" onClose={() => setUaModalRechazo(null)} width="460px">
          <div style={{ padding: "1.25rem" }}>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.87rem", color: "#374151", marginBottom: "1rem" }}>
              Vas a rechazar el uso adicional de <strong>{uaModalRechazo.cantidad} {uaModalRechazo.unidad_medida}</strong> de <strong>"{uaModalRechazo.insumo_nombre}"</strong>.
              El stock <strong>NO</strong> será descontado.
            </p>
            <label style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "0.35rem" }}>
              Motivo del rechazo (opcional)
            </label>
            <textarea rows={3} value={uaMotivoRechazo} onChange={e => setUaMotivoRechazo(e.target.value)}
              placeholder="Ej: El uso no fue autorizado, no corresponde a la receta estándar…"
              style={{ width: "100%", padding: "0.6rem 0.85rem", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontSize: "0.87rem", fontFamily: "'Barlow', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "1.1rem" }}>
              <button onClick={() => setUaModalRechazo(null)}
                style={{ padding: "0.55rem 1.1rem", borderRadius: "8px", background: "#F3F4F6", color: "#374151", border: "1.5px solid #E5E7EB", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem" }}>
                Cancelar
              </button>
              <button
                disabled={uaProcesando === uaModalRechazo.id_reporte}
                onClick={async () => {
                  const id = uaModalRechazo.id_reporte;
                  setUaProcesando(id);
                  try {
                    const { data } = await API.post(`/usos-adicionales/${id}/rechazar`, { motivo_rechazo: uaMotivoRechazo });
                    setUaModalRechazo(null);
                    toastOk(data.msg || "Uso adicional rechazado.");
                    cargar();
                  } catch(e) { toastErr(e.response?.data?.error || "No se pudo rechazar."); }
                  finally { setUaProcesando(null); }
                }}
                style={{ padding: "0.55rem 1.25rem", borderRadius: "8px", background: "#DC2626", color: "#FFF", border: "none", cursor: "pointer", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.95rem", opacity: uaProcesando === uaModalRechazo.id_reporte ? 0.6 : 1 }}>
                {uaProcesando === uaModalRechazo.id_reporte ? "Rechazando…" : "Confirmar Rechazo"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── MODALES ── */}
      {modal === "crear" && (
        <Modal title="➕ Nuevo Insumo" onClose={() => setModal(null)}>
          <FormInsumo categorias={categorias} tiposMuestra={tiposMuestra} onSave={handleCrear} onClose={() => setModal(null)} onAlert={showNotif} />
        </Modal>
      )}
      {modal === "editar" && sel && (
        <Modal title="✏️ Editar Insumo" onClose={() => setModal(null)}>
          <FormInsumo initial={sel} categorias={categorias} tiposMuestra={tiposMuestra} onSave={handleEditar} onClose={() => setModal(null)} onAlert={showNotif} />
        </Modal>
      )}
      {modal === "movimiento" && sel && (
        <Modal title="📦 Registrar Movimiento de Stock" onClose={() => setModal(null)}>
          <FormMovimiento insumo={sel} onSave={handleMovimiento} onClose={() => setModal(null)} onAlert={showNotif} />
        </Modal>
      )}
      {modal === "receta" && (
        <Modal title="🔗 Configurar Receta de Insumos" onClose={handleRecetaClose} width="620px">
          <FormReceta insumos={insumos} examenes={examenes} recetas={recetas} onSave={handleReceta} onClose={handleRecetaClose} onAlert={showNotif} />
        </Modal>
      )}
      {modal === "crearCat" && (
        <Modal title="🏷️ Nueva Categoría de Insumo" onClose={() => setModal(null)} width="480px">
          <FormCategoria onSave={handleCrearCat} onClose={() => setModal(null)} onAlert={showNotif} />
        </Modal>
      )}
      {modal === "editarCat" && sel && (
        <Modal title="✏️ Editar Categoría" onClose={() => setModal(null)} width="480px">
          <FormCategoria initial={sel} onSave={handleEditarCat} onClose={() => setModal(null)} onAlert={showNotif} />
        </Modal>
      )}

      {/* ── MODAL NOTIFICACIÓN ── */}
      {notifModal && (
        <div style={overlay}>
          <div style={{ ...modalBox, width: "400px", maxWidth: "95vw" }}>
            <div style={{
              background: notifModal.tipo === "error" ? "#FEF2F2" : "#F0FDF4",
              borderBottom: `1px solid ${notifModal.tipo === "error" ? "#FECACA" : "#BBF7D0"}`,
              padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem",
            }}>
              <span style={{ fontSize: "1.4rem" }}>{notifModal.tipo === "error" ? "⚠️" : "✅"}</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1rem",
                color: notifModal.tipo === "error" ? "#DC2626" : "#059669", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {notifModal.titulo}
              </span>
            </div>
            <div style={{ padding: "1rem 1.25rem" }}>
              <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.87rem", color: "#374151", lineHeight: 1.6 }}>
                {notifModal.mensaje}
              </p>
            </div>
            <div style={{ padding: "0 1.25rem 1rem", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setNotifModal(null)} style={{
                ...btnPrimary,
                background: notifModal.tipo === "error" ? "#DC2626" : "#059669",
              }}>Entendido</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMACIÓN ── */}
      {confirmModal && (
        <div style={overlay}>
          <div style={{ ...modalBox, width: "420px", maxWidth: "95vw" }}>
            <div style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA", padding: "1.1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.4rem" }}>🗑️</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1rem",
                color: "#DC2626", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {confirmModal.titulo}
              </span>
            </div>
            <div style={{ padding: "1rem 1.25rem" }}>
              <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.87rem", color: "#374151", lineHeight: 1.6 }}>
                {confirmModal.mensaje}
              </p>
            </div>
            <div style={{ padding: "0 1.25rem 1rem", display: "flex", gap: "0.65rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmModal(null)} style={btnSec}>Cancelar</button>
              <button onClick={async () => { await confirmModal.onOk(); setConfirmModal(null); }}
                style={{ ...btnPrimary, background: "#DC2626" }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MANUAL DE USUARIO (interactivo paso a paso) ── */}
      {showManual && (
        <ManualUsuario onClose={() => setShowManual(false)} />
      )}
    </div>
  );
}

// ─── MANUAL INTERACTIVO ───────────────────────────────────────────────────────
function ManualUsuario({ onClose }) {
  const [paso, setPaso] = useState(0);

  const pasos = [
    {
      num: 1, icon: "🏷️", color: "#16A34A", bg: "#F0FDF4", border: "#86EFAC", textColor: "#14532D",
      titulo: "Registra las Categorías",
      que: "Las categorías agrupan tus insumos por tipo (Reactivos, Material descartable, Equipos, etc.).",
      como: [
        "Ve a la pestaña 🏷️ Categorías.",
        "Haz clic en + Nueva Categoría.",
        "Ingresa el nombre y una descripción opcional.",
        "Guarda. Repite para cada tipo de agrupación que necesites.",
      ],
      porQue: "Sin categorías, todos los insumos estarán sin clasificar. Hazlo primero para que estén disponibles al crear insumos.",
    },
    {
      num: 2, icon: "🧪", color: "#7C3AED", bg: "#F5F3FF", border: "#C4B5FD", textColor: "#3B0764",
      titulo: "Registra los Tipos de Muestra",
      que: "Son los tipos de muestra biológica que se usan en el laboratorio: Tubo EDTA, Hisopo, Lanceta, Tubo citrato, etc.",
      como: [
        "Ve a la pestaña 🧪 Tipos de Muestra.",
        "Escribe el nombre del tipo en el campo de texto.",
        "Haz clic en Agregar.",
        "Repite por cada tipo que manejes.",
      ],
      porQue: "Solo se asignan a insumos que sirven para tomar muestras (tubos, hisopos, lancetas). Reactivos o guantes no llevan tipo de muestra.",
    },
    {
      num: 3, icon: "📦", color: "#B45309", bg: "#FFF7ED", border: "#FED7AA", textColor: "#451A03",
      titulo: "Registra los Insumos",
      que: "Cada insumo es un producto físico del inventario: reactivos, tubos, guantes, jeringas, etc.",
      como: [
        "Ve a la pestaña 📦 Insumos.",
        "Haz clic en + Nuevo Insumo.",
        "Completa: nombre, unidad de medida (ml, unidades, mg…), categoría y tipo de muestra si aplica.",
        "Define el Stock inicial (cantidad actual) y el Stock mínimo (punto de alerta).",
        "Guarda. El insumo aparecerá en la tabla con su estado (✅ OK / ⚠️ Bajo / ❌ Sin stock).",
      ],
      porQue: "El stock inicial se registra solo al crear. Para modificarlo después, usa Movimientos (⬆️ en la tabla).",
    },
    {
      num: 4, icon: "🔗", color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD", textColor: "#0C4A6E",
      titulo: "Configura las Recetas",
      que: "Una receta define qué insumos —y en qué cantidad— se consumen cada vez que se realiza un examen.",
      como: [
        "Ve a la pestaña 🔗 Recetas.",
        "Haz clic en 🔗 Nueva Vinculación.",
        "Selecciona el examen del listado.",
        "Agrega filas: elige el insumo y la cantidad que se usa por cada examen.",
        "Guarda. El descuento de stock quedará activo automáticamente.",
      ],
      porQue: "Cuando el sistema registre ese examen, los insumos vinculados se descontarán solos. Sin receta, el stock no baja automáticamente.",
    },
    {
      num: 5, icon: "📋", color: "#374151", bg: "#F8FAFC", border: "#E2E8F0", textColor: "#111827",
      titulo: "Gestiona los Movimientos",
      que: "Registra manualmente entradas (compras/reposiciones) y salidas (uso/merma) de cualquier insumo.",
      como: [
        "En la pestaña 📦 Insumos, haz clic en el ícono ⬆️ del insumo que quieres mover.",
        "Selecciona Entrada (suma stock) o Salida (resta stock).",
        "Indica la cantidad y una observación opcional.",
        "Guarda. El stock se actualizará de inmediato.",
        "En la pestaña 📋 Movimientos verás el historial completo con usuario y fecha.",
      ],
      porQue: "Usa esto para reponer stock de compras, corregir diferencias de conteo o registrar descartes.",
    },
    {
      num: 6, icon: "⚠️", color: "#92400E", bg: "#FFFBEB", border: "#FCD34D", textColor: "#451A03",
      titulo: "Revisa las Alertas",
      que: "Las alertas muestran los insumos cuyo stock actual cayó por debajo del mínimo configurado.",
      como: [
        "La pestaña ⚠️ Alertas se resalta en rojo cuando hay insumos críticos.",
        "Revísala periódicamente para detectar qué necesita reposición.",
        "La columna 'Necesita X más' indica cuántas unidades faltan para alcanzar el mínimo.",
        "Para reponer: ve a 📦 Insumos, localiza el insumo y usa ⬆️ Movimiento → Entrada.",
      ],
      porQue: "Si no repones a tiempo puedes quedarte sin stock durante un examen. Las alertas son el semáforo del inventario.",
    },
  ];

  const p = pasos[paso];
  const esUltimo = paso === pasos.length - 1;

  return (
    <div style={{ ...overlay, zIndex: 400 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...modalBox, width: "620px", maxWidth: "96vw" }}>

        {/* Cabecera */}
        <div style={{ background: "#1E293B", borderRadius: "14px 14px 0 0", padding: "1.1rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.05rem", color: "#FFF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              📖 Manual de usuario — Inventario
            </p>
            <p style={{ margin: "0.15rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.73rem", color: "#94A3B8" }}>
              Sigue los pasos en orden para configurar el módulo correctamente
            </p>
          </div>
          <button onClick={onClose} style={{ ...closeBtn, color: "#94A3B8", fontSize: "1.1rem" }}>✕</button>
        </div>

        {/* Barra de progreso de pasos */}
        <div style={{ padding: "1rem 1.5rem 0", display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {pasos.map((s, i) => (
            <button
              key={i}
              onClick={() => setPaso(i)}
              title={`Paso ${s.num}: ${s.titulo}`}
              style={{
                flex: 1, height: "6px", border: "none", borderRadius: "3px", cursor: "pointer",
                background: i < paso ? "#10B981" : i === paso ? s.color : "#E2E8F0",
                transition: "background 0.2s",
                padding: 0,
              }}
            />
          ))}
        </div>
        <div style={{ padding: "0.3rem 1.5rem 0", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF" }}>
            Paso {paso + 1} de {pasos.length}
          </span>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF" }}>
            {pasos.filter((_, i) => i < paso).length} completados
          </span>
        </div>

        {/* Contenido del paso */}
        <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Encabezado paso */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "50%",
              background: p.bg, border: `2px solid ${p.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.5rem", flexShrink: 0,
            }}>
              {p.icon}
            </div>
            <div>
              <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: p.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Paso {p.num} de {pasos.length}
              </p>
              <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#1F2937", letterSpacing: "0.02em" }}>
                {p.titulo}
              </p>
            </div>
          </div>

          {/* ¿Qué es? */}
          <div style={{ background: p.bg, border: `1px solid ${p.border}`, borderRadius: "10px", padding: "0.85rem 1rem" }}>
            <p style={{ margin: "0 0 0.25rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: p.color, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              ¿Qué es?
            </p>
            <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.83rem", color: p.textColor, lineHeight: 1.55 }}>
              {p.que}
            </p>
          </div>

          {/* ¿Cómo hacerlo? */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "0.85rem 1rem" }}>
            <p style={{ margin: "0 0 0.6rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.07em" }}>
              ¿Cómo hacerlo?
            </p>
            <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {p.como.map((c, i) => (
                <li key={i} style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", lineHeight: 1.5 }}>
                  {c}
                </li>
              ))}
            </ol>
          </div>

          {/* ¿Por qué importa? */}
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "flex-start", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "0.75rem 1rem" }}>
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>💡</span>
            <div>
              <p style={{ margin: "0 0 0.15rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                ¿Por qué es importante?
              </p>
              <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#78350F", lineHeight: 1.5 }}>
                {p.porQue}
              </p>
            </div>
          </div>

          {/* Navegación */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}>
            <button
              onClick={() => setPaso(prev => Math.max(0, prev - 1))}
              disabled={paso === 0}
              style={{ ...btnSec, opacity: paso === 0 ? 0.4 : 1, cursor: paso === 0 ? "not-allowed" : "pointer" }}>
              ← Anterior
            </button>

            {/* Puntitos de navegación */}
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              {pasos.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPaso(i)}
                  style={{
                    width: i === paso ? "20px" : "8px", height: "8px",
                    borderRadius: "4px", border: "none", cursor: "pointer",
                    background: i === paso ? p.color : i < paso ? "#10B981" : "#D1D5DB",
                    transition: "all 0.2s", padding: 0,
                  }}
                />
              ))}
            </div>

            {esUltimo ? (
              <button onClick={onClose} style={{ ...btnPrimary, background: "#10B981" }}>
                ✓ Listo
              </button>
            ) : (
              <button onClick={() => setPaso(prev => Math.min(pasos.length - 1, prev + 1))} style={btnPrimary}>
                Siguiente →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL (cierre) ────────────────────────────────────────────
function _AdminInventarioClosed() {
  // Este bloque es solo para que el parser encuentre el cierre correcto
  return (
        <div style={{ display: "none" }}>
            {/* Cabecera */}
            <div style={{ background: "linear-gradient(135deg, #1E293B 0%, #334155 100%)", borderRadius: "14px 14px 0 0", padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.15rem", color: "#FFF", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  📖 Manual de Usuario — Inventario
                </p>
                <p style={{ margin: "0.2rem 0 0", fontFamily: "'Barlow', sans-serif", fontSize: "0.76rem", color: "#94A3B8" }}>
                  Guía completa del módulo de gestión de insumos
                </p>
              </div>
              <button onClick={() => setShowManual(false)} style={{ ...closeBtn, color: "#94A3B8", fontSize: "1.1rem" }}>✕</button>
            </div>

            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

              {/* Orden recomendado */}
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "1rem 1.15rem" }}>
                <p style={{ margin: "0 0 0.55rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.9rem", color: "#1E40AF", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  🚀 ¿Por dónde empezar? — Orden recomendado
                </p>
                <ol style={{ margin: 0, paddingLeft: "1.3rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#1D4ED8", lineHeight: 2 }}>
                  <li>Crea las <strong>Categorías</strong> que agruparán tus insumos (ej: Reactivos, Material descartable).</li>
                  <li>Si tienes insumos de toma de muestra, registra los <strong>Tipos de Muestra</strong> (ej: Tubo EDTA, Hisopo).</li>
                  <li>Da de alta cada <strong>Insumo</strong> con su stock inicial y stock mínimo.</li>
                  <li>Vincula insumos a exámenes mediante <strong>Recetas</strong> para el descuento automático de stock.</li>
                  <li>A partir de ahí, registra <strong>Movimientos</strong> para mantener el inventario al día.</li>
                  <li>Revisa las <strong>Alertas</strong> periódicamente para reponer insumos a tiempo.</li>
                </ol>
              </div>

              {/* Secciones */}
              {[
                {
                  icon: "📦", color: "#B45309", bg: "#FFF7ED", border: "#FED7AA",
                  title: "Insumos",
                  desc: "Listado completo de todos los insumos del laboratorio. Muestra el stock actual de cada uno y su estado (✅ OK / ⚠️ Stock Bajo / ❌ Sin Stock).",
                  actions: [
                    ["+ Nuevo Insumo", "Registra un nuevo insumo. Completa nombre, unidad de medida, categoría, tipo de muestra (opcional), stock inicial y stock mínimo de alerta."],
                    ["✏️ Editar", "Modifica los datos del insumo. El stock no se ajusta desde aquí; usa el botón ⬆️ Movimiento."],
                    ["⬆️ Movimiento", "Registra una entrada (reposición / compra) o salida (uso / merma / descarte) del insumo seleccionado."],
                    ["🗑️ Desactivar", "Oculta el insumo del listado activo. El historial de movimientos se conserva intacto."],
                  ],
                },
                {
                  icon: "🧪", color: "#6D28D9", bg: "#F5F3FF", border: "#C4B5FD",
                  title: "Tipos de Muestra",
                  desc: "Catálogo de tipos de muestra biológica (Tubo EDTA, Hisopo, Lanceta, etc.). Se asignan únicamente a insumos que sirven para tomar muestras; reactivos, guantes u otros materiales no requieren tipo de muestra.",
                  actions: [
                    ["Agregar tipo", "Escribe el nombre y pulsa 'Agregar'. Quedará disponible al crear o editar insumos."],
                    ["🗑️ Eliminar tipo", "Solo posible si ningún insumo activo tiene ese tipo asignado."],
                  ],
                },
                {
                  icon: "🏷️", color: "#166534", bg: "#F0FDF4", border: "#86EFAC",
                  title: "Categorías",
                  desc: "Agrupan los insumos por tipo (Reactivos, Material descartable, Equipos, etc.). Facilitan la búsqueda y organización del inventario.",
                  actions: [
                    ["+ Nueva Categoría", "Ingresa nombre y una descripción opcional."],
                    ["✏️ Editar", "Modifica nombre o descripción de la categoría."],
                    ["🗑️ Eliminar", "Solo posible si la categoría no tiene insumos activos vinculados."],
                  ],
                },
                {
                  icon: "🔗", color: "#0369A1", bg: "#F0F9FF", border: "#BAE6FD",
                  title: "Recetas — Vinculación Examen ↔ Insumo",
                  desc: "Define qué insumos y en qué cantidad se consumen al realizar un examen. Cuando el sistema registre ese examen, el stock de los insumos vinculados se descontará automáticamente.",
                  actions: [
                    ["🔗 Nueva Vinculación", "Selecciona el examen y agrega filas indicando el insumo y la cantidad por examen. Guarda al terminar."],
                    ["🗑️ Eliminar vinculación", "El examen deja de descontar ese insumo automáticamente."],
                  ],
                },
                {
                  icon: "📋", color: "#374151", bg: "#F8FAFC", border: "#E2E8F0",
                  title: "Movimientos",
                  desc: "Historial cronológico de todas las entradas y salidas de stock del inventario. Funciona como auditoría: quién realizó el movimiento, cuándo y con qué observación.",
                  actions: [
                    ["Filtro TODOS / ENTRADA / SALIDA", "Muestra solo el tipo de movimiento seleccionado."],
                    ["🔍 Buscar", "Filtra por nombre del insumo, observación o usuario que realizó el movimiento."],
                    ["Cargar más", "Los movimientos se muestran de 50 en 50. Pulsa el botón al final para ver registros anteriores."],
                  ],
                },
                {
                  icon: "⚠️", color: "#92400E", bg: "#FFFBEB", border: "#FCD34D",
                  title: "Alertas",
                  desc: "Lista los insumos con stock actual por debajo del mínimo configurado. La pestaña se resalta en rojo cuando hay alertas pendientes. Indica exactamente cuántas unidades se deben reponer.",
                  actions: [
                    ["Columna 'Necesita X más'", "Muestra el déficit exacto: unidades que faltan para alcanzar el stock mínimo."],
                    ["¿Cómo reponer?", "Ve a la pestaña Insumos, localiza el insumo y usa ⬆️ Movimiento → Entrada para reponer el stock."],
                  ],
                },
              ].map(sec => (
                <div key={sec.title} style={{ background: sec.bg, border: `1px solid ${sec.border}`, borderRadius: "10px", padding: "1rem 1.15rem" }}>
                  <p style={{ margin: "0 0 0.5rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "0.9rem", color: sec.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {sec.icon} {sec.title}
                  </p>
                  <p style={{ margin: "0 0 0.65rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.81rem", color: "#374151", lineHeight: 1.55 }}>{sec.desc}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {sec.actions.map(([accion, detalle]) => (
                      <div key={accion} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                        <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", fontWeight: 700, color: sec.color, minWidth: "max-content", paddingTop: "0.05rem" }}>{accion}:</span>
                        <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#6B7280", lineHeight: 1.5 }}>{detalle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Tip final */}
              <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "10px", padding: "0.8rem 1.1rem", display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.1rem" }}>💡</span>
                <p style={{ margin: 0, fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#166534", lineHeight: 1.55 }}>
                  <strong>Tip:</strong> Usa el botón <strong>🔄</strong> en el encabezado para obtener los datos más recientes sin recargar la página. El indicador de hora muestra cuándo fue la última actualización.
                </p>
              </div>

                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowManual(false)}
                  style={btnPrimary}
                >
                  Entendido ✓
                </button>
              </div>
            </div>
          </div>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const page        = { padding: "1.5rem", fontFamily: "'Barlow', sans-serif" };
const header      = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" };
const pageH2      = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "0.04em", color: "#1F2937", margin: 0, textTransform: "uppercase" };
const pageSub     = { fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#9CA3AF", margin: "0.2rem 0 0" };
const tableWrap   = { background: "#FFF", borderRadius: "12px", border: "1px solid #F1F5F9", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const th          = { fontFamily: "'Barlow', sans-serif", fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", padding: "0.75rem 1rem", textAlign: "left", borderBottom: "1px solid #F1F5F9" };
const td          = { padding: "0.72rem 1rem", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151" };
const overlay     = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" };
const modalBox    = { background: "#FFF", borderRadius: "14px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const modalHead   = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: "1px solid #F1F5F9" };
const modalTitleSt= { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", letterSpacing: "0.06em", color: "#1F2937", textTransform: "uppercase" };
const closeBtn    = { background: "none", border: "none", fontSize: "1rem", cursor: "pointer", color: "#9CA3AF" };
const flabel      = { fontFamily: "'Barlow', sans-serif", fontSize: "0.73rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em" };
const finput      = { padding: "0.55rem 0.75rem", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none", width: "100%", boxSizing: "border-box" };
const grid2       = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" };
const footerRow   = { display: "flex", gap: "0.75rem", justifyContent: "flex-end", marginTop: "0.5rem" };
const btnPrimary  = { padding: "0.55rem 1.25rem", background: "#E88B3A", color: "#FFF", border: "none", borderRadius: "8px", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 700, fontSize: "0.85rem" };
const btnSec      = { padding: "0.55rem 1.25rem", background: "#F8FAFC", color: "#374151", border: "1px solid #E2E8F0", borderRadius: "8px", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 600, fontSize: "0.85rem" };
const searchInput = { padding: "0.55rem 1rem", borderRadius: "8px", border: "1px solid #E2E8F0", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", width: "340px", outline: "none", background: "#FFF" };
const tabBtn      = { padding: "0.5rem 1rem", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#F8FAFC", fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", color: "#6B7280", transition: "all 0.15s" };
const tabActive   = { background: "#1E293B", color: "#FFF", border: "1px solid #1E293B" };