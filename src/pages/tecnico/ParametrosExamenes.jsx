import { useState, useEffect } from "react";
import API from "../../services/api";

const SEXOS = ["General", "Masculino", "Femenino"];

// ── Tipos de resultado que puede tener un parámetro ──
const TIPOS_DATO = [
  { value: "NUMERICO", label: "Numérico (min - max)" },
  { value: "TEXTO",    label: "Texto libre" },
  { value: "OPCIONES", label: "Opciones (selección)" },
];

// ── Plantillas rápidas de opciones para el tipo OPCIONES ──
const PLANTILLAS_OPCIONES = [
  { label: "Positivo / Negativo", opciones: ["Positivo", "Negativo"] },
  { label: "Sí / No",             opciones: ["Sí", "No"] },
  { label: "Reactivo / No Reactivo", opciones: ["Reactivo", "No Reactivo"] },
  { label: "Turbio / Claro",      opciones: ["Turbio", "Claro"] },
  { label: "Color orina",         opciones: ["Amarillo", "Amarillo claro", "Ámbar", "Rojizo"] },
];

// Parsea valor_referencia (string JSON) a { tipo, opciones }. Si no es JSON
// válido o viene vacío, se asume parámetro NUMÉRICO (compatibilidad con datos viejos).
function parseTipoDato(valor_referencia) {
  if (!valor_referencia) return { tipo: "NUMERICO", opciones: [] };
  try {
    const parsed = JSON.parse(valor_referencia);
    return { tipo: parsed.tipo || "NUMERICO", opciones: parsed.opciones || [] };
  } catch {
    return { tipo: "NUMERICO", opciones: [] };
  }
}

export default function ParametrosExamenes() {
  const [tab, setTab] = useState("categorias");
  const [examenes, setExamenes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [loading, setLoading] = useState(false);

  const [examenSeleccionado, setExamenSeleccionado] = useState(null);
  const [parametros, setParametros] = useState([]);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [paramEditando, setParamEditando] = useState(null);

  // ── CAMBIO 1: tipo_resultado agregado al form de nuevo examen ──
  const [nuevoExamen, setNuevoExamen] = useState({
    id_categoria: "",
    nombre_examen: "",
    precio: "",
    tipo_resultado: "PARAMETROS", // <-- nuevo campo
  });
  const [guardandoExamen, setGuardandoExamen] = useState(false);

  const [nuevoParam, setNuevoParam] = useState({
    nombre_parametro: "",
    rango_min: "",
    rango_max: "",
    unidad: "",
    sexo_referencia: "General",
    edad_min: "0",
    edad_max: "120",
    tipo_dato: "NUMERICO",   // NUMERICO | TEXTO | OPCIONES
    opciones: [],            // solo aplica si tipo_dato === "OPCIONES"
  });
  const [opcionNueva, setOpcionNueva] = useState(""); // input para escribir una opción propia
  const [guardandoParam, setGuardandoParam] = useState(false);

  const [nuevaCat, setNuevaCat] = useState({ nombre_categoria: "", descripcion: "" });
  const [editandoCat, setEditandoCat] = useState(null);
  const [guardandoCat, setGuardandoCat] = useState(false);
  const [buscarCat, setBuscarCat] = useState("");

  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  // tipo: "parametro" | "examen" | "categoria"
  const [confirmarEliminarExamen, setConfirmarEliminarExamen] = useState(null);
  const [confirmarEliminarCategoria, setConfirmarEliminarCategoria] = useState(null);

  const [editandoExamen, setEditandoExamen] = useState(null);

  // ── Sistema de modales diseñados (reemplaza alert nativos) ──
  const [notifModal, setNotifModal] = useState(null);
  const showError   = (titulo, errores) => setNotifModal({ tipo:"error",   titulo, errores: errores || [] });
  const showSuccess = (titulo, mensaje) => setNotifModal({ tipo:"success", titulo, mensaje });
  const closeModal  = ()               => setNotifModal(null);

  // ── Cargar ──
  const cargarExamenes = async () => {
    setLoading(true);
    try {
      const { data } = await API.get(`/examenes${buscar ? `?buscar=${buscar}` : ""}`);
      setExamenes(data);
    } catch { setExamenes([]); }
    finally { setLoading(false); }
  };

  const cargarCategorias = async () => {
    try {
      const { data } = await API.get("/categorias");
      setCategorias(data);
    } catch { setCategorias([]); }
  };

  const cargarParametros = async (id_examen) => {
    try {
      const { data } = await API.get(`/parametros/examen/${id_examen}`);
      setParametros(data);
    } catch { setParametros([]); }
  };

  useEffect(() => { cargarExamenes(); cargarCategorias(); }, []);
  useEffect(() => { cargarExamenes(); }, [buscar]);

  // ── Guardar examen ── (ahora envía tipo_resultado)
 const handleGuardarExamen = async () => {
  const errores = [];
  if (!nuevoExamen.id_categoria)                                             errores.push("Selecciona una categoría.");
  if (!nuevoExamen.nombre_examen?.trim())                                    errores.push("El nombre del examen es obligatorio.");
  if (nuevoExamen.precio === "" || nuevoExamen.precio === null)               errores.push("El precio es obligatorio.");
  else if (isNaN(Number(nuevoExamen.precio)) || Number(nuevoExamen.precio) < 0) errores.push("El precio debe ser un número positivo.");
  if (!nuevoExamen.tipo_resultado)                                           errores.push("Selecciona el tipo de resultado.");
  if (errores.length > 0) { showError("Campos incompletos", errores); return; }

  setGuardandoExamen(true);
  try {
    if (editandoExamen) {
      await API.put(`/examenes/${editandoExamen.id_examen}`, nuevoExamen);
      showSuccess("Examen actualizado", "Los datos del examen fueron guardados correctamente.");
    } else {
      await API.post("/examenes", nuevoExamen);
      showSuccess("Examen creado", "El examen fue registrado en el catálogo correctamente.");
    }
    setNuevoExamen({ id_categoria: "", nombre_examen: "", precio: "", tipo_resultado: "PARAMETROS" });
    setEditandoExamen(null);
    cargarExamenes();
  } catch (err) {
    console.error(err);
    showError("Error al guardar", ["No se pudo guardar el examen.", "Verifica la conexión e intenta nuevamente."]);
  } finally {
    setGuardandoExamen(false);
  }
};
  const handleGuardarParam = async () => {
    const errores = [];
    if (!nuevoParam.nombre_parametro?.trim())                                      errores.push("El nombre del parámetro es obligatorio.");

    if (nuevoParam.tipo_dato === "NUMERICO") {
      if (nuevoParam.rango_min === "" || nuevoParam.rango_min === null)               errores.push("El valor mínimo es obligatorio.");
      else if (isNaN(Number(nuevoParam.rango_min)))                                   errores.push("El valor mínimo debe ser numérico.");
      if (nuevoParam.rango_max === "" || nuevoParam.rango_max === null)               errores.push("El valor máximo es obligatorio.");
      else if (isNaN(Number(nuevoParam.rango_max)))                                   errores.push("El valor máximo debe ser numérico.");
      if (nuevoParam.rango_min !== "" && nuevoParam.rango_max !== "" &&
          Number(nuevoParam.rango_min) > Number(nuevoParam.rango_max))               errores.push("El mínimo no puede ser mayor que el máximo.");
      if (!nuevoParam.unidad?.trim())                                                 errores.push("La unidad de medida es obligatoria (ej: mg/dL).");
    }

    if (nuevoParam.tipo_dato === "OPCIONES" && nuevoParam.opciones.length < 2) {
      errores.push("Agrega al menos 2 opciones para este tipo de parámetro.");
    }

    if (nuevoParam.edad_min === "" || isNaN(Number(nuevoParam.edad_min)))           errores.push("La edad mínima debe ser un número.");
    if (nuevoParam.edad_max === "" || isNaN(Number(nuevoParam.edad_max)))           errores.push("La edad máxima debe ser un número.");
    if (Number(nuevoParam.edad_min) > Number(nuevoParam.edad_max))                 errores.push("La edad mínima no puede superar la máxima.");
    if (errores.length > 0) { showError("Campos incompletos", errores); return; }

    // Payload final: lo que no aplica al tipo elegido se rellena en blanco/0
    // y el tipo+opciones se serializan dentro de valor_referencia (sin tocar el schema).
    const payload = {
      nombre_parametro: nuevoParam.nombre_parametro,
      sexo_referencia: nuevoParam.sexo_referencia,
      edad_min: nuevoParam.edad_min,
      edad_max: nuevoParam.edad_max,
      rango_min: nuevoParam.tipo_dato === "NUMERICO" ? nuevoParam.rango_min : 0,
      rango_max: nuevoParam.tipo_dato === "NUMERICO" ? nuevoParam.rango_max : 0,
      unidad: nuevoParam.tipo_dato === "NUMERICO" ? nuevoParam.unidad : "",
      valor_referencia: JSON.stringify({
        tipo: nuevoParam.tipo_dato,
        ...(nuevoParam.tipo_dato === "OPCIONES" ? { opciones: nuevoParam.opciones } : {}),
      }),
    };

    setGuardandoParam(true);
    try {
      if (paramEditando) {
        await API.put(`/parametros/${paramEditando.id_parametro}`, payload);
      } else {
        await API.post("/parametros", { ...payload, id_examen: examenSeleccionado.id_examen });
      }
      resetParamForm();
      cargarParametros(examenSeleccionado.id_examen);
    } catch (err) {
      console.error(err);
      showError("Error al guardar", ["No se pudo guardar el parámetro.", "Verifica la conexión e intenta nuevamente."]);
    } finally {
      setGuardandoParam(false);
    }
  };

  // Agrega esta función en tu componente
const handleEditarExamen = (examen) => {
  setEditandoExamen(examen); // Guardamos el examen completo que estamos editando
  setNuevoExamen({
    id_categoria: examen.id_categoria,
    nombre_examen: examen.nombre_examen,
    precio: examen.precio,
    tipo_resultado: examen.tipo_resultado || "PARAMETROS" // Aseguramos el nuevo campo
  });
  setModoEdicion(true); // Suponiendo que tienes un estado modoEdicion
};

  const resetParamForm = () => {
    setNuevoParam({ nombre_parametro: "", rango_min: "", rango_max: "", unidad: "", sexo_referencia: "General", edad_min: "0", edad_max: "120", tipo_dato: "NUMERICO", opciones: [] });
    setOpcionNueva("");
    setParamEditando(null);
    setModoEdicion(false);
  };

  // ── Eliminar parámetro ──
  const handleEliminarParam = async (id) => {
    try {
      await API.delete(`/parametros/${id}`);
      cargarParametros(examenSeleccionado.id_examen);
    } catch {}
    finally { setConfirmarEliminar(null); }
  };

  // ── Eliminar examen ──
  const handleEliminarExamen = async (id) => {
    try {
      await API.delete(`/examenes/${id}`);
      showSuccess("Examen eliminado", "El examen y todos sus parámetros fueron desactivados correctamente.");
      cargarExamenes();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      showError("Error al eliminar", [msg || "No se pudo eliminar el examen."]);
    } finally {
      setConfirmarEliminarExamen(null);
    }
  };

  // ── Eliminar categoría ──
  const handleEliminarCategoria = async (id) => {
    try {
      await API.delete(`/categorias/${id}`);
      showSuccess("Categoría eliminada", "La categoría y todos sus exámenes asociados fueron desactivados.");
      cargarCategorias();
      cargarExamenes();
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      showError("Error al eliminar", [msg || "No se pudo eliminar la categoría."]);
    } finally {
      setConfirmarEliminarCategoria(null);
    }
  };

  // ── Editar parámetro ──
  const handleEditarParam = (p) => {
    const { tipo, opciones } = parseTipoDato(p.valor_referencia);
    setParamEditando(p);
    setNuevoParam({
      nombre_parametro: p.nombre_parametro,
      rango_min: p.rango_min,
      rango_max: p.rango_max,
      unidad: p.unidad,
      sexo_referencia: p.sexo_referencia || "General",
      edad_min: p.edad_min || "0",
      edad_max: p.edad_max || "120",
      tipo_dato: tipo,
      opciones,
    });
    setOpcionNueva("");
    setModoEdicion(true);
  };

  // ── Ver parámetros ──
  const handleVerParametros = (examen) => {
    setExamenSeleccionado(examen);
    cargarParametros(examen.id_examen);
    resetParamForm();
  };

  // ── Guardar categoría ──
  const handleGuardarCategoria = async () => {
    if (!nuevaCat.nombre_categoria?.trim()) {
      showError("Campo obligatorio", ["El nombre de la categoría es obligatorio."]);
      return;
    }
    setGuardandoCat(true);
    try {
      if (editandoCat) {
        await API.put(`/categorias/${editandoCat.id_categoria}`, nuevaCat);
      } else {
        await API.post("/categorias", nuevaCat);
      }
      setNuevaCat({ nombre_categoria: "", descripcion: "" });
      setEditandoCat(null);
      cargarCategorias();
    } catch {}
    finally { setGuardandoCat(false); }
  };

  const categoriasFiltradas = categorias.filter(c =>
    c.nombre_categoria?.toLowerCase().includes(buscarCat.toLowerCase())
  );

  // ── VISTA PARÁMETROS ──
  // CAMBIO 2: Si el examen es tipo PDF, mostrar aviso en lugar del formulario de parámetros
  if (examenSeleccionado) {
    const esPDF = examenSeleccionado.tipo_resultado === "PDF";

    return (
      <div style={containerStyle}>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={tabRowStyle}>
            <TabBtn active={tab === "categorias"} onClick={() => setTab("categorias")} label="⚙ CATEGORÍAS" />
            <TabBtn active={tab === "listado"} onClick={() => setTab("listado")} label="☰ LISTADO" />
          </div>
          <button onClick={() => setExamenSeleccionado(null)} style={backBtnStyle}>
            ← VOLVER AL LISTADO
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
            <h2 style={{ ...titleStyle, margin: 0 }}>
              {modoEdicion ? "EDITANDO" : "CONFIGURAR"}
            </h2>
            <h2 style={{ ...titleStyle, color: "#E88B3A", margin: 0 }}>
              {examenSeleccionado.nombre_examen.toUpperCase()}
            </h2>
            {/* CAMBIO 3: Badge de tipo visible en el header */}
            <span style={esPDF ? badgePDFStyle : badgeParamStyle}>
              {esPDF ? "📄 PDF" : "📋 PARÁMETROS"}
            </span>
          </div>
        </div>

        {/* CAMBIO 4: Si es PDF → aviso informativo. Si es PARAMETROS → formulario normal */}
        {esPDF ? (
          <div style={pdfAvisoStyle}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📄</div>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#92400E", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
              Este examen entrega resultados como PDF
            </p>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#78350F", lineHeight: 1.6, margin: 0 }}>
              Los parámetros no aplican para este examen. Cuando se registre el resultado,
              el técnico deberá adjuntar el archivo PDF del informe directamente.
            </p>
          </div>
        ) : (
          <>
            {/* Form parámetro — sin cambios */}
            <div style={{
              ...panelStyle,
              marginBottom: "1.5rem",
              border: modoEdicion ? "2px solid #E88B3A" : "1px solid #F1F5F9",
              background: modoEdicion ? "#FFFBF7" : "#FFF",
            }}>
              <p style={{ ...formSectionTitleStyle, marginBottom: "1rem", fontSize: "0.85rem", color: modoEdicion ? "#E88B3A" : "#374151" }}>
                {modoEdicion ? "✏️ EDITANDO PARÁMETRO" : "➕ NUEVO PARÁMETRO"}
              </p>

                {/* ── SECCIÓN 1: Identificación ── */}
              <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "1rem", marginBottom: "1rem", border: "1px solid #F1F5F9" }}>
                <p style={{ ...formSectionTitleStyle, marginBottom: "0.6rem", color: "#374151" }}>① IDENTIFICACIÓN</p>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.3rem", display: "block" }}>NOMBRE DEL PARÁMETRO</label>
                    <input
                      placeholder="Ej: Glucosa en ayunas"
                      value={nuevoParam.nombre_parametro}
                      onChange={e => setNuevoParam(f => ({ ...f, nombre_parametro: e.target.value }))}
                      style={{ ...paramInputStyle, width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.3rem", display: "block" }}>APLICA PARA</label>
                    <select
                      value={nuevoParam.sexo_referencia}
                      onChange={e => setNuevoParam(f => ({ ...f, sexo_referencia: e.target.value }))}
                      style={{ ...paramSelectStyle, width: "100%", boxSizing: "border-box" }}
                    >
                      {SEXOS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* ── SECCIÓN 2: Tipo de resultado ── */}
              <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "1rem", marginBottom: "1rem", border: "1px solid #F1F5F9" }}>
                <p style={{ ...formSectionTitleStyle, marginBottom: "0.6rem", color: "#374151" }}>② TIPO DE RESULTADO</p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {TIPOS_DATO.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setNuevoParam(f => ({ ...f, tipo_dato: t.value }))}
                      style={{
                        padding: "0.5rem 0.9rem",
                        borderRadius: "8px",
                        border: nuevoParam.tipo_dato === t.value ? "1.5px solid #E88B3A" : "1.5px solid #E5E7EB",
                        background: nuevoParam.tipo_dato === t.value ? "rgba(232,139,58,0.1)" : "#FFF",
                        color: nuevoParam.tipo_dato === t.value ? "#E88B3A" : "#6B7280",
                        fontFamily: "'Barlow Condensed', sans-serif",
                        fontWeight: 700,
                        fontSize: "0.78rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Sub-sección condicional según tipo */}
                {nuevoParam.tipo_dato === "NUMERICO" && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
                      <div>
                        <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.3rem", display: "block" }}>VALOR MÍNIMO</label>
                        <input placeholder="0.00" type="number" step="0.01"
                          value={nuevoParam.rango_min}
                          onChange={e => setNuevoParam(f => ({ ...f, rango_min: e.target.value }))}
                          style={{ ...paramInputStyle, width: "100%", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.3rem", display: "block" }}>VALOR MÁXIMO</label>
                        <input placeholder="0.00" type="number" step="0.01"
                          value={nuevoParam.rango_max}
                          onChange={e => setNuevoParam(f => ({ ...f, rango_max: e.target.value }))}
                          style={{ ...paramInputStyle, width: "100%", boxSizing: "border-box" }} />
                      </div>
                      <div>
                        <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.3rem", display: "block" }}>UNIDAD (ej: mg/dL)</label>
                        <input placeholder="mg/dL"
                          value={nuevoParam.unidad}
                          onChange={e => setNuevoParam(f => ({ ...f, unidad: e.target.value }))}
                          style={{ ...paramInputStyle, width: "100%", boxSizing: "border-box" }} />
                      </div>
                    </div>
                  </div>
                )}

                {nuevoParam.tipo_dato === "TEXTO" && (
                  <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.9rem", background: "#FFF", border: "1px dashed #E5E7EB", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", color: "#6B7280" }}>
                    ℹ️ El técnico escribirá libremente el resultado (ej: "Amarillo claro", "Densa con sedimento").
                  </div>
                )}

                {nuevoParam.tipo_dato === "OPCIONES" && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.4rem", display: "block" }}>PLANTILLAS RÁPIDAS</label>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                      {PLANTILLAS_OPCIONES.map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setNuevoParam(f => ({ ...f, opciones: [...new Set([...f.opciones, ...p.opciones])] }))}
                          style={{ padding: "0.35rem 0.7rem", borderRadius: "20px", border: "1px solid #E5E7EB", background: "#FFF", color: "#374151", fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", cursor: "pointer" }}
                        >
                          + {p.label}
                        </button>
                      ))}
                    </div>
                    <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.4rem", display: "block" }}>AGREGAR OPCIÓN PROPIA</label>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem" }}>
                      <input
                        placeholder="Escribe una opción y presiona Enter (ej: Turbio)"
                        value={opcionNueva}
                        onChange={e => setOpcionNueva(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter" && opcionNueva.trim()) {
                            e.preventDefault();
                            setNuevoParam(f => ({ ...f, opciones: [...new Set([...f.opciones, opcionNueva.trim()])] }));
                            setOpcionNueva("");
                          }
                        }}
                        style={{ ...paramInputStyle, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!opcionNueva.trim()) return;
                          setNuevoParam(f => ({ ...f, opciones: [...new Set([...f.opciones, opcionNueva.trim()])] }));
                          setOpcionNueva("");
                        }}
                        style={{ ...guardarBtnStyle, background: "#1F2937", color: "#FFF" }}
                      >
                        Agregar
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      {nuevoParam.opciones.length === 0 ? (
                        <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#9CA3AF" }}>Aún no hay opciones agregadas.</span>
                      ) : nuevoParam.opciones.map(op => (
                        <span key={op} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.3rem 0.6rem", borderRadius: "20px", background: "rgba(232,139,58,0.1)", color: "#E88B3A", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.78rem" }}>
                          {op}
                          <button type="button" onClick={() => setNuevoParam(f => ({ ...f, opciones: f.opciones.filter(o => o !== op) }))} style={{ background: "none", border: "none", cursor: "pointer", color: "#E88B3A", fontWeight: 700, lineHeight: 1, padding: 0 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── SECCIÓN 3: Rango de edad + Acción ── */}
              <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "1rem", border: "1px solid #F1F5F9" }}>
                <p style={{ ...formSectionTitleStyle, marginBottom: "0.6rem", color: "#374151" }}>③ RANGO DE EDAD DE REFERENCIA</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.75rem", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.3rem", display: "block" }}>EDAD MÍNIMA (años)</label>
                    <input placeholder="0" type="number"
                      value={nuevoParam.edad_min}
                      onChange={e => setNuevoParam(f => ({ ...f, edad_min: e.target.value }))}
                      style={{ ...paramInputStyle, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ ...paramLabelsStyle, marginTop: 0, marginBottom: "0.3rem", display: "block" }}>EDAD MÁXIMA (años)</label>
                    <input placeholder="120" type="number"
                      value={nuevoParam.edad_max}
                      onChange={e => setNuevoParam(f => ({ ...f, edad_max: e.target.value }))}
                      style={{ ...paramInputStyle, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  {modoEdicion ? (
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button onClick={handleGuardarParam} style={circleOrangeBtn} title="Guardar cambios">✓</button>
                      <button onClick={resetParamForm} style={circleRedBtn} title="Cancelar edición">✕</button>
                    </div>
                  ) : (
                    <button onClick={handleGuardarParam} disabled={guardandoParam} style={{ ...circleDarkBtn, width: "auto", borderRadius: "8px", padding: "0 1.25rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.06em" }}>
                      {guardandoParam ? "..." : "+ AGREGAR"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Tabla parámetros — sin cambios */}
            <div style={panelStyle}>
              <div style={paramTableHeaderStyle}>
                <span style={{ flex: 2 }}>PARÁMETRO</span>
                <span style={{ flex: 1, textAlign: "center" }}>SEXO</span>
                <span style={{ flex: 1, textAlign: "center" }}>RANGO (2 DEC)</span>
                <span style={{ flex: 1, textAlign: "center" }}>UNIDAD</span>
                <span style={{ flex: 1, textAlign: "center" }}>EDAD</span>
                <span style={{ flex: 1, textAlign: "right" }}>ACCIONES</span>
              </div>

              {parametros.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9CA3AF", padding: "2rem", fontSize: "0.85rem" }}>
                  Sin parámetros registrados
                </p>
              ) : (
                parametros.map(p => {
                  const { tipo, opciones } = parseTipoDato(p.valor_referencia);
                  return (
                  <div key={p.id_parametro} style={paramRowStyle}>
                    <div style={{ flex: 2, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={paramAccentBarStyle} />
                      <span style={paramNameStyle}>{p.nombre_parametro.toUpperCase()}</span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span style={{
                        ...sexoBadgeStyle,
                        background: p.sexo_referencia === "Masculino" ? "rgba(59,130,246,0.1)" :
                                    p.sexo_referencia === "Femenino"  ? "rgba(236,72,153,0.1)" :
                                    "rgba(107,114,128,0.1)",
                        color: p.sexo_referencia === "Masculino" ? "#3B82F6" :
                               p.sexo_referencia === "Femenino"  ? "#EC4899" : "#6B7280",
                      }}>
                        {p.sexo_referencia === "Masculino" ? "♂" :
                         p.sexo_referencia === "Femenino"  ? "♀" : "⚥"}
                      </span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      {tipo === "NUMERICO" ? (
                        <span style={rangoStyle}>
                          {parseFloat(p.rango_min).toFixed(2)} — {parseFloat(p.rango_max).toFixed(2)}
                        </span>
                      ) : tipo === "OPCIONES" ? (
                        <span style={{ ...rangoStyle, fontSize: "0.75rem" }} title={opciones.join(", ")}>
                          {opciones.join(" / ")}
                        </span>
                      ) : (
                        <span style={{ ...rangoStyle, fontStyle: "italic", color: "#9CA3AF" }}>Texto libre</span>
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      {tipo === "NUMERICO" ? (
                        <span style={unidadBadgeStyle}>{p.unidad}</span>
                      ) : (
                        <span style={{ ...unidadBadgeStyle, background: "rgba(107,114,128,0.1)", color: "#6B7280" }}>
                          {tipo === "OPCIONES" ? "Opciones" : "Texto"}
                        </span>
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span style={edadBadgeStyle}>{p.edad_min}-{p.edad_max} años</span>
                    </div>
                    <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                      <button onClick={() => handleEditarParam(p)} style={iconActionBtn("#E88B3A")}>✏️</button>
                      <button onClick={() => setConfirmarEliminar(p.id_parametro)} style={iconActionBtn("#DC2626")}>🗑️</button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* Modal confirmar eliminar — diseñado */}
        {confirmarEliminar && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
            <div style={{ background:"#FFF", borderRadius:"16px", width:"100%", maxWidth:"400px", overflow:"hidden", boxShadow:"0 24px 60px rgba(0,0,0,0.2)", fontFamily:"'Barlow', sans-serif" }}>
              {/* Header rojo */}
              <div style={{ background:"#FEF2F2", borderBottom:"1px solid #FECACA", padding:"1.25rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
                <span style={{ fontSize:"1.6rem", lineHeight:1 }}>🗑️</span>
                <h3 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:"1.1rem", color:"#DC2626", margin:0, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                  ¿Eliminar Parámetro?
                </h3>
              </div>
              {/* Body */}
              <div style={{ padding:"1.25rem 1.5rem" }}>
                <p style={{ margin:0, fontSize:"0.87rem", color:"#374151", lineHeight:1.6 }}>
                  Esta acción es <strong>irreversible</strong> y afectará los rangos de referencia de futuros exámenes.
                </p>
              </div>
              {/* Botones */}
              <div style={{ padding:"0 1.5rem 1.25rem", display:"flex", gap:"0.65rem" }}>
                <button onClick={() => setConfirmarEliminar(null)}
                  style={{ flex:1, padding:"0.6rem", background:"#F3F4F6", color:"#374151", border:"1px solid #E5E7EB", borderRadius:"8px", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", letterSpacing:"0.05em", textTransform:"uppercase" }}>
                  Cancelar
                </button>
                <button onClick={() => handleEliminarParam(confirmarEliminar)}
                  style={{ flex:1, padding:"0.6rem", background:"#DC2626", color:"#FFF", border:"none", borderRadius:"8px", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", letterSpacing:"0.05em", textTransform:"uppercase" }}>
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Modal notificación diseñado */}
        {notifModal && <NotifModal data={notifModal} onClose={closeModal} />}
      </div>
    );
  }

  // ── VISTA PRINCIPAL ──
  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={titleStyle}>
          GESTIÓN DE <span style={{ color: "#E88B3A" }}>EXÁMENES</span>
        </h2>
        <div style={tabRowStyle}>
            <TabBtn active={tab === "categorias"} onClick={() => setTab("categorias")} label="⚙ CATEGORÍAS" />
          <TabBtn active={tab === "listado"} onClick={() => setTab("listado")} label="☰ LISTADO" />
        
        </div>
      </div>

      {tab === "listado" && (
        <>
          {/* CAMBIO 5: Form de nuevo examen con selector de tipo_resultado */}
          <div style={{ ...panelStyle, background: "#1F2937", marginBottom: "1.5rem" }}>
            <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.15em", textTransform: "uppercase", margin: "0 0 0.75rem" }}>
              NUEVO EXAMEN
            </p>
            <div style={examenFormRowStyle}>
              <select
                value={nuevoExamen.id_categoria}
                onChange={e => setNuevoExamen(f => ({ ...f, id_categoria: e.target.value }))}
                style={darkSelectStyle}>
                <option value="">Categoría...</option>
                {categorias.map(c => <option key={c.id_categoria} value={c.id_categoria}>{c.nombre_categoria}</option>)}
              </select>
              <input placeholder="Nombre Examen" value={nuevoExamen.nombre_examen}
                onChange={e => setNuevoExamen(f => ({ ...f, nombre_examen: e.target.value }))}
                style={darkInputStyle} />
              <input placeholder="Precio" type="number" value={nuevoExamen.precio}
                onChange={e => setNuevoExamen(f => ({ ...f, precio: e.target.value }))}
                style={{ ...darkInputStyle, flex: "0 0 100px" }} />

              {/* CAMBIO 6: Selector tipo_resultado con colores */}
              <select
                value={nuevoExamen.tipo_resultado}
                onChange={e => setNuevoExamen(f => ({ ...f, tipo_resultado: e.target.value }))}
                style={{
                  ...darkSelectStyle,
                  flex: "0 0 150px",
                  background: nuevoExamen.tipo_resultado === "PDF" ? "#78350F" : "#1e3a5f",
                  fontWeight: 700,
                }}>
                <option value="PARAMETROS">📋 Parámetros</option>
                <option value="PDF">📄 PDF</option>
              </select>

              <button onClick={handleGuardarExamen} disabled={guardandoExamen} style={guardarBtnStyle}>
                {guardandoExamen ? "..." : "+ GUARDAR"}
              </button>
            </div>
          </div>

          <div style={searchWrapStyle}>
            <span style={{ color: "#9CA3AF" }}>🔍</span>
            <input placeholder="Buscar por examen o categoría..." value={buscar}
              onChange={e => setBuscar(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "#374151", background: "transparent" }} />
          </div>

          {loading ? (
            <p style={{ textAlign: "center", color: "#6B7280", padding: "3rem" }}>Cargando exámenes...</p>
          ) : (
            <div style={examenesGridStyle}>
              {examenes.map(e => (
                <div key={e.id_examen} style={examenCardStyle}>
                  <div style={{ fontSize: "1.5rem", color: "#E5E7EB", marginBottom: "0.5rem" }}>🔬</div>
                  <p style={catLabelStyle}>{e.nombre_categoria}</p>
                  <p style={examenNameStyle}>{e.nombre_examen}</p>
                  <p style={precioStyle}>${parseFloat(e.precio).toFixed(2)}</p>

                  {/* CAMBIO 7: Badge de tipo en cada card del listado */}
                  <div style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={e.tipo_resultado === "PDF" ? badgePDFStyle : badgeParamStyle}>
                      {e.tipo_resultado === "PDF" ? "📄 PDF" : "📋 Parámetros"}
                    </span>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <button 
                      onClick={() => handleEditarExamen(e)} 
                      style={iconActionBtn("#E88B3A")} 
                      title="Editar"
                    >
                      ✏️
                    </button>
                    {e.tipo_resultado !== "PDF" && (
                      <button onClick={() => handleVerParametros(e)} style={iconActionBtn("#6B7280")} title="Configurar parámetros">⚙️</button>
                    )}
                    <button
                      onClick={() => setConfirmarEliminarExamen(e)}
                      style={iconActionBtn("#DC2626")}
                      title="Eliminar examen"
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "categorias" && (
        <>
          <div style={{ ...panelStyle, marginBottom: "1.5rem", border: editandoCat ? "2px solid #E88B3A" : "1px solid #F1F5F9", background: editandoCat ? "#FFFBF7" : "#FFF" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <p style={formSectionTitleStyle}>+ NUEVA CATEGORÍA</p>
              {editandoCat && (
                <button onClick={() => { setEditandoCat(null); setNuevaCat({ nombre_categoria: "", descripcion: "" }); }}
                  style={{ background: "none", border: "none", color: "#DC2626", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>
                  CANCELAR
                </button>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <input placeholder="Nombre de la Categoría" value={nuevaCat.nombre_categoria}
                onChange={e => setNuevaCat(f => ({ ...f, nombre_categoria: e.target.value }))}
                style={fieldInputStyle} />
              <input placeholder="Descripción (Opcional)" value={nuevaCat.descripcion}
                onChange={e => setNuevaCat(f => ({ ...f, descripcion: e.target.value }))}
                style={fieldInputStyle} />
            </div>
            <button onClick={handleGuardarCategoria} disabled={guardandoCat} style={registrarCatBtnStyle}>
              💾 {editandoCat ? "Actualizar Categoría" : "Registrar Categoría"}
            </button>
          </div>

          <div style={searchWrapStyle}>
            <span style={{ color: "#9CA3AF" }}>🔍</span>
            <input placeholder="Filtrar categorías por nombre..." value={buscarCat}
              onChange={e => setBuscarCat(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "#374151", background: "transparent" }} />
          </div>

          <div style={catGridStyle}>
            {categoriasFiltradas.map(c => (
              <div key={c.id_categoria} style={catCardStyle}>
                <span style={{ color: "#E88B3A", fontSize: "1.1rem" }}>🏷️</span>
                <div style={{ flex: 1 }}>
                  <p style={catCardNameStyle}>{c.nombre_categoria.toUpperCase()}</p>
                  <p style={catCardDescStyle}>{c.descripcion || c.nombre_categoria.toLowerCase()}</p>
                </div>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  <button onClick={() => { setEditandoCat(c); setNuevaCat({ nombre_categoria: c.nombre_categoria, descripcion: c.descripcion || "" }); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "1rem" }}>✏️</button>
                  <button onClick={() => setConfirmarEliminarCategoria(c)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: "1rem" }} title="Eliminar categoría">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {/* Modal eliminar EXAMEN */}
      {confirmarEliminarExamen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"#FFF", borderRadius:"16px", width:"100%", maxWidth:"420px", overflow:"hidden", boxShadow:"0 24px 60px rgba(0,0,0,0.25)", fontFamily:"'Barlow', sans-serif" }}>
            <div style={{ background:"#FEF2F2", borderBottom:"1px solid #FECACA", padding:"1.25rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
              <span style={{ fontSize:"1.6rem" }}>⚠️</span>
              <h3 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:"1.1rem", color:"#DC2626", margin:0, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                ¿Eliminar Examen?
              </h3>
            </div>
            <div style={{ padding:"1.25rem 1.5rem" }}>
              <p style={{ margin:"0 0 0.75rem", fontSize:"0.92rem", color:"#111827", fontWeight:700 }}>
                🔬 {confirmarEliminarExamen.nombre_examen}
              </p>
              <div style={{ background:"#FFF7ED", border:"1px solid #FDE68A", borderRadius:"8px", padding:"0.75rem 1rem", fontSize:"0.85rem", color:"#92400E", lineHeight:1.6 }}>
                <strong>Esta acción desactivará:</strong>
                <ul style={{ margin:"0.4rem 0 0", paddingLeft:"1.25rem" }}>
                  <li>El examen <strong>{confirmarEliminarExamen.nombre_examen}</strong></li>
                  <li>Todos los <strong>parámetros</strong> asociados a este examen</li>
                  <li>Las <strong>asignaciones</strong> de especialistas a este examen</li>
                </ul>
              </div>
              <p style={{ margin:"0.75rem 0 0", fontSize:"0.82rem", color:"#6B7280" }}>
                Los resultados históricos no serán afectados. Puedes reactivar el examen desde la papelera.
              </p>
            </div>
            <div style={{ padding:"0 1.5rem 1.25rem", display:"flex", gap:"0.65rem" }}>
              <button onClick={() => setConfirmarEliminarExamen(null)}
                style={{ flex:1, padding:"0.65rem", background:"#F3F4F6", color:"#374151", border:"1px solid #E5E7EB", borderRadius:"8px", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", textTransform:"uppercase" }}>
                Cancelar
              </button>
              <button onClick={() => handleEliminarExamen(confirmarEliminarExamen.id_examen)}
                style={{ flex:1, padding:"0.65rem", background:"#DC2626", color:"#FFF", border:"none", borderRadius:"8px", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", textTransform:"uppercase" }}>
                Sí, eliminar examen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar CATEGORÍA */}
      {confirmarEliminarCategoria && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
          <div style={{ background:"#FFF", borderRadius:"16px", width:"100%", maxWidth:"420px", overflow:"hidden", boxShadow:"0 24px 60px rgba(0,0,0,0.25)", fontFamily:"'Barlow', sans-serif" }}>
            <div style={{ background:"#FEF2F2", borderBottom:"1px solid #FECACA", padding:"1.25rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
              <span style={{ fontSize:"1.6rem" }}>⚠️</span>
              <h3 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:"1.1rem", color:"#DC2626", margin:0, textTransform:"uppercase", letterSpacing:"0.04em" }}>
                ¿Eliminar Categoría?
              </h3>
            </div>
            <div style={{ padding:"1.25rem 1.5rem" }}>
              <p style={{ margin:"0 0 0.75rem", fontSize:"0.92rem", color:"#111827", fontWeight:700 }}>
                🏷️ {confirmarEliminarCategoria.nombre_categoria}
              </p>
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"8px", padding:"0.75rem 1rem", fontSize:"0.85rem", color:"#991B1B", lineHeight:1.6 }}>
                <strong>⚠️ Advertencia — efecto en cascada:</strong>
                <ul style={{ margin:"0.4rem 0 0", paddingLeft:"1.25rem" }}>
                  <li>La categoría <strong>{confirmarEliminarCategoria.nombre_categoria}</strong> será desactivada</li>
                  <li><strong>Todos los exámenes</strong> de esta categoría serán desactivados</li>
                  <li><strong>Todos los parámetros</strong> de esos exámenes quedarán inaccesibles</li>
                </ul>
              </div>
              <p style={{ margin:"0.75rem 0 0", fontSize:"0.82rem", color:"#6B7280" }}>
                Los resultados históricos no serán afectados. Puedes reactivar la categoría y sus exámenes individualmente desde la papelera.
              </p>
            </div>
            <div style={{ padding:"0 1.5rem 1.25rem", display:"flex", gap:"0.65rem" }}>
              <button onClick={() => setConfirmarEliminarCategoria(null)}
                style={{ flex:1, padding:"0.65rem", background:"#F3F4F6", color:"#374151", border:"1px solid #E5E7EB", borderRadius:"8px", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", textTransform:"uppercase" }}>
                Cancelar
              </button>
              <button onClick={() => handleEliminarCategoria(confirmarEliminarCategoria.id_categoria)}
                style={{ flex:1, padding:"0.65rem", background:"#DC2626", color:"#FFF", border:"none", borderRadius:"8px", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.82rem", cursor:"pointer", textTransform:"uppercase" }}>
                Sí, eliminar todo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal notificación diseñado */}
      {notifModal && <NotifModal data={notifModal} onClose={closeModal} />}
    </div>
  );
}

// ─── MODAL DE NOTIFICACIÓN DISEÑADO ──────────────────────────────────────────
function NotifModal({ data, onClose }) {
  const cfg = {
    error:   { icon:"⚠️", accent:"#DC2626", bg:"#FEF2F2", border:"#FECACA", btnBg:"#DC2626", btnLabel:"Entendido" },
    success: { icon:"✅", accent:"#059669", bg:"#F0FDF4", border:"#BBF7D0", btnBg:"#059669", btnLabel:"Aceptar"   },
    warning: { icon:"🔔", accent:"#D97706", bg:"#FFFBEB", border:"#FDE68A", btnBg:"#D97706", btnLabel:"Aceptar"   },
  }[data.tipo] || { icon:"ℹ️", accent:"#3B82F6", bg:"#EFF6FF", border:"#BFDBFE", btnBg:"#3B82F6", btnLabel:"Aceptar" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem" }}>
      <div style={{ background:"#FFF", borderRadius:"16px", width:"100%", maxWidth:"400px", overflow:"hidden", boxShadow:"0 24px 60px rgba(0,0,0,0.2)", fontFamily:"'Barlow', sans-serif" }}>
        {/* Header con color según tipo */}
        <div style={{ background:cfg.bg, borderBottom:`1px solid ${cfg.border}`, padding:"1.25rem 1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
          <span style={{ fontSize:"1.6rem", lineHeight:1 }}>{cfg.icon}</span>
          <h3 style={{ fontFamily:"'Barlow Condensed', sans-serif", fontWeight:800, fontSize:"1.1rem", color:cfg.accent, margin:0, textTransform:"uppercase", letterSpacing:"0.04em" }}>
            {data.titulo}
          </h3>
        </div>
        {/* Body */}
        <div style={{ padding:"1.25rem 1.5rem" }}>
          {data.errores && data.errores.length > 0 ? (
            <ul style={{ margin:0, padding:0, listStyle:"none", display:"flex", flexDirection:"column", gap:"0.4rem" }}>
              {data.errores.map((e, i) => (
                <li key={i} style={{ display:"flex", alignItems:"flex-start", gap:"0.5rem", fontSize:"0.87rem", color:"#374151" }}>
                  <span style={{ color:cfg.accent, fontWeight:700, flexShrink:0, marginTop:"1px" }}>›</span>
                  {e}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin:0, fontSize:"0.87rem", color:"#374151", lineHeight:1.6 }}>{data.mensaje}</p>
          )}
        </div>
        {/* Footer */}
        <div style={{ padding:"0 1.5rem 1.25rem", display:"flex", justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"0.55rem 1.5rem", background:cfg.btnBg, color:"#FFF", border:"none", borderRadius:"8px", fontFamily:"'Barlow Condensed', sans-serif", fontWeight:700, fontSize:"0.85rem", letterSpacing:"0.06em", cursor:"pointer", textTransform:"uppercase" }}>
            {cfg.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB BTN ──────────────────────────────────────────────────────────────────
function TabBtn({ active, onClick, label }) {
  return (
    <button onClick={onClick} style={{
      padding: "0.6rem 1.25rem", background: active ? "#E88B3A" : "transparent",
      color: active ? "#FFF" : "#6B7280", border: active ? "none" : "1px solid #E5E7EB",
      borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", cursor: "pointer", textTransform: "uppercase",
    }}>{label}</button>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const containerStyle = { padding: "1rem", fontFamily: "'Barlow', sans-serif" };
const titleStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", margin: "0 0 1rem", textTransform: "uppercase" };
const tabRowStyle = { display: "flex", gap: "0.5rem", marginBottom: "1.5rem" };
const panelStyle = { background: "#FFF", borderRadius: "12px", padding: "1.5rem", border: "1px solid #F1F5F9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" };
const searchWrapStyle = { display: "flex", alignItems: "center", gap: "0.75rem", background: "#FFF", border: "1.5px solid #E5E7EB", borderRadius: "8px", padding: "0.6rem 1rem", marginBottom: "1.5rem" };

const examenFormRowStyle = { display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" };
const darkSelectStyle = { flex: 1, padding: "0.65rem 0.75rem", background: "#374151", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", cursor: "pointer" };
const darkInputStyle = { flex: 1, padding: "0.65rem 0.75rem", background: "#374151", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", outline: "none" };
const guardarBtnStyle = { padding: "0.65rem 1.25rem", background: "#FFF", color: "#1F2937", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", whiteSpace: "nowrap" };

const examenesGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" };
const examenCardStyle = { background: "#FFF", borderRadius: "10px", padding: "1.25rem", border: "1px solid #F1F5F9", boxShadow: "0 2px 4px rgba(0,0,0,0.03)" };
const catLabelStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#E88B3A", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.25rem" };
const examenNameStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.25rem", textTransform: "uppercase" };
const precioStyle = { fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "#6B7280", margin: 0 };

const backBtnStyle = { background: "none", border: "none", color: "#6B7280", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.08em", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "0.25rem" };
const formSectionTitleStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.8rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 };
const paramLabelsStyle = { display: "flex", gap: "0.75rem", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "0.75rem" };
const paramInputStyle = { padding: "0.65rem 0.75rem", border: "1px solid #E5E7EB", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#374151", background: "#FAFAFA", outline: "none" };
const paramSelectStyle = { ...paramInputStyle, cursor: "pointer" };
const paramTableHeaderStyle = { display: "flex", padding: "0.6rem 1rem", background: "#F8FAFC", fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: "8px", marginBottom: "0.5rem" };
const paramRowStyle = { display: "flex", alignItems: "center", padding: "0.9rem 0.5rem", borderBottom: "1px solid #F8FAFC" };
const paramAccentBarStyle = { width: "3px", height: "20px", background: "#E88B3A", borderRadius: "2px", flexShrink: 0 };
const paramNameStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", color: "#1F2937", textTransform: "uppercase" };
const rangoStyle = { fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#374151" };
const unidadBadgeStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.75rem", fontWeight: 700, background: "rgba(232,139,58,0.1)", color: "#E88B3A", padding: "0.2rem 0.5rem", borderRadius: "4px", textTransform: "uppercase" };
const sexoBadgeStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.9rem", fontWeight: 700, padding: "0.3rem 0.6rem", borderRadius: "20px" };
const edadBadgeStyle = { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#6B7280", background: "#F8FAFC", padding: "0.2rem 0.5rem", borderRadius: "4px" };
const iconActionBtn = (color) => ({ background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", padding: "0.3rem", color, borderRadius: "4px" });
const circleDarkBtn = { width: "36px", height: "36px", borderRadius: "50%", background: "#1F2937", color: "#FFF", border: "none", cursor: "pointer", fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const circleOrangeBtn = { ...circleDarkBtn, background: "#E88B3A" };
const circleRedBtn = { ...circleDarkBtn, background: "#DC2626" };

const registrarCatBtnStyle = { padding: "0.65rem 1.25rem", background: "#1F2937", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" };
const catGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" };
const catCardStyle = { background: "#FFF", borderRadius: "10px", padding: "1rem 1.25rem", border: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: "0.75rem" };
const catCardNameStyle = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#1F2937", margin: 0, textTransform: "uppercase" };
const catCardDescStyle = { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#9CA3AF", margin: 0 };

const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" };
const confirmModalStyle = { background: "#FFF", borderRadius: "16px", padding: "2rem", width: "100%", maxWidth: "380px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" };
const fieldInputStyle = { width: "100%", padding: "0.65rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", color: "#1F2937", background: "#FAFAFA", outline: "none", boxSizing: "border-box" };

// ─── ESTILOS NUEVOS ───────────────────────────────────────────────────────────
// Badge para cards y header de configuración
const badgePDFStyle = {
  display: "inline-block", padding: "0.2rem 0.6rem",
  background: "#FEF3C7", color: "#92400E",
  borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700,
  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em",
};
const badgeParamStyle = {
  display: "inline-block", padding: "0.2rem 0.6rem",
  background: "#EFF6FF", color: "#1e3a5f",
  borderRadius: "20px", fontSize: "0.72rem", fontWeight: 700,
  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em",
};

// Aviso cuando el examen seleccionado es de tipo PDF
const pdfAvisoStyle = {
  background: "#FFFBEB", border: "1.5px dashed #FCD34D",
  borderRadius: "12px", padding: "2.5rem 2rem",
  textAlign: "center", marginTop: "0.5rem",
};