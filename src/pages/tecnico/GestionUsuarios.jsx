import { useState, useEffect, useMemo } from "react";
import API from "../../services/api";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ROLES = [
  { label: "Administrador",      value: "1" },
  { label: "Técnico",            value: "2" },
  { label: "Especialista",       value: "3" },
  { label: "Asistente Analista", value: "4" },
];
const TURNOS = ["Mañana", "Tarde"];
const ESPECIALIDADES = [
  "Sangre", "Orina", "Heces", "Secresiones", "Esputo",
  "Tejidos / Biopsias", "Líquido Cefalorraquídeo",
  "Inmunológicos / Pruebas Rápidas"
];


// ─── VALIDADORES ──────────────────────────────────────────────────────────────
const validarCedula    = (v) => /^\d{10}$/.test((v || "").trim());
const validarCorreo    = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
const validarPassword  = (v) => (v || "").length >= 6;

function camposExtraDeRol(id_rol, id_roles = []) {
  const rolStr = String(id_rol || "");
  // Unimos el rol principal + los roles adicionales marcados, para que
  // los campos requeridos aparezcan sin importar si el rol es principal o adicional.
  const todosLosRoles = [rolStr, ...(id_roles || []).map(String)];
  return {
    needsEspecialidad: todosLosRoles.includes("3"),
    needsTurno:        todosLosRoles.includes("4"),
    needsCargo:        todosLosRoles.includes("1"),
    needsNone:         todosLosRoles.every(r => r === "2" || r === ""),
  };
}

function tieneRolEspecialista(id_rol, id_roles) {
  return String(id_rol) === "3" || (Array.isArray(id_roles) && id_roles.includes("3"));
}

const DARK   = "#1F2937";
const ORANGE = "#E88B3A";
const FONT   = "'Barlow', sans-serif";
const FONTC  = "'Barlow Condensed', sans-serif";

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

// ─── ROLE BADGE COLORS ────────────────────────────────────────────────────────
const ROL_COLORS = {
  "Administrador":      { bg: "#EDE9FE", color: "#7C3AED" },
  "Técnico":            { bg: "#DBEAFE", color: "#1D4ED8" },
  "Especialista":       { bg: "#FEF3C7", color: "#B45309" },
  "Asistente Analista": { bg: "#D1FAE5", color: "#065F46" },
  "asistente_analista": { bg: "#D1FAE5", color: "#065F46" },
};

function RoleBadge({ nombre }) {
  const c = ROL_COLORS[nombre] || { bg: "#F3F4F6", color: DARK };
  return (
    <span style={{
      background: c.bg, color: c.color,
      padding: "0.2rem 0.55rem", borderRadius: "6px",
      fontWeight: 700, fontSize: "0.72rem",
      display: "inline-block", marginRight: "0.25rem", marginBottom: "0.2rem",
      fontFamily: FONTC, letterSpacing: "0.03em", textTransform: "uppercase"
    }}>
      {nombre}
    </span>
  );
}

// ─── MODAL VER DETALLE ────────────────────────────────────────────────────────
function ModalVer({ usuario, onClose }) {
  if (!usuario) return null;
  const roles = usuario.roles ? usuario.roles.split(", ") : [];
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalContainer, maxWidth: "520px" }} onClick={e => e.stopPropagation()}>
        <div style={{ ...styles.modalHeader, background: DARK }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
              width: 42, height: 42, borderRadius: "50%",
              background: ORANGE, display: "flex", alignItems: "center",
              justifyContent: "center", fontFamily: FONTC, fontWeight: 700,
              fontSize: "1.1rem", color: "#FFF"
            }}>
              {(usuario.nombres || "?")[0]}{(usuario.apellidos || "")[0]}
            </div>
            <div>
              <h3 style={{ fontFamily: FONTC, fontSize: "1.2rem", margin: 0, fontWeight: 700, color: "#FFF" }}>
                {usuario.nombres} {usuario.apellidos}
              </h3>
              <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>@{usuario.username}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ ...styles.btnCloseX, color: "#9CA3AF" }}>✕</button>
        </div>

        <div style={{ padding: "1.5rem", overflowY: "auto", maxHeight: "70vh" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            {[
              { label: "Cédula", value: usuario.cedula },
              { label: "Correo", value: usuario.correo },
              { label: "Cargo", value: usuario.cargo || "—" },
              { label: "Especialidad", value: usuario.especialidad || "—" },
              { label: "Turno", value: usuario.turno || "—" },
              
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "#F9FAFB", borderRadius: "8px", padding: "0.75rem" }}>
                <span style={{ fontSize: "0.7rem", fontFamily: FONTC, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block" }}>{label}</span>
                <span style={{ fontSize: "0.875rem", color: DARK, fontWeight: 600, wordBreak: "break-all" }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <span style={{ fontSize: "0.7rem", fontFamily: FONTC, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: "0.4rem" }}>Roles Asignados</span>
            <div>{roles.map(r => <RoleBadge key={r} nombre={r.trim()} />)}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "0.7rem", fontFamily: FONTC, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Estado:</span>
            <span style={usuario.estado ? styles.badgeActive : styles.badgeInactive}>
              {usuario.estado ? "✓ Activo" : "✗ Inactivo"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [examenesDisponibles, setExamenesDisponibles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showVerModal, setShowVerModal] = useState(false);
  const [usuarioVisto, setUsuarioVisto] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [filtroExamen, setFiltroExamen] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [vistaTabla, setVistaTabla] = useState("todos");
  const [toast, setToast] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [userToToggle, setUserToToggle] = useState(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina, setItemsPorPagina] = useState(10);

  const [formData, setFormData] = useState({
    id_usuario: null, cedula: "", nombres: "", apellidos: "",
    correo: "", username: "", password: "",
    id_rol: "", cargo: "", especialidad: "", turno: "",
    id_roles: [], examenes_asignados: []
  });

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3800);
  };

  useEffect(() => {
    fetchUsuarios();
    fetchExamenes();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const res = await API.get("/personal");
      setUsuarios(res.data || []);
    } catch (err) {
      console.error("Error al cargar personal:", err);
    }
  };

  const fetchExamenes = async () => {
    try {
      const res = await API.get("/examenes");
      setExamenesDisponibles(res.data || []);
    } catch (err) {
      console.error("Error al cargar exámenes:", err);
    }
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleToggleRolSecundario = (rolValue) => {
    let nuevosRoles = [...formData.id_roles];
    if (nuevosRoles.includes(rolValue)) {
      nuevosRoles = nuevosRoles.filter(id => id !== rolValue);
    } else {
      nuevosRoles.push(rolValue);
    }
    setFormData({ ...formData, id_roles: nuevosRoles });
  };

  // ── FIX: normalizamos siempre a String para evitar mismatch de tipos
  // (number vs string) entre lo que devuelve /examenes y /asignaciones.
  const handleToggleExamen = (idExamen) => {
    const id = String(idExamen);
    let nuevosExamenes = [...formData.examenes_asignados];
    if (nuevosExamenes.includes(id)) {
      nuevosExamenes = nuevosExamenes.filter(x => x !== id);
    } else {
      nuevosExamenes.push(id);
    }
    setFormData({ ...formData, examenes_asignados: nuevosExamenes });
  };

  const handleOpenRegister = () => {
    setFormData({
      id_usuario: null, cedula: "", nombres: "", apellidos: "",
      correo: "", username: "", password: "",
      id_rol: "", cargo: "", especialidad: "", turno: "",
      id_roles: [], examenes_asignados: []
    });
    setFormErrors({});
    setFiltroExamen("");
    setShowPassword(false);
    setShowModal(true);
  };

  const handleEdit = async (u) => {
    // ── DIAGNÓSTICO TEMPORAL: quitar estos console.log una vez resuelto ──────
    console.log("🔍 [DEBUG] Usuario completo recibido en handleEdit:", u);
    console.log("🔍 [DEBUG] u.roles crudo desde el backend:", JSON.stringify(u.roles));

    let rolPrincipal = "";
    if (u.roles) {
      const rolesArr = u.roles.split(", ").map(r => r.trim());
      const found = ROLES.find(r => rolesArr.includes(r.label));
      if (found) rolPrincipal = found.value;
    }

    const rolesActuales = u.roles
      ? u.roles.split(", ").map(r => {
          const found = ROLES.find(ro => ro.label === r.trim());
          return found ? found.value : null;
        }).filter(Boolean)
      : [];

    let examenesPrevios = [];
if (rolesActuales.includes("3")) {
  console.log("🔍 [DEBUG] Entrando a pedir /asignaciones para id_usuario:", u.id_usuario);
  try {
    const res = await API.get(`/asignaciones?id_usuario=${u.id_usuario}`);
    console.log("🔍 [DEBUG] Respuesta cruda de /asignaciones:", res.data);
    examenesPrevios = (res.data || []).map(ex => String(ex.id_examen));
    console.log("🔍 [DEBUG] examenesPrevios ya normalizados:", examenesPrevios);
  } catch (err) {
    console.error(
      "Error al cargar exámenes asignados:",
      err.response?.status,
      err.response?.data || err.message
    );
    showToast("error", "No se pudieron cargar los exámenes asignados de este especialista.");
  }
}

    // ── DIAGNÓSTICO TEMPORAL: quitar este console.log una vez resuelto ──────
    console.log("🔍 [DEBUG] examenes_asignados final antes de setFormData:", examenesPrevios);

    setFormData({
      id_usuario: u.id_usuario,
      cedula: u.cedula || "",
      nombres: u.nombres || "",
      apellidos: u.apellidos || "",
      correo: u.correo || "",
      username: u.username || "",
      password: "",
      id_rol: rolPrincipal,
      cargo: u.cargo || "",
      especialidad: u.especialidad || "",
      turno: u.turno || "",
      id_roles: rolesActuales,
      examenes_asignados: examenesPrevios
    });
    setFormErrors({});
    setFiltroExamen("");
    setShowPassword(false);
    setShowModal(true);
  };

  const handleVer = (u) => {
    setUsuarioVisto(u);
    setShowVerModal(true);
  };

  // ── Validación frontend ──────────────────────────────────────────────────────
  const validarFormData = () => {
    const e = {};
    if (!formData.nombres.trim())   e.nombres   = "Campo obligatorio.";
    if (!formData.apellidos.trim()) e.apellidos = "Campo obligatorio.";

    if (!formData.cedula.trim()) {
      e.cedula = "La cédula es obligatoria.";
    } else if (!validarCedula(formData.cedula)) {
      e.cedula = "La cédula debe tener exactamente 10 dígitos numéricos.";
    }

    if (!formData.correo.trim()) {
      e.correo = "El correo es obligatorio.";
    } else if (!validarCorreo(formData.correo)) {
      e.correo = "Ingresa un correo electrónico válido.";
    }

    if (!formData.username.trim()) e.username = "Campo obligatorio.";

    if (!formData.id_usuario) {
      // Registro nuevo: contraseña obligatoria y mínimo 6 chars
      if (!formData.password) {
        e.password = "La contraseña es obligatoria.";
      } else if (!validarPassword(formData.password)) {
        e.password = "La contraseña debe tener al menos 6 caracteres.";
      }
    } else if (formData.password && !validarPassword(formData.password)) {
      // Edición: si ingresa contraseña nueva, también debe cumplir mínimo
      e.password = "La contraseña debe tener al menos 6 caracteres.";
    }

    if (!formData.id_rol) e.id_rol = "Selecciona un rol principal.";

    // Especialista sin exámenes asignados → advertencia (no bloquea)
    const esEsp = tieneRolEspecialista(formData.id_rol, formData.id_roles);
    if (esEsp && formData.examenes_asignados.length === 0) {
      e._warn_examenes = "El especialista no tiene exámenes asignados. Puedes continuar, pero no podrá procesar resultados hasta que se le asignen.";
    }

    setFormErrors(e);
    // Errores reales (sin la advertencia) bloquean el envío
    const erroresDuros = Object.keys(e).filter(k => k !== "_warn_examenes");
    return erroresDuros.length === 0;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validarFormData()) return;

    let payload = { ...formData };
    const setRoles = new Set([formData.id_rol, ...formData.id_roles].filter(Boolean));
    payload.id_roles = Array.from(setRoles);

    const esEspecialista = tieneRolEspecialista(formData.id_rol, formData.id_roles);
    if (!esEspecialista) {
      payload.examenes_asignados = [];
    } else {
      // ── FIX: los exámenes se guardan como String en el estado del form
      // (para poder compararlos bien con .includes()), pero el backend
      // espera los IDs en su tipo numérico original. Los convertimos de
      // vuelta a Number justo antes de enviar el payload.
      payload.examenes_asignados = formData.examenes_asignados.map(Number);
    }

    try {
      if (formData.id_usuario) {
        const res = await API.put(`/personal/${formData.id_usuario}`, payload);
        showToast("success", res.data?.msg || "Personal actualizado correctamente.");
      } else {
        const res = await API.post("/personal/registro", payload);
        showToast("success", res.data?.msg || "Personal registrado correctamente.");
      }
      setShowModal(false);
      fetchUsuarios();
    } catch (err) {
      // El backend responde los errores como { error: "..." }, no { msg: "..." }
      const backendMsg = err.response?.data?.error || err.response?.data?.msg;
      showToast("error", backendMsg || "Error al procesar la solicitud.");
    }
  };

  // ── Preparar el toggle (Abre el modal) ───────────────────────────────────────
  const handleToggleClick = (u) => {
    setUserToToggle(u);
    setShowConfirmModal(true);
  };

  // ── Ejecutar toggle (Cuando el usuario confirma en el modal) ─────────────────
  const confirmarToggleEstado = async () => {
    if (!userToToggle) return;
    const { id_usuario, estado } = userToToggle;
    
    try {
      await API.patch(`/usuarios/status/${id_usuario}`, { estado: !estado });
      showToast("success", `Cuenta ${estado ? "desactivada" : "activada"} correctamente.`);
      fetchUsuarios();
    } catch (err) {
      showToast("error", "No se pudo cambiar el estado de la cuenta.");
      console.error(err);
    } finally {
      setShowConfirmModal(false);
      setUserToToggle(null);
    }
  };

  const { needsEspecialidad, needsTurno, needsCargo } = camposExtraDeRol(formData.id_rol, formData.id_roles);
  const esEspecialistaEnForm = tieneRolEspecialista(formData.id_rol, formData.id_roles);

  const examenesFiltrados = examenesDisponibles.filter(ex => {
    const nombre = ex.nombre_examen || ex.nombre || "";
    return nombre.toLowerCase().includes(filtroExamen.toLowerCase());
  });

  const examenesPorCategoria = examenesFiltrados.reduce((grupos, ex) => {
    const cat = ex.categoria || ex.tipo || "General";
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(ex);
    return grupos;
  }, {});

  const usuariosFiltrados = useMemo(() => {
    const term = busqueda.toLowerCase();
    return usuarios.filter(u => {
      const nombre = `${u.nombres} ${u.apellidos}`.toLowerCase();
      const user = (u.username || "").toLowerCase();
      const cedula = (u.cedula || "").toLowerCase();
      return nombre.includes(term) || user.includes(term) || cedula.includes(term);
    });
  }, [usuarios, busqueda]);

  const usuariosMixtos = usuariosFiltrados.filter(u => u.roles && u.roles.includes(","));
  const usuariosUnicos = usuariosFiltrados.filter(u => !u.roles || !u.roles.includes(","));

  const tablaActual = vistaTabla === "mixtos" ? usuariosMixtos
    : vistaTabla === "unicos" ? usuariosUnicos
    : usuariosFiltrados;

  // ── Paginado ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setPaginaActual(1);
  }, [busqueda, vistaTabla, itemsPorPagina]);

  const totalPaginas = Math.max(1, Math.ceil(tablaActual.length / itemsPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const inicioIndice = (paginaSegura - 1) * itemsPorPagina;
  const tablaPaginada = tablaActual.slice(inicioIndice, inicioIndice + itemsPorPagina);

  // ── Helper: input con error ──────────────────────────────────────────────────
  const errStyle = (name) => formErrors[name]
    ? { ...styles.fieldInput, borderColor: "#EF4444" }
    : styles.fieldInput;

  return (
    <div style={{ fontFamily: FONT, color: DARK, padding: "1.5rem" }}>
      <Toast toast={toast} />

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.75rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontFamily: FONTC, fontSize: "2rem", margin: 0, fontWeight: 700, letterSpacing: "0.03em", color: DARK }}>
            GESTIÓN DE  PERSONAL
          </h2>
          <p style={{ margin: "0.25rem 0 0", color: "#6B7280", fontSize: "0.875rem" }}>
            Administra las cuentas y roles del laboratorio
          </p>
        </div>
        <button onClick={handleOpenRegister} style={styles.btnPrimary}>
          + Registrar Personal
        </button>
      </div>

      {/* ── BARRA BÚSQUEDA + FILTROS ──────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1", minWidth: "220px" }}>
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: "0.9rem" }}>🔍</span>
          <input
            type="text"
            placeholder="Buscar por nombre, usuario o cédula..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{ ...styles.fieldInput, paddingLeft: "2.25rem", background: "#FFF", border: "1.5px solid #E5E7EB" }}
          />
        </div>

        <div style={{ display: "flex", background: "#F3F4F6", borderRadius: "10px", padding: "0.25rem", gap: "0.25rem" }}>
          {[
            { key: "todos", label: `Todos (${usuariosFiltrados.length})` },
            { key: "unicos", label: `Rol Único (${usuariosUnicos.length})` },
            { key: "mixtos", label: `Multi-Rol (${usuariosMixtos.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setVistaTabla(tab.key)}
              style={{
                ...styles.tabBtn,
                background: vistaTabla === tab.key ? "#FFF" : "transparent",
                color: vistaTabla === tab.key ? DARK : "#6B7280",
                boxShadow: vistaTabla === tab.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                fontWeight: vistaTabla === tab.key ? 700 : 500,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TABLA ─────────────────────────────────────────────────────────── */}
      <div style={styles.tableCard}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #F3F4F6", background: "#FAFAFA" }}>
              <th style={styles.th}>Personal</th>
              <th style={styles.th}>Cédula</th>
              <th style={styles.th}>Usuario / Correo</th>
              <th style={styles.th}>Roles</th>
              <th style={styles.th}>Estado</th>
              <th style={{ ...styles.th, textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tablaActual.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ ...styles.td, textAlign: "center", color: "#9CA3AF", padding: "2rem" }}>
                  {busqueda ? "No hay coincidencias para tu búsqueda." : "No se encontraron registros de personal."}
                </td>
              </tr>
            ) : (
              tablaPaginada.map((u) => {
                const rolesArr = u.roles ? u.roles.split(", ") : [];
                const esMixto = rolesArr.length > 1;
                return (
                  <tr key={u.id_usuario} style={{ borderBottom: "1px solid #F3F4F6", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={styles.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                          background: u.estado ? `${ORANGE}22` : "#F3F4F6",
                          border: `2px solid ${u.estado ? ORANGE : "#E5E7EB"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem",
                          color: u.estado ? ORANGE : "#9CA3AF"
                        }}>
                          {(u.nombres || "?")[0]}{(u.apellidos || "")[0]}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: DARK, display: "block" }}>{u.nombres} {u.apellidos}</span>
                          {u.cargo && <span style={styles.subtextBlock}>Cargo: {u.cargo}</span>}
                          {u.especialidad && <span style={styles.subtextBlock}>Esp: {u.especialidad}</span>}
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>{u.cedula}</td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 500 }}>{u.username}</span>
                      <span style={styles.subtextBlock}>{u.correo}</span>
                    </td>
                    <td style={styles.td}>
                      <div>
                        {rolesArr.map(r => <RoleBadge key={r} nombre={r.trim()} />)}
                        {esMixto && (
                          <span style={{ fontSize: "0.65rem", color: "#7C3AED", fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.04em", display: "block", marginTop: "0.2rem" }}>
                            MULTI-ROL
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={u.estado ? styles.badgeActive : styles.badgeInactive}>
                        {u.estado ? "✓ Activo" : "✗ Inactivo"}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                        <button onClick={() => handleVer(u)} title="Ver detalles" style={styles.btnVer}>
                          <span style={{ marginRight: "0.3rem" }}>👁</span> Ver
                        </button>
                        <button onClick={() => handleEdit(u)} title="Editar" style={styles.btnEditar}>
                          <span style={{ marginRight: "0.3rem" }}>✏️</span> Editar
                        </button>
                        {u.estado ? (
                        <button onClick={() => handleToggleClick(u)} title="Desactivar cuenta" style={styles.btnDesactivar}>
                          <span style={{ marginRight: "0.3rem" }}>🚫</span> Desactivar
                        </button>
                      ) : (
                        <button onClick={() => handleToggleClick(u)} title="Activar / Desbloquear cuenta" style={styles.btnActivar}>
                          <span style={{ marginRight: "0.3rem" }}>🔓</span> Desbloquear
                        </button>
                      )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── PAGINADO ──────────────────────────────────────────────────────── */}
      {tablaActual.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "0.75rem", marginTop: "1rem", padding: "0 0.25rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.8rem", color: "#6B7280", fontFamily: FONT }}>
            <span>
              Mostrando {inicioIndice + 1}–{Math.min(inicioIndice + itemsPorPagina, tablaActual.length)} de {tablaActual.length}
            </span>
            <select
              value={itemsPorPagina}
              onChange={(e) => setItemsPorPagina(Number(e.target.value))}
              style={{
                border: "1.5px solid #E5E7EB", borderRadius: "7px", padding: "0.3rem 0.5rem",
                fontFamily: FONT, fontSize: "0.78rem", color: DARK, background: "#FAFAFA", cursor: "pointer", outline: "none"
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
              style={{ ...styles.tabBtn, background: "#F3F4F6", color: paginaSegura === 1 ? "#D1D5DB" : DARK, cursor: paginaSegura === 1 ? "not-allowed" : "pointer" }}
            >
              «
            </button>
            <button
              onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
              disabled={paginaSegura === 1}
              style={{ ...styles.tabBtn, background: "#F3F4F6", color: paginaSegura === 1 ? "#D1D5DB" : DARK, cursor: paginaSegura === 1 ? "not-allowed" : "pointer" }}
            >
              ‹ Anterior
            </button>

            <span style={{ fontFamily: FONTC, fontSize: "0.8rem", color: DARK, fontWeight: 700, padding: "0 0.5rem" }}>
              Página {paginaSegura} de {totalPaginas}
            </span>

            <button
              onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaSegura === totalPaginas}
              style={{ ...styles.tabBtn, background: "#F3F4F6", color: paginaSegura === totalPaginas ? "#D1D5DB" : DARK, cursor: paginaSegura === totalPaginas ? "not-allowed" : "pointer" }}
            >
              Siguiente ›
            </button>
            <button
              onClick={() => setPaginaActual(totalPaginas)}
              disabled={paginaSegura === totalPaginas}
              style={{ ...styles.tabBtn, background: "#F3F4F6", color: paginaSegura === totalPaginas ? "#D1D5DB" : DARK, cursor: paginaSegura === totalPaginas ? "not-allowed" : "pointer" }}
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL VER ─────────────────────────────────────────────────────── */}
      {showVerModal && <ModalVer usuario={usuarioVisto} onClose={() => setShowVerModal(false)} />}

      {/* ── MODAL EDITAR / REGISTRAR ──────────────────────────────────────── */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={{ ...styles.modalContainer, maxWidth: "580px" }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={{ fontFamily: FONTC, fontSize: "1.4rem", margin: 0, fontWeight: 700, color: DARK }}>
                {formData.id_usuario ? "✏️ EDITAR PERSONAL" : "➕ REGISTRAR NUEVO PERSONAL"}
              </h3>
              <button onClick={() => setShowModal(false)} style={styles.btnCloseX}>✕</button>
            </div>

            <form onSubmit={handleSave} style={{ ...styles.modalBody, maxHeight: "80vh", overflowY: "auto" }}>

              {/* Advertencia especialista sin exámenes */}
              {formErrors._warn_examenes && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "0.65rem 0.85rem", fontSize: "0.82rem", color: "#92400E", marginBottom: "0.5rem" }}>
                  ⚠️ {formErrors._warn_examenes}
                </div>
              )}

              <div style={styles.grid2}>
                <div>
                  <label style={styles.fieldLabel}>Nombres *</label>
                  <input type="text" name="nombres" value={formData.nombres} onChange={handleChange} required style={errStyle("nombres")} />
                  {formErrors.nombres && <span style={styles.errTxt}>{formErrors.nombres}</span>}
                </div>
                <div>
                  <label style={styles.fieldLabel}>Apellidos *</label>
                  <input type="text" name="apellidos" value={formData.apellidos} onChange={handleChange} required style={errStyle("apellidos")} />
                  {formErrors.apellidos && <span style={styles.errTxt}>{formErrors.apellidos}</span>}
                </div>
              </div>

              <div style={styles.grid2}>
                <div>
                  <label style={styles.fieldLabel}>Cédula *</label>
                  <input type="text" name="cedula" value={formData.cedula} onChange={handleChange} maxLength={10} style={errStyle("cedula")} />
                  {formErrors.cedula && <span style={styles.errTxt}>{formErrors.cedula}</span>}
                </div>
                <div>
                  <label style={styles.fieldLabel}>Correo Electrónico *</label>
                  <input type="email" name="correo" value={formData.correo} onChange={handleChange} style={errStyle("correo")} />
                  {formErrors.correo && <span style={styles.errTxt}>{formErrors.correo}</span>}
                </div>
              </div>

              <div style={styles.grid2}>
                <div>
                  <label style={styles.fieldLabel}>Nombre de Usuario *</label>
                  <input type="text" name="username" value={formData.username} onChange={handleChange} style={errStyle("username")} />
                  {formErrors.username && <span style={styles.errTxt}>{formErrors.username}</span>}
                </div>
                <div>
                  <label style={styles.fieldLabel}>Contraseña {formData.id_usuario ? "(Opcional — mín. 6 chars si cambia)" : "* (mín. 6 caracteres)"}</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      style={errStyle("password")}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {formErrors.password && <span style={styles.errTxt}>{formErrors.password}</span>}
                </div>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={styles.fieldLabel}>Rol Principal *</label>
                <select name="id_rol" value={formData.id_rol} onChange={handleChange} style={formErrors.id_rol ? { ...styles.select, borderColor: "#EF4444" } : styles.select}>
                  <option value="">-- Seleccione un Rol Principal --</option>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {formErrors.id_rol && <span style={styles.errTxt}>{formErrors.id_rol}</span>}
              </div>

              {/* Roles Adicionales */}
              <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "#F9FAFB", borderRadius: "8px", border: "1px dashed #E5E7EB" }}>
                <label style={styles.fieldLabel}>Roles Adicionales (Multi-Rol)</label>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                  {ROLES.map((r) => {
                    if (r.value === formData.id_rol) return null;
                    const marcado = formData.id_roles.includes(r.value);
                    return (
                      <label key={r.value} style={{ display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", fontSize: "0.82rem", padding: "0.35rem 0.6rem", borderRadius: "6px", background: marcado ? "#EDE9FE" : "#F3F4F6", border: `1.5px solid ${marcado ? "#7C3AED" : "#E5E7EB"}`, transition: "all 0.15s" }}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => handleToggleRolSecundario(r.value)}
                          style={{ accentColor: ORANGE }}
                        />
                        <span style={{ fontWeight: marcado ? 700 : 500, color: marcado ? "#7C3AED" : DARK }}>{r.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              

              {needsCargo && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={styles.fieldLabel}>Cargo Administrativo *</label>
                  <input type="text" name="cargo" value={formData.cargo} onChange={handleChange} required style={styles.fieldInput} placeholder="Ej. Director, Supervisor" />
                </div>
              )}

              {needsTurno && (
                <div style={{ marginBottom: "1rem" }}>
                  <label style={styles.fieldLabel}>Turno Asignado *</label>
                  <select name="turno" value={formData.turno} onChange={handleChange} required style={styles.select}>
                    <option value="">-- Seleccione un Turno --</option>
                    {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {esEspecialistaEnForm && (
                <>
                  <div style={{ marginBottom: "1rem" }}>
                    <label style={styles.fieldLabel}>Especialidad (Área de Laboratorio) *</label>
                    <select name="especialidad" value={formData.especialidad} onChange={handleChange} required={needsEspecialidad} style={styles.select}>
                      <option value="">-- Seleccione una Especialidad --</option>
                      {ESPECIALIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: "1rem", padding: "0.85rem", background: "#FFFBEB", borderRadius: "8px", border: "1px solid #FDE68A" }}>
                    <label style={{ ...styles.fieldLabel, color: "#B45309" }}>
                      Exámenes Autorizados para Procesar
                      {formData.examenes_asignados.length > 0 && (
                        <span style={{ marginLeft: "0.5rem", background: "#FEF3C7", color: "#B45309", padding: "0.1rem 0.45rem", borderRadius: "4px", fontSize: "0.7rem" }}>
                          {formData.examenes_asignados.length} seleccionado{formData.examenes_asignados.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="🔍 Buscar examen..."
                      value={filtroExamen}
                      onChange={(e) => setFiltroExamen(e.target.value)}
                      style={{ ...styles.fieldInput, marginBottom: "0.75rem", background: "#FFF" }}
                    />
                    <div style={{ maxHeight: "200px", overflowY: "auto", paddingRight: "0.3rem" }}>
                      {examenesDisponibles.length === 0 ? (
                        <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>Cargando catálogo...</span>
                      ) : Object.keys(examenesPorCategoria).length === 0 ? (
                        <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>No hay coincidencias.</span>
                      ) : (
                        Object.keys(examenesPorCategoria).map((categoria) => (
                          <div key={categoria} style={{ marginBottom: "0.75rem" }}>
                            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#B45309", borderBottom: "1px solid #FDE68A", marginBottom: "0.3rem", paddingBottom: "0.1rem", textTransform: "uppercase", fontFamily: FONTC, letterSpacing: "0.06em" }}>
                              {categoria}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                              {examenesPorCategoria[categoria].map((ex) => {
                                // ── FIX: comparamos como String contra el arreglo
                                // formData.examenes_asignados (que ahora siempre
                                // guarda strings), sin importar si ex.id_examen
                                // viene como number o string desde el backend.
                                const seleccionado = formData.examenes_asignados.includes(String(ex.id_examen));
                                return (
                                  <label key={ex.id_examen} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: DARK, cursor: "pointer", padding: "0.3rem", borderRadius: "5px", background: seleccionado ? "#FEF3C7" : "transparent" }}>
                                    <input
                                      type="checkbox"
                                      checked={seleccionado}
                                      onChange={() => handleToggleExamen(ex.id_examen)}
                                      style={{ accentColor: ORANGE }}
                                    />
                                    {ex.nombre_examen || ex.nombre || "Examen"}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              <button type="submit" style={styles.btnSaveFull}>
                {formData.id_usuario ? "💾 Guardar Cambios" : "✅ Completar Registro"}
              </button>
            </form>
          </div>
        </div>
      )}

             {/* ── MODAL CONFIRMAR ACTIVAR/DESACTIVAR ───────────────────────────── */}
      {showConfirmModal && userToToggle && (
        <div style={styles.modalOverlay} onClick={() => setShowConfirmModal(false)}>
          <div style={{ ...styles.modalContainer, maxWidth: "420px", textAlign: "center", padding: "2rem" }} onClick={e => e.stopPropagation()}>
            
            <div style={{ 
              fontSize: "3rem", marginBottom: "1rem", 
              display: "flex", justifyContent: "center", alignItems: "center",
              width: "80px", height: "80px", borderRadius: "50%", margin: "0 auto 1.5rem",
              background: userToToggle.estado ? "#FEF2F2" : "#ECFDF5",
              color: userToToggle.estado ? "#DC2626" : "#059669"
            }}>
              {userToToggle.estado ? "⚠️" : "🔓"}
            </div>

            <h3 style={{ fontFamily: FONTC, fontSize: "1.6rem", margin: 0, fontWeight: 700, color: DARK }}>
              ¿{userToToggle.estado ? "Desactivar" : "Activar"} Usuario?
            </h3>
            
            <p style={{ color: "#6B7280", fontSize: "0.95rem", margin: "1rem 0 2rem", lineHeight: "1.5" }}>
              ¿Estás seguro de que deseas {userToToggle.estado ? "desactivar" : "activar"} la cuenta de <strong style={{ color: DARK }}>{userToToggle.nombres} {userToToggle.apellidos}</strong>?
              {userToToggle.estado && <br/>}
              {userToToggle.estado && <span style={{ fontSize: "0.85rem", color: "#EF4444", marginTop: "0.5rem", display: "inline-block" }}>El usuario no podrá acceder al sistema.</span>}
            </p>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
              <button 
                onClick={() => setShowConfirmModal(false)} 
                style={{ ...styles.btnPrimary, flex: 1, background: "#F3F4F6", color: "#4B5563" }}
              >
                Cancelar
              </button>
              <button 
                onClick={confirmarToggleEstado} 
                style={{ ...styles.btnPrimary, flex: 1, background: userToToggle.estado ? "#DC2626" : "#059669", color: "#FFF" }}
              >
                Sí, {userToToggle.estado ? "Desactivar" : "Activar"}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const styles = {
  btnPrimary: {
    background: DARK, color: "#FFF", border: "none", borderRadius: "10px",
    padding: "0.65rem 1.35rem", fontFamily: FONTC, fontWeight: 700,
    fontSize: "0.85rem", letterSpacing: "0.05em", textTransform: "uppercase",
    cursor: "pointer", transition: "opacity 0.15s",
  },
  tabBtn: {
    border: "none", borderRadius: "7px", padding: "0.4rem 0.85rem",
    fontFamily: FONTC, fontSize: "0.78rem", letterSpacing: "0.03em",
    cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  },
  tableCard: {
    background: "#FFF", borderRadius: "14px", border: "1px solid #E5E7EB",
    padding: "0.5rem 1rem 1rem", overflowX: "auto",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
  },
  th: {
    padding: "0.85rem 1rem", fontFamily: FONTC, fontSize: "0.75rem",
    fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.06em", textTransform: "uppercase"
  },
  td: { padding: "0.85rem 1rem", fontSize: "0.875rem", color: "#4B5563", verticalAlign: "middle" },
  subtextBlock: { display: "block", fontSize: "0.73rem", color: "#9CA3AF", marginTop: "0.1rem" },
  badgeActive:   { background: "#ECFDF5", color: "#059669", padding: "0.25rem 0.6rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", fontFamily: FONTC },
  badgeInactive: { background: "#FEF2F2", color: "#DC2626", padding: "0.25rem 0.6rem", borderRadius: "6px", fontWeight: 700, fontSize: "0.75rem", fontFamily: FONTC },
  btnVer: {
    display: "inline-flex", alignItems: "center", background: "#EFF6FF", color: "#1D4ED8",
    border: "1.5px solid #BFDBFE", borderRadius: "8px", padding: "0.35rem 0.7rem", fontSize: "0.75rem",
    fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  },
  btnEditar: {
    display: "inline-flex", alignItems: "center", background: `${ORANGE}18`, color: ORANGE,
    border: `1.5px solid ${ORANGE}55`, borderRadius: "8px", padding: "0.35rem 0.7rem", fontSize: "0.75rem",
    fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  },
  btnDesactivar: {
    display: "inline-flex", alignItems: "center", background: "#FEF2F2", color: "#DC2626",
    border: "1.5px solid #FECACA", borderRadius: "8px", padding: "0.35rem 0.7rem", fontSize: "0.75rem",
    fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  },
  btnActivar: {
    display: "inline-flex", alignItems: "center", background: "#ECFDF5", color: "#059669",
    border: "1.5px solid #A7F3D0", borderRadius: "8px", padding: "0.35rem 0.7rem", fontSize: "0.75rem",
    fontFamily: FONTC, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
  },
  modalOverlay: {
    position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
    background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem"
  },
  modalContainer: {
    background: "#FFF", width: "100%", borderRadius: "16px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)", overflow: "hidden"
  },
  modalHeader: {
    padding: "1.25rem 1.5rem", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center"
  },
  btnCloseX: {
    background: "none", border: "none", fontSize: "1.1rem", color: "#9CA3AF", cursor: "pointer", padding: "0.25rem"
  },
  modalBody: { padding: "1.5rem" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" },
  fieldLabel: {
    fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700, color: "#6B7280",
    display: "block", marginBottom: "0.3rem", letterSpacing: "0.08em", textTransform: "uppercase"
  },
  fieldInput: {
    width: "100%", padding: "0.55rem 0.8rem", border: "1.5px solid #E5E7EB", borderRadius: "8px",
    fontFamily: FONT, fontSize: "0.875rem", color: DARK, background: "#FAFAFA", outline: "none", boxSizing: "border-box"
  },
  errTxt: { fontSize: "0.72rem", color: "#EF4444", fontFamily: FONT, display: "block", marginTop: "0.2rem" },
  select: {
    width: "100%", padding: "0.55rem 0.8rem", border: "1.5px solid #E5E7EB", borderRadius: "8px",
    fontFamily: FONT, fontSize: "0.875rem", color: DARK, background: "#FAFAFA", outline: "none", cursor: "pointer"
  },
  eyeBtn: {
    position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer"
  },
  btnSaveFull: {
    width: "100%", padding: "0.75rem", background: ORANGE, color: "#FFF", border: "none", borderRadius: "8px",
    fontFamily: FONTC, fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer", marginTop: "1rem"
  },
};