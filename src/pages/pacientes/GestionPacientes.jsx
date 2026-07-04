import { useState, useEffect } from "react";
import API from "../../services/api";

const SEXOS = [{ label: "Masculino", value: "M" }, { label: "Femenino", value: "F" }];

// ─── VALIDADORES ──────────────────────────────────────────────────────────────
const validarCedula = (cedula) => /^\d{10}$/.test((cedula || "").trim());
const validarCorreo = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((correo || "").trim());
const validarSoloLetras = (texto) => /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test((texto || "").trim());
const validarTelefono = (telefono) => /^\d{10}$/.test((telefono || "").trim());

// Genera una contraseña temporal legible (sin caracteres ambiguos como 0/O, 1/l/I)
const generarPasswordTemporal = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

// Genera un username legible mezclando nombre + apellido + dígitos de la cédula
// (en vez de dejarlo como solo números), ej: "jennyg268"
const generarUsername = (nombres, apellidos, cedula) => {
  const limpiar = (txt) => (txt || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quita acentos
    .trim().toLowerCase()
    .split(/\s+/)[0]                                   // solo la primera palabra
    ?.replace(/[^a-z]/g, "") || "";
  const primerNombre    = limpiar(nombres);
  const inicialApellido = limpiar(apellidos).charAt(0);
  const sufijoCedula     = (cedula || "").toString().replace(/\D/g, "").slice(-3);
  const base = `${primerNombre}${inicialApellido}` || "usuario";
  return `${base}${sufijoCedula}`;
};

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{
      position: "fixed", top: "1.25rem", right: "1.25rem", zIndex: 9999,
      background: isErr ? "#991B1B" : "#166534",
      color: "#FFF", padding: "0.75rem 1.25rem", borderRadius: "10px",
      fontSize: "0.88rem", fontFamily: FONT, maxWidth: "360px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      display: "flex", alignItems: "center", gap: "0.5rem",
    }}>
      {isErr ? "✕" : "✓"}&ensp;{toast.msg}
    </div>
  );
}

// ─── COMPONENTE FIELD (AISLADO PARA NO PERDER EL FOCO) ────────────────────────
const Field = ({ label, error, name, style, ...props }) => (
  <div style={s.fieldGroup}>
    <label style={s.label}>{label}</label>
    <input
      name={name}
      {...props}
      style={{ ...s.input, ...style, borderColor: error ? "#EF4444" : "#E5E7EB" }}
    />
    {error && <span style={s.errTxt}>{error}</span>}
  </div>
);

// ──────────────────────────────────────────────────────────────────────────────

export default function GestionPacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const [errors, setErrors] = useState({});
  const [confirmEstado, setConfirmEstado] = useState(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(10);
  const [credencialesGeneradas, setCredencialesGeneradas] = useState(null); // { username, password }

  const [form, setForm] = useState({
    cedula: "", nombres: "", apellidos: "", correo: "",
    telefono: "", fecha_nacimiento: "", genero: "M",
    username: "", password: "", direccion: ""
  });

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3800);
  };

  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return "N/A";
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  };

  const cargarPacientes = async () => {
    try {
      const { data } = await API.get("/pacientes");
      setPacientes(data);
    } catch (err) { console.error("Error al cargar:", err); }
  };

  useEffect(() => { cargarPacientes(); }, []);

  const validarForm = () => {
    const e = {};
    
    // Cédula
    if (!(form.cedula || "").trim()) {
      e.cedula = "La cédula es obligatoria.";
    } else if (!validarCedula(form.cedula)) {
      e.cedula = "La cédula debe tener exactamente 10 dígitos numéricos.";
    }

    // Nombres
    if (!(form.nombres || "").trim()) {
      e.nombres = "Los nombres son obligatorios.";
    } else if (!validarSoloLetras(form.nombres)) {
      e.nombres = "Los nombres solo deben contener letras.";
    }

    // Apellidos
    if (!(form.apellidos || "").trim()) {
      e.apellidos = "Los apellidos son obligatorios.";
    } else if (!validarSoloLetras(form.apellidos)) {
      e.apellidos = "Los apellidos solo deben contener letras.";
    }

    // Teléfono
    if ((form.telefono || "").trim() && !validarTelefono(form.telefono)) {
      e.telefono = "El teléfono debe tener exactamente 10 números.";
    }

    // Correo
    if (!(form.correo || "").trim()) {
      e.correo = "El correo es obligatorio.";
    } else if (!validarCorreo(form.correo)) {
      e.correo = "Ingresa un correo electrónico válido.";
    }

    // Usuario y contraseña ya no se piden manualmente: se generan automáticamente al registrar.


    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleGuardar = async () => {
  if (!validarForm()) return;

  // ─── LIMPIEZA DE CAMPOS OPCIONALES VACÍOS ────────────────────────
  const payload = { ...form };
  
  if (!payload.fecha_nacimiento || payload.fecha_nacimiento.trim() === "") {
    payload.fecha_nacimiento = null;
  }
  if (!payload.telefono || payload.telefono.trim() === "") {
    payload.telefono = null;
  }
  if (!payload.direccion || payload.direccion.trim() === "") {
    payload.direccion = null;
  }

  try {
    if (isEditing) {
      await API.put(`/pacientes/${form.id_usuario}`, payload);
      showToast("success", "Paciente actualizado correctamente.");
      setShowModal(false);
      resetForm();
      cargarPacientes();
    } else {
      // Usuario y contraseña se generan automáticamente: nadie tiene que inventarlos.
      const password = generarPasswordTemporal();
      let username = generarUsername(payload.nombres, payload.apellidos, payload.cedula);

      const intentarRegistro = (usernameFinal) =>
        API.post("/pacientes/registro", { ...payload, username: usernameFinal, password });

      try {
        await intentarRegistro(username);
      } catch (err) {
        // Si ese nombre de usuario ya está en uso por otra cuenta, reintenta una vez con un sufijo numérico.
        const msg = err.response?.data?.error || err.response?.data?.msg || "";
        if (msg.toLowerCase().includes("usuario ya está en uso")) {
          username = `${username}${Math.floor(10 + Math.random() * 90)}`;
          await intentarRegistro(username);
        } else {
          throw err;
        }
      }

      showToast("success", "Paciente registrado correctamente.");
      setCredencialesGeneradas({ username, password });
      cargarPacientes();
    }
  } catch (err) {
    // CORRECCIÓN CRÍTICA: Ahora lee tanto 'error' como 'msg' del backend
    const mensajeDeError = err.response?.data?.error || err.response?.data?.msg || "Error al guardar el paciente";
    showToast("error", "Error: " + mensajeDeError);
    console.error("Detalle completo del error 400:", err.response?.data);
  }
};

  const cerrarModalRegistro = () => {
    setShowModal(false);
    setCredencialesGeneradas(null);
    resetForm();
  };

  const handleCambiarEstado = async () => {
    if (!confirmEstado) return;
    const p = confirmEstado;
    const accion = p.estado ? "desactivar" : "reactivar";
    try {
      if (p.estado) {
        await API.delete(`/pacientes/${p.id_usuario}`);
      } else {
        await API.put(`/pacientes/reactivar/${p.id_usuario}`);
      }
      showToast("success", `Paciente ${accion === "desactivar" ? "desactivado" : "reactivado"} correctamente.`);
      setConfirmEstado(null);
      cargarPacientes();
    } catch (err) {
      showToast("error", `Error al ${accion} el paciente.`);
      setConfirmEstado(null);
    }
  };

  const resetForm = () => {
    setForm({ cedula: "", nombres: "", apellidos: "", correo: "", telefono: "", fecha_nacimiento: "", genero: "M", username: "", password: "", direccion: "" });
    setErrors({});
    setIsEditing(false);
  };

  const filtrados = pacientes.filter(p =>
    (p.nombres || "").toLowerCase().includes(buscar.toLowerCase()) || 
    (p.cedula || "").includes(buscar)
  );

  // ── Paginado ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setPaginaActual(1);
  }, [buscar, itemsPorPagina]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / itemsPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicioIndice = (paginaSegura - 1) * itemsPorPagina;
  const paginados = filtrados.slice(inicioIndice, inicioIndice + itemsPorPagina);

  return (
    <div style={s.container}>
      <Toast toast={toast} />

      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>
          GESTIÓN DE <span style={s.titleAccent}>PACIENTES</span>
        </h2>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={s.searchWrap}>
            <span style={{ color: "#9CA3AF", fontSize: "0.9rem" }}>🔍</span>
            <input
              placeholder="Buscar por nombre o cédula..."
              onChange={(e) => setBuscar(e.target.value)}
              style={s.searchInput}
            />
          </div>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            style={s.btnPrimary}
          >
            + NUEVO PACIENTE
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        <div style={s.tableHeader}>
          <span style={{ flex: "0 0 130px" }}>CÉDULA</span>
          <span style={{ flex: 2 }}>NOMBRE COMPLETO</span>
          <span style={{ flex: 2 }}>CORREO</span>
          <span style={{ flex: "0 0 80px", textAlign: "center" }}>EDAD</span>
          <span style={{ flex: "0 0 100px", textAlign: "center" }}>ESTADO</span>
          <span style={{ flex: "0 0 90px", textAlign: "right" }}>ACCIONES</span>
        </div>
        <div>
          {filtrados.length === 0 ? (
            <div style={s.empty}>No se encontraron pacientes registrados.</div>
          ) : (
            paginados.map((p, idx) => (
              <div
                key={p.id_usuario}
                style={{ ...s.tableRow, background: idx % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }}
              >
                <div style={{ flex: "0 0 130px" }}>
                  <span style={s.cedulaBadge}>{p.cedula}</span>
                </div>
                <div style={{ flex: 2 }}>
                  <div style={s.rowName}>{p.nombres} {p.apellidos}</div>
                </div>
                <div style={{ flex: 2, color: "#6B7280", fontSize: "0.85rem" }}>
                  {p.correo || "—"}
                </div>
                <div style={{ flex: "0 0 80px", textAlign: "center" }}>
                  <span style={s.edadBadge}>{calcularEdad(p.fecha_nacimiento)} años</span>
                </div>
                <div style={{ flex: "0 0 100px", textAlign: "center" }}>
                  <span style={{
                    ...s.estadoBadge,
                    background: p.estado ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: p.estado ? "#059669" : "#DC2626",
                  }}>
                    {p.estado ? "ACTIVO" : "INACTIVO"}
                  </span>
                </div>
                <div style={{ flex: "0 0 90px", display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                  <button
                    onClick={() => {
                      // Al hacer click en editar, aseguramos que ningún campo llegue como null o undefined
                      const fechaFormateada = p.fecha_nacimiento
                        ? String(p.fecha_nacimiento).substring(0, 10)
                        : "";
                      setForm({ 
                        ...p, 
                        cedula: p.cedula || "",
                        nombres: p.nombres || "",
                        apellidos: p.apellidos || "",
                        correo: p.correo || "",
                        telefono: p.telefono || "",
                        direccion: p.direccion || "",
                        fecha_nacimiento: fechaFormateada 
                      });
                      setErrors({});
                      setIsEditing(true);
                      setShowModal(true);
                    }}
                    style={s.btnEdit}
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setConfirmEstado(p)}
                    style={{
                      ...s.btnToggle,
                      background: p.estado ? "rgba(220,38,38,0.1)" : "rgba(5,150,105,0.1)",
                      color: p.estado ? "#DC2626" : "#059669",
                    }}
                    title={p.estado ? "Desactivar" : "Reactivar"}
                  >
                    {p.estado ? "⏻" : "⏼"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Paginado */}
      {filtrados.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "0.75rem", marginTop: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.78rem", color: "#9CA3AF", fontFamily: FONT }}>
            <span>
              Mostrando {inicioIndice + 1}–{Math.min(inicioIndice + itemsPorPagina, filtrados.length)} de {filtrados.length} paciente{filtrados.length !== 1 ? "s" : ""}
            </span>
            <select
              value={itemsPorPagina}
              onChange={(e) => setItemsPorPagina(Number(e.target.value))}
              style={{
                border: "1.5px solid #E5E7EB", borderRadius: "7px", padding: "0.3rem 0.5rem",
                fontFamily: FONT, fontSize: "0.76rem", color: DARK, background: "#FAFAFA", cursor: "pointer", outline: "none"
              }}
            >
              {[10, 20, 50, 100].map(n => (
                <option key={n} value={n}>{n} por página</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <button
              onClick={() => setPaginaActual(1)}
              disabled={paginaSegura === 1}
              style={{ ...s.btnCancel, padding: "0.4rem 0.65rem", color: paginaSegura === 1 ? "#D1D5DB" : "#6B7280", cursor: paginaSegura === 1 ? "not-allowed" : "pointer" }}
            >
              «
            </button>
            <button
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaSegura === 1}
              style={{ ...s.btnCancel, padding: "0.4rem 0.65rem", color: paginaSegura === 1 ? "#D1D5DB" : "#6B7280", cursor: paginaSegura === 1 ? "not-allowed" : "pointer" }}
            >
              ‹ Anterior
            </button>

            <span style={{ fontFamily: FONTC, fontSize: "0.8rem", color: DARK, fontWeight: 700, padding: "0 0.5rem" }}>
              Página {paginaSegura} de {totalPaginas}
            </span>

            <button
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaSegura === totalPaginas}
              style={{ ...s.btnCancel, padding: "0.4rem 0.65rem", color: paginaSegura === totalPaginas ? "#D1D5DB" : "#6B7280", cursor: paginaSegura === totalPaginas ? "not-allowed" : "pointer" }}
            >
              Siguiente ›
            </button>
            <button
              onClick={() => setPaginaActual(totalPaginas)}
              disabled={paginaSegura === totalPaginas}
              style={{ ...s.btnCancel, padding: "0.4rem 0.65rem", color: paginaSegura === totalPaginas ? "#D1D5DB" : "#6B7280", cursor: paginaSegura === totalPaginas ? "not-allowed" : "pointer" }}
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <div>
                <h3 style={s.modalTitle}>
                  {isEditing ? "EDITAR" : "NUEVO"}{" "}
                  <span style={s.titleAccent}>PACIENTE</span>
                </h3>
                <p style={s.modalSubtitle}>
                  {isEditing ? "Actualiza la información del paciente" : "Completa los datos para registrar un nuevo paciente"}
                </p>
              </div>
              <button onClick={cerrarModalRegistro} style={s.closeBtn}>✕</button>
            </div>

            <div style={s.modalBody}>
              {credencialesGeneradas ? (
                <>
                  <div style={{
                    background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)",
                    border: "1.5px solid #86EFAC", borderRadius: "10px", padding: "1rem",
                  }}>
                    <p style={{ margin: "0 0 0.6rem", fontFamily: FONTC, fontWeight: 700, fontSize: "0.9rem", color: "#166534" }}>
                      ✓ Paciente registrado — entrégale estos datos de acceso
                    </p>
                    <div style={{ background: "#FFF", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "0.75rem 0.9rem", marginBottom: "0.6rem" }}>
                      <p style={{ margin: "0 0 0.3rem", fontSize: "0.88rem", color: DARK }}><b>Usuario:</b> {credencialesGeneradas.username}</p>
                      <p style={{ margin: 0, fontSize: "0.88rem", color: DARK }}><b>Contraseña temporal:</b> {credencialesGeneradas.password}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "#166534" }}>
                      El paciente podrá cambiar esta contraseña luego desde su perfil.
                    </p>
                  </div>
                  <div style={s.modalActions}>
                    <button onClick={cerrarModalRegistro} style={s.btnSave}>
                      ENTENDIDO
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={s.grid}>
                    <Field
                      label="Cédula *"
                      name="cedula"
                      error={errors.cedula}
                      placeholder="0000000000"
                      value={form.cedula || ""}
                      // VALIDACIÓN EN VIVO: Elimina cualquier cosa que no sea número
                      onChange={e => setForm({ ...form, cedula: e.target.value.replace(/\D/g, '') })}
                      maxLength={10}
                    />
                    {isEditing && (
                      <Field
                        label="Username Móvil"
                        name="username"
                        placeholder="usuario_movil"
                        value={form.username || ""}
                        disabled
                        style={{ background: "#F3F4F6", color: "#9CA3AF" }}
                      />
                    )}
                    <Field
                      label="Nombres *"
                      name="nombres"
                      error={errors.nombres}
                      placeholder="Nombres completos"
                      value={form.nombres || ""}
                      // VALIDACIÓN EN VIVO: Elimina números y caracteres especiales
                      onChange={e => setForm({ ...form, nombres: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '') })}
                    />
                    <Field
                      label="Apellidos *"
                      name="apellidos"
                      error={errors.apellidos}
                      placeholder="Apellidos completos"
                      value={form.apellidos || ""}
                      // VALIDACIÓN EN VIVO: Elimina números y caracteres especiales
                      onChange={e => setForm({ ...form, apellidos: e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '') })}
                    />
                    <Field
                      label="Correo *"
                      name="correo"
                      error={errors.correo}
                      placeholder="correo@ejemplo.com"
                      value={form.correo || ""}
                      onChange={e => setForm({ ...form, correo: e.target.value })}
                      type="email"
                    />
                    <div style={s.fieldGroup}>
                      <label style={s.label}>Fecha de Nacimiento</label>
                      <input
                        type="date"
                        value={form.fecha_nacimiento || ""}
                        onChange={e => setForm({ ...form, fecha_nacimiento: e.target.value })}
                        style={s.input}
                      />
                    </div>
                    <div style={s.fieldGroup}>
                      <label style={s.label}>Teléfono</label>
                      <input
                        placeholder="0999999999"
                        value={form.telefono || ""}
                        // VALIDACIÓN EN VIVO: Elimina cualquier cosa que no sea número
                        onChange={e => setForm({ ...form, telefono: e.target.value.replace(/\D/g, '') })}
                        maxLength={10}
                        style={{ ...s.input, borderColor: errors.telefono ? "#EF4444" : "#E5E7EB" }}
                      />
                      {errors.telefono && <span style={s.errTxt}>{errors.telefono}</span>}
                    </div>
                  </div>

                  {!isEditing && (
                    <p style={{ margin: "0.1rem 0 0", fontSize: "0.78rem", color: "#6B7280" }}>
                      El usuario y la contraseña de acceso se generan automáticamente; te los mostraremos al terminar de registrar.
                    </p>
                  )}

                  <div style={s.fieldGroup}>
                    <label style={s.label}>Dirección</label>
                    <input
                      placeholder="Dirección completa"
                      value={form.direccion || ""}
                      onChange={e => setForm({ ...form, direccion: e.target.value })}
                      style={s.input}
                    />
                  </div>

                  <div style={s.fieldGroup}>
                    <label style={s.label}>Género</label>
                    <select
                      value={form.genero || "M"}
                      onChange={e => setForm({ ...form, genero: e.target.value })}
                      style={s.select}
                    >
                      {SEXOS.map(sx => <option key={sx.value} value={sx.value}>{sx.label}</option>)}
                    </select>
                  </div>

                  <div style={s.modalActions}>
                    <button onClick={cerrarModalRegistro} style={s.btnCancel}>
                      CANCELAR
                    </button>
                    <button onClick={handleGuardar} style={s.btnSave}>
                      {isEditing ? "ACTUALIZAR PACIENTE" : "REGISTRAR PACIENTE"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR CAMBIO DE ESTADO */}
      {confirmEstado && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, width: "380px" }}>
            <div style={{
              ...s.modalHeader,
              background: confirmEstado.estado ? "#7F1D1D" : "#14532D",
            }}>
              <div>
                <h3 style={s.modalTitle}>
                  {confirmEstado.estado ? "DESACTIVAR" : "REACTIVAR"}{" "}
                  <span style={s.titleAccent}>PACIENTE</span>
                </h3>
                <p style={s.modalSubtitle}>
                  {confirmEstado.estado
                    ? "El paciente no podrá acceder al sistema"
                    : "El paciente recuperará acceso al sistema"}
                </p>
              </div>
              <button onClick={() => setConfirmEstado(null)} style={s.closeBtn}>✕</button>
            </div>

            <div style={{ padding: "1.25rem 1.5rem" }}>
              <div style={{
                background: confirmEstado.estado ? "#FEF2F2" : "#F0FDF4",
                border: `1px solid ${confirmEstado.estado ? "#FCA5A5" : "#86EFAC"}`,
                borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1.25rem",
                display: "flex", alignItems: "center", gap: "0.75rem",
              }}>
                <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>
                  {confirmEstado.estado ? "⚠️" : "✅"}
                </span>
                <div>
                  <p style={{
                    fontFamily: FONTC, fontSize: "0.78rem", fontWeight: 700,
                    color: confirmEstado.estado ? "#991B1B" : "#166534",
                    textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 0.2rem",
                  }}>
                    {confirmEstado.estado ? "Confirmar desactivación" : "Confirmar reactivación"}
                  </p>
                  <p style={{ fontSize: "0.88rem", fontWeight: 700, color: DARK, margin: "0 0 0.15rem" }}>
                    {confirmEstado.nombres} {confirmEstado.apellidos}
                  </p>
                  <p style={{ fontSize: "0.78rem", color: "#6B7280", margin: 0 }}>
                    Cédula: {confirmEstado.cedula}
                  </p>
                </div>
              </div>

              <div style={s.modalActions}>
                <button onClick={() => setConfirmEstado(null)} style={s.btnCancel}>
                  CANCELAR
                </button>
                <button
                  onClick={handleCambiarEstado}
                  style={{
                    ...s.btnSave,
                    background: confirmEstado.estado ? "#DC2626" : "#059669",
                  }}
                >
                  {confirmEstado.estado ? "SÍ, DESACTIVAR" : "SÍ, REACTIVAR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const DARK   = "#1F2937";
const ORANGE = "#E88B3A";
const FONT   = "'Barlow', sans-serif";
const FONTC  = "'Barlow Condensed', sans-serif";

const s = {
  container: { padding: "1.5rem", fontFamily: FONT },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem",
  },
  title: {
    fontFamily: FONTC, fontSize: "1.75rem", fontWeight: 700, color: DARK,
    margin: 0, textTransform: "uppercase", letterSpacing: "0.02em",
  },
  titleAccent: { color: ORANGE },
  searchWrap: {
    display: "flex", alignItems: "center", gap: "0.5rem", background: "#FFF",
    border: "1.5px solid #E5E7EB", borderRadius: "8px", padding: "0.5rem 0.9rem", minWidth: "260px",
  },
  searchInput: {
    border: "none", outline: "none", fontFamily: FONT, fontSize: "0.875rem",
    color: DARK, background: "transparent", flex: 1,
  },
  btnPrimary: {
    background: DARK, color: "#FFF", border: "none", padding: "0.6rem 1.25rem",
    borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem",
    letterSpacing: "0.06em", cursor: "pointer", whiteSpace: "nowrap",
  },
  tableWrap: {
    background: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB",
    overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  },
  tableHeader: {
    display: "flex", alignItems: "center", padding: "0.75rem 1.25rem",
    background: DARK, fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700,
    color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase",
  },
  tableRow: {
    display: "flex", alignItems: "center", padding: "0.85rem 1.25rem",
    borderBottom: "1px solid #F3F4F6", transition: "background 0.15s",
  },
  rowName: { fontWeight: 600, fontSize: "0.875rem", color: DARK },
  cedulaBadge: {
    background: "#F3F4F6", color: "#374151", padding: "0.2rem 0.6rem",
    borderRadius: "6px", fontSize: "0.8rem", fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.04em",
  },
  edadBadge: {
    background: "rgba(232,139,58,0.1)", color: ORANGE, padding: "0.2rem 0.5rem",
    borderRadius: "6px", fontSize: "0.78rem", fontFamily: FONTC, fontWeight: 700,
  },
  estadoBadge: {
    padding: "0.25rem 0.6rem", borderRadius: "6px", fontSize: "0.72rem",
    fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.05em",
  },
  btnEdit: {
    background: "rgba(59,130,246,0.1)", color: "#3B82F6", border: "none",
    width: "30px", height: "30px", borderRadius: "6px", cursor: "pointer",
    fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center",
  },
  btnToggle: {
    border: "none", width: "30px", height: "30px", borderRadius: "6px",
    cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center",
  },
  empty: { textAlign: "center", padding: "3rem", color: "#9CA3AF", fontFamily: FONT, fontSize: "0.9rem" },
  footer: { marginTop: "0.75rem", textAlign: "right", fontSize: "0.78rem", color: "#9CA3AF", fontFamily: FONT },
  // ─── MODAL ───
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
    display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000,
  },
  modal: {
    background: "#FFF", borderRadius: "12px", width: "540px", maxWidth: "95vw",
    overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    background: DARK, padding: "1.25rem 1.5rem",
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  },
  modalTitle: {
    fontFamily: FONTC, fontSize: "1.25rem", fontWeight: 700, color: "#FFF",
    margin: 0, letterSpacing: "0.05em",
  },
  modalSubtitle: { fontFamily: FONT, fontSize: "0.75rem", color: "#9CA3AF", margin: "0.25rem 0 0" },
  closeBtn: {
    background: "none", border: "none", color: "#9CA3AF", cursor: "pointer",
    fontSize: "1rem", lineHeight: 1, padding: "0.25rem",
  },
  modalBody: { padding: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "0.3rem" },
  label: {
    fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700, color: "#6B7280",
    letterSpacing: "0.08em", textTransform: "uppercase",
  },
  errTxt: { fontSize: "0.72rem", color: "#EF4444", fontFamily: FONT },
  input: {
    padding: "0.6rem 0.85rem", border: "1.5px solid #E5E7EB", borderRadius: "8px",
    fontFamily: FONT, fontSize: "0.875rem", color: DARK, background: "#FAFAFA",
    outline: "none", boxSizing: "border-box", width: "100%",
  },
  select: {
    padding: "0.6rem 0.85rem", border: "1.5px solid #E5E7EB", borderRadius: "8px",
    fontFamily: FONT, fontSize: "0.875rem", color: DARK, background: "#FAFAFA",
    outline: "none", width: "100%", cursor: "pointer",
  },
  modalActions: { display: "flex", gap: "0.75rem", marginTop: "0.5rem" },
  btnSave: {
    flex: 1, background: ORANGE, color: "#FFF", border: "none", padding: "0.75rem",
    borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem",
    letterSpacing: "0.06em", cursor: "pointer",
  },
  btnCancel: {
    background: "#F3F4F6", color: "#6B7280", border: "none", padding: "0.75rem 1.25rem",
    borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem",
    letterSpacing: "0.06em", cursor: "pointer",
  },
};