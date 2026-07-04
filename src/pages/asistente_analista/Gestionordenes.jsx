import { useState, useEffect, useRef } from "react";
import API from "../../services/api";
import jsQR from "jsqr";

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ESTADOS = ["Generada", "Pagada", "En Proceso", "Por Validar", "Validado"];

const EC = {
  "Generada":    { bg: "rgba(59,130,246,0.12)",  color: "#3B82F6",  icon: "📋" },
  "Pagada":      { bg: "rgba(16,185,129,0.12)",  color: "#10B981",  icon: "💳" },
  "En Proceso":  { bg: "rgba(139,92,246,0.12)",  color: "#8B5CF6",  icon: "🔬" },
  "Por Validar": { bg: "rgba(245,158,11,0.12)",  color: "#F59E0B",  icon: "⏳" },
  "Validado":    { bg: "rgba(16,185,129,0.12)",  color: "#059669",  icon: "✅" },
};

const PUEDE_EDITAR   = ["Generada"];
const PUEDE_ELIMINAR = ["Generada", "Cancelada"];

// ─── VALIDADORES DE DOCUMENTO ─────────────────────────────────────────────────
const validarCedula    = (v) => /^\d{10}$/.test((v || "").trim());
// Pasaporte: alfanumérico, entre 5 y 15 caracteres (letras y números, sin espacios)
const validarPasaporte = (v) => /^[A-Za-z0-9]{5,15}$/.test((v || "").trim());
const validarDocumento = (tipoDocumento, v) =>
  tipoDocumento === "pasaporte" ? validarPasaporte(v) : validarCedula(v);
// Filtra en vivo los caracteres permitidos según el tipo de documento
const limpiarDocumento = (tipoDocumento, v) =>
  tipoDocumento === "pasaporte"
    ? (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "")
    : (v || "").replace(/\D/g, "");

const FONT  = "'Barlow', sans-serif";
const FONTC = "'Barlow Condensed', sans-serif";
const DARK  = "#1F2937";
const ORANGE = "#E88B3A";

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === "error";
  return (
    <div style={{
      position: "fixed", top: "1.25rem", right: "1.25rem", zIndex: 9999,
      background: isErr ? "#991B1B" : "#166534",
      color: "#FFF", padding: "0.75rem 1.25rem", borderRadius: "10px",
      fontSize: "0.88rem", fontFamily: FONT, maxWidth: "380px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      display: "flex", alignItems: "center", gap: "0.5rem",
    }}>
      {isErr ? "✕" : "✓"}&ensp;{toast.msg}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function GestionOrdenes() {
  const [ordenes, setOrdenes]     = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [examenes, setExamenes]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [buscar, setBuscar]       = useState("");
  const [desde, setDesde]         = useState("");
  const [hasta, setHasta]         = useState("");
  const [pagina, setPagina]       = useState(1);
  const PAGE_SIZE = 10;
  const [toast, setToast]         = useState(null);

  // Crear orden
  const [showCrear, setShowCrear]   = useState(false);
  const [tipoDocumentoInput, setTipoDocumentoInput] = useState("cedula");
  const [cedulaInput, setCedulaInput] = useState("");
  const [busquedaExamen, setBusquedaExamen] = useState("");
  const [form, setForm] = useState({ id_paciente: "", examenes: [] });
  const [guardando, setGuardando] = useState(false);
  const [qrResult, setQrResult]   = useState(null);
  const [msgCrear, setMsgCrear]   = useState(null);

  // Registro rápido de paciente (desde el modal de Nueva Orden)
  const [showRegistroRapido, setShowRegistroRapido] = useState(false);
  const [showMasDatosRegistro, setShowMasDatosRegistro] = useState(false);
  const [formRegistro, setFormRegistro] = useState({
    nombres: "", apellidos: "", correo: "",
    fecha_nacimiento: "", telefono: "", direccion: "", genero: "",
  });
  const [guardandoRegistro, setGuardandoRegistro] = useState(false);
  const [msgRegistro, setMsgRegistro] = useState(null);
  const [buscandoDoc, setBuscandoDoc] = useState(false);
  const [credencialesGeneradas, setCredencialesGeneradas] = useState(null); // { username, password }

  // Reactivar paciente inactivo (desde el modal de Nueva Orden)
  const [reactivando, setReactivando] = useState(false);

  // Ver detalle
  const [showDetalle, setShowDetalle] = useState(null);
  const [detalleExamenes, setDetalleExamenes] = useState([]);
  const [loadingDetalle, setLoadingDetalle]   = useState(false);

  // Editar orden
  const [showEditar, setShowEditar]           = useState(null);
  const [editExamenes, setEditExamenes]       = useState([]);
  const [busquedaEditExamen, setBusquedaEditExamen] = useState("");
  const [guardandoEdit, setGuardandoEdit]     = useState(false);
  const [msgEdit, setMsgEdit]                 = useState(null);

  // Eliminar
  const [showConfirmEliminar, setShowConfirmEliminar] = useState(null);
  const [eliminando, setEliminando]                   = useState(false);

  // QR Lector
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [showQR, setShowQR]         = useState(false);
  const [qrError, setQrError]       = useState("");
  const [qrInvalido, setQrInvalido] = useState(false);
  const [qrLoading, setQrLoading]   = useState(false);
  const [ordenEscaneada, setOrdenEscaneada] = useState(null);
  const [ticketManual, setTicketManual]     = useState("");
  const [modoQR, setModoQR]         = useState("camara");
  const [showQRAcciones, setShowQRAcciones] = useState(false);

  // ── Toast helper ────────────────────────────────────────────────────────────
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3800);
  };

  // ── CARGAR DATOS ─────────────────────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    try {
      const [resOrd, resPac, resExam] = await Promise.all([
        API.get(`/ordenes${filtroEstado ? `?estado=${filtroEstado}` : ""}`).catch(() => ({ data: [] })),
        API.get("/pacientes").catch(() => ({ data: [] })),
        API.get("/examenes").catch(() => ({ data: [] })),
      ]);
      setOrdenes(resOrd.data   || []);
      setPacientes(resPac.data || []);
      setExamenes((resExam.data || []).filter(e => e.estado !== false));
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { cargar(); }, [filtroEstado]);

  // Buscar paciente por cédula en tiempo real
  const pacienteEncontrado = pacientes.find(
    p => p.estado && p.cedula?.toString().trim() === cedulaInput.trim()
  );
  // Si la cédula pertenece a un paciente que existe pero está en la papelera (inactivo)
  const pacienteInactivo = pacientes.find(
    p => !p.estado && p.cedula?.toString().trim() === cedulaInput.trim()
  );
  useEffect(() => {
    setForm(f => ({ ...f, id_paciente: pacienteEncontrado
      ? (pacienteEncontrado.id_paciente || pacienteEncontrado.id_usuario)
      : "" }));
  }, [cedulaInput, pacienteEncontrado]);

  // Agrupar exámenes por categoría
  const agruparExamenes = (lista) => lista.reduce((acc, ex) => {
    const cat = ex.nombre_categoria || "Otros";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(ex);
    return acc;
  }, {});
  const examenesAgrupados = agruparExamenes(examenes);

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = ESTADOS.reduce((acc, e) => {
    acc[e] = ordenes.filter(o => o.estado === e).length;
    return acc;
  }, {});

  // ── CREAR ORDEN ──────────────────────────────────────────────────────────────
  const handleCrearOrden = async () => {
    if (!form.id_paciente) return setMsgCrear({ type: "error", text: "Ingrese un documento válido de un paciente registrado." });
    if (form.examenes.length === 0) return setMsgCrear({ type: "error", text: "Agrega al menos un examen." });
    setGuardando(true); setMsgCrear(null);
    try {
      const examenesPayload = form.examenes.map(idStr => {
        const ex = examenes.find(e => String(e.id_examen) === String(idStr));
        return { id_examen: ex.id_examen, precio: parseFloat(ex.precio) };
      });
      const { data } = await API.post("/ordenes/paciente/generar", {
        id_paciente: parseInt(form.id_paciente),
        examenes: examenesPayload,
      });
      setQrResult(data);
      setShowCrear(false);
      setForm({ id_paciente: "", examenes: [] });
      setCedulaInput(""); setTipoDocumentoInput("cedula"); setBusquedaExamen("");
      resetFormRegistro();
      cargar();
    } catch (err) {
      setMsgCrear({ type: "error", text: err.response?.data?.error || "Error al crear la orden." });
    } finally { setGuardando(false); }
  };

  // ── REGISTRO RÁPIDO DE PACIENTE (desde Nueva Orden) ──────────────────────────
  const resetFormRegistro = () => {
    setFormRegistro({ nombres: "", apellidos: "", correo: "", fecha_nacimiento: "", telefono: "", direccion: "", genero: "" });
    setMsgRegistro(null);
    setShowRegistroRapido(false);
    setShowMasDatosRegistro(false);
    setCredencialesGeneradas(null);
  };

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
    const primerNombre   = limpiar(nombres);
    const inicialApellido = limpiar(apellidos).charAt(0);
    const sufijoCedula    = (cedula || "").toString().replace(/\D/g, "").slice(-3);
    const base = `${primerNombre}${inicialApellido}` || "usuario";
    return `${base}${sufijoCedula}`;
  };

  // Autocompleta nombres/apellidos consultando el servicio gratuito del SRI.
  // Solo aplica para cédula (no pasaporte); los campos quedan siempre editables.
  const buscarDatosPorCedula = async () => {
    const cedula = cedulaInput.trim();
    if (tipoDocumentoInput !== "cedula" || !/^\d{10}$/.test(cedula)) return;
    setBuscandoDoc(true);
    try {
      const { data } = await API.get(`/documento/consultar/${cedula}`);
      setFormRegistro(f => ({
        ...f,
        nombres: data.nombres || f.nombres,
        apellidos: data.apellidos || f.apellidos,
      }));
      showToast("success", "Datos encontrados. Verifica que estén correctos antes de guardar.");
    } catch (err) {
      showToast("error", err.response?.data?.error || "No se encontraron datos para esta cédula.");
    } finally {
      setBuscandoDoc(false);
    }
  };

  const handleRegistroRapido = async () => {
    const { nombres, apellidos, correo, fecha_nacimiento } = formRegistro;
    const cedula = cedulaInput.trim();
    if (!cedula) {
      return setMsgRegistro({ type: "error", text: tipoDocumentoInput === "pasaporte" ? "Falta el pasaporte." : "Falta la cédula." });
    }
    if (!validarDocumento(tipoDocumentoInput, cedula)) {
      return setMsgRegistro({
        type: "error",
        text: tipoDocumentoInput === "pasaporte"
          ? "El pasaporte debe tener entre 5 y 15 caracteres alfanuméricos."
          : "La cédula debe tener exactamente 10 dígitos numéricos.",
      });
    }
    if (!nombres || !apellidos || !correo || !fecha_nacimiento) {
      return setMsgRegistro({ type: "error", text: "Completa nombres, apellidos, correo y fecha de nacimiento." });
    }
    setGuardandoRegistro(true); setMsgRegistro(null);

    // Usuario y contraseña se generan automáticamente: la secretaria no tiene que inventarlos.
    const password = generarPasswordTemporal();
    let username = generarUsername(nombres, apellidos, cedula);

    const intentarRegistro = async (usernameFinal) =>
      API.post("/pacientes/registro", { cedula, tipo_documento: tipoDocumentoInput, username: usernameFinal, password, ...formRegistro });

    try {
      try {
        await intentarRegistro(username);
      } catch (err) {
        // Si ese nombre de usuario ya está en uso por otra cuenta, reintenta una vez con un sufijo numérico.
        const msg = err.response?.data?.error || "";
        if (msg.toLowerCase().includes("usuario ya está en uso")) {
          username = `${username}${Math.floor(10 + Math.random() * 90)}`;
          await intentarRegistro(username);
        } else {
          throw err;
        }
      }
      setCredencialesGeneradas({ username, password });
      await cargar(); // recarga pacientes para que el paciente recién creado quede seleccionado automáticamente
    } catch (err) {
      setMsgRegistro({ type: "error", text: err.response?.data?.error || "Error al registrar el paciente." });
    } finally { setGuardandoRegistro(false); }
  };

  // ── REACTIVAR PACIENTE INACTIVO (desde Nueva Orden) ──────────────────────────
  const handleReactivarDesdeOrden = async () => {
    if (!pacienteInactivo) return;
    setReactivando(true);
    try {
      await API.put(`/pacientes/reactivar/${pacienteInactivo.id_usuario}`);
      showToast("success", "Paciente reactivado. Ya puedes continuar con la orden.");
      await cargar();
    } catch (err) {
      showToast("error", err.response?.data?.msg || "Error al reactivar el paciente.");
    } finally { setReactivando(false); }
  };

  // ── VER DETALLE ──────────────────────────────────────────────────────────────
  const abrirDetalle = async (o) => {
    setShowDetalle(o);
    setDetalleExamenes([]);
    setLoadingDetalle(true);
    try {
      const res = await API.get(`/ordenes/${o.id_orden}/detalle`).catch(() => null);
      if (res?.data?.detalles) setDetalleExamenes(res.data.detalles);
      else if (res?.data) setDetalleExamenes(Array.isArray(res.data) ? res.data : []);
    } catch {} finally { setLoadingDetalle(false); }
  };

  // ── EDITAR ORDEN ──────────────────────────────────────────────────────────────
  const abrirEditar = async (o) => {
    setShowEditar(o);
    setMsgEdit(null);
    setBusquedaEditExamen("");
    try {
      const res = await API.get(`/ordenes/${o.id_orden}/detalle`).catch(() => null);
      const actuales = res?.data || [];
      const idsMapeados = actuales.map(d => String(d.id_examen));
      setEditExamenes(idsMapeados);
    } catch (err) {
      console.error("Error cargando exámenes de la orden:", err);
      setEditExamenes([]);
    }
  };

  const toggleEditExamen = (id) => {
    const sid = String(id);
    setEditExamenes(prev => prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]);
  };

  const handleGuardarEdicion = async () => {
    if (editExamenes.length === 0) return setMsgEdit({ type: "error", text: "Debe quedar al menos un examen en la orden." });
    setGuardandoEdit(true); setMsgEdit(null);
    try {
      const examenesPayload = editExamenes.map(idStr => {
        const ex = examenes.find(e => String(e.id_examen) === String(idStr));
        return { id_examen: ex.id_examen, precio: parseFloat(ex.precio) };
      });
      await API.put(`/ordenes/secretaria/corregir`, {
        id_orden: showEditar.id_orden,
        examenes: examenesPayload,
      });
      showToast("success", "Orden actualizada correctamente.");
      setShowEditar(null);
      cargar();
    } catch (err) {
      setMsgEdit({ type: "error", text: err.response?.data?.error || "Error al guardar los cambios." });
    } finally { setGuardandoEdit(false); }
  };

  // ── ELIMINAR ORDEN ────────────────────────────────────────────────────────────
  const handleEliminar = async () => {
    if (!showConfirmEliminar) return;
    setEliminando(true);
    try {
      await API.delete(`/ordenes/${showConfirmEliminar.id_orden}`);
      setOrdenes(prev => prev.filter(o => o.id_orden !== showConfirmEliminar.id_orden));
      showToast("success", `Orden ${showConfirmEliminar.numero_ticket} eliminada permanentemente.`);
      setShowConfirmEliminar(null);
    } catch (err) {
      showToast("error", err.response?.data?.error || "Error al eliminar la orden.");
    } finally { setEliminando(false); }
  };

  // ── QR CÁMARA ─────────────────────────────────────────────────────────────────
  const iniciarCamara = async () => {
    setQrError(""); setQrInvalido(false);
    setOrdenEscaneada(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true);
        videoRef.current.play();
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        const scan = () => {
          if (!videoRef.current || !streamRef.current) return;
          if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
            canvas.height = videoRef.current.videoHeight;
            canvas.width  = videoRef.current.videoWidth;
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
            if (code && code.data) { detenerCamara(); buscarOrdenQR(code.data); return; }
          }
          requestAnimationFrame(scan);
        };
        requestAnimationFrame(scan);
      }
    } catch { setQrError("No se pudo acceder a la cámara. Verifica los permisos de tu navegador."); }
  };

  const detenerCamara = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  useEffect(() => {
    if (showQR && modoQR === "camara" && !ordenEscaneada) iniciarCamara();
    return () => detenerCamara();
  }, [showQR, modoQR]);

  const buscarOrdenQR = async (valor) => {
    setQrLoading(true); setQrError(""); setQrInvalido(false); setOrdenEscaneada(null);
    try {
      const { data } = await API.post("/ordenes/buscar", { filtro: valor });
      setOrdenEscaneada(data);
      setShowQRAcciones(true);
    } catch (err) {
      const status = err.response?.status;
      const mensaje = err.response?.data?.message || "";
      if (status === 401 || status === 403 || status === 410 ||
          mensaje.toLowerCase().includes("expir") ||
          mensaje.toLowerCase().includes("inválido") ||
          mensaje.toLowerCase().includes("invalido")) {
        setQrInvalido(true);
        setQrError(mensaje || "El código QR ha expirado o ya no es válido. Solicita uno nuevo.");
      } else {
        setQrError(mensaje || "No se encontró ninguna orden con ese código.");
      }
    } finally { setQrLoading(false); }
  };

  const buscarManual = async () => {
    if (!ticketManual.trim()) return;
    await buscarOrdenQR(ticketManual.trim().toUpperCase());
  };

  const cerrarQR = () => {
    setShowQR(false);
    setShowQRAcciones(false);
    setOrdenEscaneada(null);
    setQrInvalido(false);
    setQrError("");
    detenerCamara();
  };

  const toggleExamen = (id) => {
    const sid = String(id);
    setForm(f => ({ ...f, examenes: f.examenes.includes(sid) ? f.examenes.filter(x => x !== sid) : [...f.examenes, sid] }));
  };

  const filtradas = ordenes.filter(o => {
    const txt = `${o.nombres || ""} ${o.apellidos || ""} ${o.numero_ticket || ""}`.toLowerCase();
    if (!txt.includes(buscar.toLowerCase())) return false;
    if (o.fecha_orden) {
      const fOrden = new Date(o.fecha_orden).toISOString().split("T")[0];
      if (desde && fOrden < desde) return false;
      if (hasta && fOrden > hasta) return false;
    } else if (desde || hasta) {
      return false;
    }
    return true;
  });

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const paginadas = filtradas.slice((paginaSegura - 1) * PAGE_SIZE, paginaSegura * PAGE_SIZE);

  useEffect(() => { setPagina(1); }, [buscar, filtroEstado, desde, hasta]);

  return (
    <div style={{ padding: "1.25rem", fontFamily: FONT, color: DARK }}>
      <Toast toast={toast} />

      {/* ── ENCABEZADO ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontFamily: FONTC, fontSize: "1.85rem", fontWeight: 800, color: DARK, margin: 0, textTransform: "uppercase" }}>
            GESTIÓN DE <span style={{ color: ORANGE }}>ÓRDENES</span>
          </h2>
          <p style={{ fontSize: "0.85rem", color: "#6B7280", margin: "0.2rem 0 0" }}>
            Crear, editar y gestionar órdenes médicas del laboratorio
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.65rem" }}>
          <button
            onClick={() => { setShowQR(true); setOrdenEscaneada(null); setQrError(""); setQrInvalido(false); setTicketManual(""); setModoQR("camara"); setShowQRAcciones(false); }}
            style={s.btnSecondary}
          >
            📷 LEER QR / TICKET
          </button>
          <button onClick={() => { setShowCrear(true); setMsgCrear(null); setCedulaInput(""); setForm({ id_paciente: "", examenes: [] }); }} style={s.btnPrimary}>
            + NUEVA ORDEN
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem", marginBottom: "1.5rem" }}>
        {ESTADOS.map(estado => {
          const e = EC[estado];
          return (
            <button
              key={estado}
              onClick={() => setFiltroEstado(filtroEstado === estado ? "" : estado)}
              style={{
                background: filtroEstado === estado ? e.bg : "#FFF",
                border: `1.5px solid ${filtroEstado === estado ? e.color : "#E5E7EB"}`,
                borderRadius: "10px", padding: "0.65rem 0.75rem", cursor: "pointer",
                textAlign: "left", transition: "all 0.15s",
              }}
            >
              <p style={{ fontFamily: FONTC, fontSize: "0.65rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.15rem", fontWeight: 700 }}>
                {e.icon} {estado}
              </p>
              <p style={{ fontFamily: FONTC, fontSize: "1.5rem", fontWeight: 800, color: e.color, margin: 0, lineHeight: 1 }}>
                {kpis[estado] || 0}
              </p>
            </button>
          );
        })}
      </div>

      {/* ── FILTROS ── */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <div style={s.searchWrap}>
          <span style={{ color: "#9CA3AF" }}>🔍</span>
          <input placeholder="Buscar paciente o ticket..." value={buscar} onChange={e => setBuscar(e.target.value)} style={s.searchInput} />
          {buscar && <button onClick={() => setBuscar("")} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer" }}>✕</button>}
        </div>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={s.select}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <input type="date" value={desde} max={hasta || undefined} onChange={e => setDesde(e.target.value)} style={s.select} title="Desde" />
        <input type="date" value={hasta} min={desde || undefined} onChange={e => setHasta(e.target.value)} style={s.select} title="Hasta" />
        {(filtroEstado || desde || hasta) && (
          <button onClick={() => { setFiltroEstado(""); setDesde(""); setHasta(""); }} style={{ ...s.btnSecondary, padding: "0.5rem 0.85rem", fontSize: "0.78rem" }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* ── TABLA ── */}
      <div style={s.tableWrap}>
        <div style={s.tableHead}>
          <span style={{ flex: "0 0 130px" }}>TICKET</span>
          <span style={{ flex: 2 }}>PACIENTE</span>
          <span style={{ flex: 1 }}>ESTADO</span>
          <span style={{ flex: 1 }}>FECHA</span>
          <span style={{ flex: "0 0 90px", textAlign: "right" }}>TOTAL</span>
          <span style={{ flex: "0 0 185px", textAlign: "center" }}>ACCIONES</span>
        </div>

        {loading ? (
          <div style={s.empty}>Cargando órdenes...</div>
        ) : filtradas.length === 0 ? (
          <div style={s.empty}>No hay órdenes para mostrar</div>
        ) : (
          paginadas.map((o, i) => {
            const ec = EC[o.estado] || { bg: "#F8FAFC", color: "#6B7280" };
            const puedeEditar   = PUEDE_EDITAR.includes(o.estado);
            const puedeEliminar = PUEDE_ELIMINAR.includes(o.estado);
            return (
              <div
                key={o.id_orden}
                style={{ ...s.tableRow, background: i % 2 === 0 ? "#FFF" : "#F9FAFB" }}
                onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#FFF" : "#F9FAFB"}
              >
                <span style={{ flex: "0 0 130px", fontFamily: FONTC, fontWeight: 700, color: ORANGE }}>{o.numero_ticket}</span>
                <span style={{ flex: 2, fontWeight: 500 }}>{o.nombres} {o.apellidos}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ background: ec.bg, color: ec.color, padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: 700, fontFamily: FONTC, textTransform: "uppercase" }}>
                    {ec.icon} {o.estado}
                  </span>
                </span>
                <span style={{ flex: 1, fontSize: "0.85rem", color: "#6B7280" }}>{o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString() : "—"}</span>
                <span style={{ flex: "0 0 90px", textAlign: "right", fontWeight: 700, fontFamily: FONTC }}>${parseFloat(o.total || 0).toFixed(2)}</span>
                <span style={{ flex: "0 0 185px", display: "flex", gap: "0.35rem", justifyContent: "center" }}>
                  <button onClick={() => abrirDetalle(o)} style={{ ...s.btnIcon, background: "#F3F4F6", color: DARK }} title="Ver detalle">👁️</button>
                  {puedeEditar && <button onClick={() => abrirEditar(o)} style={{ ...s.btnIcon, background: "rgba(59,130,246,0.1)", color: "#3B82F6" }} title="Editar">✏️</button>}
                  {puedeEliminar && <button onClick={() => setShowConfirmEliminar(o)} style={{ ...s.btnIcon, background: "rgba(127,29,29,0.1)", color: "#7F1D1D" }} title="Eliminar permanentemente">🗑️</button>}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ── PAGINADO ── */}
      {!loading && filtradas.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.85rem", flexWrap: "wrap", gap: "0.75rem" }}>
          <p style={{ fontSize: "0.8rem", color: "#6B7280", margin: 0 }}>
            Mostrando {(paginaSegura - 1) * PAGE_SIZE + 1}–{Math.min(paginaSegura * PAGE_SIZE, filtradas.length)} de {filtradas.length} órdenes
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={() => setPagina(p => Math.max(1, p - 1))}
              disabled={paginaSegura === 1}
              style={{ ...s.btnCancel, padding: "0.45rem 0.85rem", opacity: paginaSegura === 1 ? 0.45 : 1, cursor: paginaSegura === 1 ? "default" : "pointer" }}
            >
              ‹ Anterior
            </button>
            <span style={{ fontFamily: FONTC, fontSize: "0.82rem", fontWeight: 700, color: DARK, padding: "0 0.4rem" }}>
              Página {paginaSegura} de {totalPaginas}
            </span>
            <button
              onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaSegura === totalPaginas}
              style={{ ...s.btnCancel, padding: "0.45rem 0.85rem", opacity: paginaSegura === totalPaginas ? 0.45 : 1, cursor: paginaSegura === totalPaginas ? "default" : "pointer" }}
            >
              Siguiente ›
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — LEER QR / TICKET
      ════════════════════════════════════════════════════════════ */}
      {showQR && (
        <Overlay onClose={cerrarQR}>
          <div style={s.modalContainer}>
            <ModalHeader title="LEER" titleOrange="QR / TICKET" subtitle="Escanea el código del paciente o ingresa el ticket manual" onClose={cerrarQR} />
            <div style={s.modalBody}>

              {qrLoading && (
                <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                  <div style={s.spinner} />
                  <p style={{ color: "#6B7280", fontSize: "0.85rem", marginTop: "0.75rem" }}>Buscando orden...</p>
                </div>
              )}

              {/* ── QR INVÁLIDO / EXPIRADO ── */}
              {qrInvalido && !qrLoading && (
                <div style={s.qrInvalidBox}>
                  <div style={s.qrInvalidIcon}>⛔</div>
                  <p style={{ fontFamily: FONTC, fontSize: "1.1rem", fontWeight: 800, color: "#991B1B", margin: "0 0 0.5rem", textAlign: "center" }}>
                    CÓDIGO QR NO VÁLIDO
                  </p>
                  <p style={{ fontSize: "0.85rem", color: "#B91C1C", textAlign: "center", margin: "0 0 1rem", lineHeight: 1.6 }}>
                    Este código QR ya no es válido.
                  </p>
                  <div style={{ background: "#FFF", border: "1px solid #FCA5A5", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1.25rem", width: "100%", boxSizing: "border-box" }}>
                    <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 0.35rem" }}>
                      ¿Cómo continuar?
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "#374151", margin: 0, lineHeight: 1.55 }}>
                      Solicita al paciente su <strong>número de ticket</strong> (Ej: <span style={{ fontFamily: FONTC, color: ORANGE, fontWeight: 700 }}>LAB-XXXX</span>) e ingrésalo en la pestaña <strong>⌨️ Manual</strong>.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setQrInvalido(false); setQrError(""); setOrdenEscaneada(null);
                      setTicketManual(""); setModoQR("manual");
                    }}
                    style={{ ...s.btnFull, background: DARK, marginBottom: "0.5rem" }}
                  >
                    ⌨️ BUSCAR POR NÚMERO DE TICKET
                  </button>
                  <button onClick={cerrarQR} style={{ ...s.btnCancel, width: "100%" }}>
                    Cerrar
                  </button>
                </div>
              )}

              {/* ── ERROR NO EXPIRACIÓN ── */}
              {qrError && !qrInvalido && !qrLoading && (
                <div style={s.alertError}>
                  ⚠️ {qrError}
                </div>
              )}

              {/* ── RESULTADO ENCONTRADO ── */}
              {showQRAcciones && ordenEscaneada && !qrLoading && (
                <PanelAccionesQR
                  data={ordenEscaneada}
                  onEditar={(o) => { cerrarQR(); abrirEditar(o); }}
                  onVerDetalle={(o) => { cerrarQR(); abrirDetalle(o); }}
                  onNuevoScan={() => {
                    setOrdenEscaneada(null);
                    setShowQRAcciones(false);
                    setQrError(""); setQrInvalido(false);
                    setTicketManual("");
                    if (modoQR === "camara") iniciarCamara();
                  }}
                  onCerrar={cerrarQR}
                />
              )}

              {/* ── MODO ESCANEO ── */}
              {!showQRAcciones && !qrInvalido && !qrLoading && (
                <>
                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                    {["camara", "manual"].map(m => (
                      <button key={m} onClick={() => { setModoQR(m); setOrdenEscaneada(null); setQrError(""); setQrInvalido(false); }} style={{ flex: 1, padding: "0.55rem", borderRadius: "8px", border: "1.5px solid", fontFamily: FONTC, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", letterSpacing: "0.05em", borderColor: modoQR === m ? ORANGE : "#E5E7EB", background: modoQR === m ? ORANGE : "#F8FAFC", color: modoQR === m ? "#FFF" : "#6B7280" }}>
                        {m === "camara" ? "📷 CÁMARA" : "⌨️ MANUAL"}
                      </button>
                    ))}
                  </div>

                  {modoQR === "camara" ? (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ position: "relative", background: "#0F172A", borderRadius: "12px", overflow: "hidden", aspectRatio: "1", maxWidth: "280px", margin: "0 auto 1rem" }}>
                        <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                          <div style={{ width: "60%", height: "60%", border: `3px solid ${ORANGE}`, borderRadius: "10px", boxShadow: `0 0 0 2000px rgba(0,0,0,0.35)` }} />
                        </div>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: "1rem" }}>Apunta la cámara al código QR</p>
                      <button onClick={cerrarQR} style={s.btnCancel}>Cerrar Cámara</button>
                    </div>
                  ) : (
                    <div>
                      <label style={s.label}>Código de Ticket (Ej: LAB-XXXX)</label>
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                        <input
                          type="text" placeholder="LAB-XXXX"
                          value={ticketManual}
                          onChange={e => setTicketManual(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && buscarManual()}
                          style={{ ...s.input, flex: 1 }}
                        />
                        <button onClick={buscarManual} style={s.btnPrimary}>BUSCAR</button>
                      </div>
                      <button onClick={cerrarQR} style={{ ...s.btnCancel, width: "100%" }}>Cerrar</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </Overlay>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — TICKET GENERADO (QR RESULT)
      ════════════════════════════════════════════════════════════ */}
      {qrResult && (
        <Overlay onClose={() => setQrResult(null)}>
          <div style={s.modalContainer}>
            <ModalHeader title="TICKET" titleOrange="GENERADO" subtitle="Comparte el QR con el paciente" onClose={() => setQrResult(null)} />
            <div style={s.modalBody}>
              <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "rgba(232,139,58,0.1)", border: `1.5px solid ${ORANGE}`, borderRadius: "10px", padding: "0.6rem 1.2rem", marginBottom: "1rem" }}>
                  <span style={{ fontSize: "1.3rem" }}>🎫</span>
                  <span style={{ fontFamily: FONTC, fontSize: "1.6rem", fontWeight: 800, color: DARK }}>{qrResult.ticket}</span>
                </div>
                {qrResult.qr && (
                  <div style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: "14px", padding: "1rem", display: "inline-block", marginBottom: "1rem" }}>
                    <img src={qrResult.qr} alt="QR" style={{ width: "180px", height: "180px", display: "block" }} />
                  </div>
                )}
                <p style={{ fontSize: "0.82rem", color: "#6B7280", margin: "0 0 1.5rem", lineHeight: 1.55 }}>
                  {qrResult.msg || "El paciente puede presentar este QR para validar su orden"}
                </p>
              </div>
              <button onClick={() => { setQrResult(null); cargar(); }} style={s.btnFull}>CONTINUAR</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — CREAR ORDEN
      ════════════════════════════════════════════════════════════ */}
      {showCrear && (
        <Overlay onClose={() => { setShowCrear(false); resetFormRegistro(); }}>
          <div style={s.modalContainer}>
            <ModalHeader title="NUEVA" titleOrange="ORDEN" subtitle="Ingresa los datos para generar la solicitud" onClose={() => { setShowCrear(false); resetFormRegistro(); }} />
            <div style={s.modalBody}>
              {msgCrear && <Alert msg={msgCrear} />}
              <div style={{ marginBottom: "1rem" }}>
                <label style={s.label}>Documento del Paciente *</label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <select
                    value={tipoDocumentoInput}
                    onChange={e => { setTipoDocumentoInput(e.target.value); setCedulaInput(""); }}
                    style={{ ...s.input, width: "140px", flexShrink: 0 }}
                  >
                    <option value="cedula">Cédula</option>
                    <option value="pasaporte">Pasaporte</option>
                  </select>
                  <input
                    type="text"
                    placeholder={tipoDocumentoInput === "pasaporte" ? "Escribe el pasaporte..." : "Escribe el número de cédula..."}
                    value={cedulaInput}
                    onChange={e => setCedulaInput(limpiarDocumento(tipoDocumentoInput, e.target.value))}
                    maxLength={tipoDocumentoInput === "pasaporte" ? 15 : 10}
                    style={{ ...s.input, width: "100%" }}
                  />
                </div>

                {cedulaInput.trim() && (() => {
                  // Tres estados posibles para la cédula ingresada:
                  const estado = pacienteEncontrado ? "encontrado" : pacienteInactivo ? "inactivo" : "no_encontrado";
                  const colores = {
                    encontrado:    { bg: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", border: "#86EFAC", dot: "#16A34A" },
                    inactivo:      { bg: "linear-gradient(135deg, #FFFBEB, #FEF3C7)", border: "#FCD34D", dot: "#D97706" },
                    no_encontrado: { bg: "#FEF2F2",                                    border: "#FCA5A5", dot: "#DC2626" },
                  }[estado];
                  return (
                    <div style={{
                      background: colores.bg, padding: "0.75rem 1rem", borderRadius: "10px",
                      border: `1.5px solid ${colores.border}`,
                      display: "flex", alignItems: "center", gap: "0.65rem",
                    }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0, background: colores.dot, display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: "1rem" }}>
                        {estado === "encontrado" ? "✓" : estado === "inactivo" ? "!" : "✕"}
                      </div>
                      <div>
                        {estado === "encontrado" && (
                          <>
                            <p style={{ margin: 0, fontFamily: FONTC, fontSize: "0.65rem", fontWeight: 700, color: "#166534", letterSpacing: "0.08em", textTransform: "uppercase" }}>Paciente encontrado</p>
                            <p style={{ margin: 0, fontFamily: FONTC, fontSize: "1rem", fontWeight: 800, color: "#15803D" }}>{pacienteEncontrado.nombres} {pacienteEncontrado.apellidos}</p>
                          </>
                        )}
                        {estado === "inactivo" && (
                          <>
                            <p style={{ margin: 0, fontFamily: FONTC, fontSize: "0.65rem", fontWeight: 700, color: "#92400E", letterSpacing: "0.08em", textTransform: "uppercase" }}>Paciente inactivo</p>
                            <p style={{ margin: 0, fontFamily: FONTC, fontSize: "0.95rem", fontWeight: 800, color: "#B45309" }}>{pacienteInactivo.nombres} {pacienteInactivo.apellidos}</p>
                            <p style={{ margin: "0.1rem 0 0", fontSize: "0.78rem", color: "#92400E" }}>Está en la papelera. Reactívalo para poder generarle una orden.</p>
                          </>
                        )}
                        {estado === "no_encontrado" && (
                          <>
                            <p style={{ margin: 0, fontFamily: FONTC, fontSize: "0.65rem", fontWeight: 700, color: "#991B1B", letterSpacing: "0.08em", textTransform: "uppercase" }}>No encontrado</p>
                            <p style={{ margin: 0, fontSize: "0.82rem", color: "#B91C1C" }}>Este paciente no está registrado</p>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ── Reactivar: la cédula pertenece a un paciente en la papelera ── */}
                {cedulaInput.trim() && pacienteInactivo && (
                  <button
                    type="button"
                    onClick={handleReactivarDesdeOrden}
                    disabled={reactivando}
                    style={{ ...s.btnSecondary, width: "100%", textAlign: "center", marginTop: "0.6rem", opacity: reactivando ? 0.7 : 1 }}
                  >
                    {reactivando ? "Reactivando..." : "♻️ Reactivar este paciente"}
                  </button>
                )}

                {/* ── Registro rápido: solo aparece si la cédula no existe en absoluto ── */}
                {/* (o si ya generamos credenciales para ella: así no se oculta apenas
                    "cargar()" refresca la lista y el paciente recién creado aparece) */}
                {cedulaInput.trim() && (credencialesGeneradas || (!pacienteEncontrado && !pacienteInactivo)) && (
                  <div style={{ marginTop: "0.6rem" }}>
                    {credencialesGeneradas ? (
                      <div style={{ background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", border: "1.5px solid #86EFAC", borderRadius: "10px", padding: "0.9rem" }}>
                        <p style={{ margin: "0 0 0.5rem", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem", color: "#166534" }}>
                          ✓ Paciente registrado — entrégale estos datos de acceso
                        </p>
                        <div style={{ background: "#FFF", border: "1px solid #BBF7D0", borderRadius: "8px", padding: "0.6rem 0.75rem", marginBottom: "0.6rem" }}>
                          <p style={{ margin: "0 0 0.25rem", fontSize: "0.82rem", color: DARK }}><b>Usuario:</b> {credencialesGeneradas.username}</p>
                          <p style={{ margin: 0, fontSize: "0.82rem", color: DARK }}><b>Contraseña temporal:</b> {credencialesGeneradas.password}</p>
                        </div>
                        <p style={{ margin: "0 0 0.6rem", fontSize: "0.75rem", color: "#166534" }}>El paciente podrá cambiar esta contraseña luego desde su perfil.</p>
                        <button type="button" onClick={resetFormRegistro} style={{ ...s.btnFull, padding: "0.6rem", fontSize: "0.85rem" }}>
                          Continuar con la orden
                        </button>
                      </div>
                    ) : !showRegistroRapido ? (
                      <button
                        type="button"
                        onClick={() => setShowRegistroRapido(true)}
                        style={{ ...s.btnSecondary, width: "100%", textAlign: "center" }}
                      >
                        ➕ Registrar este paciente ahora
                      </button>
                    ) : (
                      <div style={{ background: "#F8FAFC", border: "1.5px solid #E5E7EB", borderRadius: "10px", padding: "0.9rem", marginTop: "0.4rem" }}>
                        <p style={{ margin: "0 0 0.75rem", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem", color: DARK }}>
                          📝 Registro rápido — {tipoDocumentoInput === "pasaporte" ? "Pasaporte" : "Cédula"} <span style={{ color: ORANGE }}>{cedulaInput.trim()}</span>
                        </p>
                        <p style={{ margin: "0 0 0.6rem", fontSize: "0.75rem", color: "#6B7280" }}>
                          El usuario y la contraseña se generan automáticamente; se los mostraremos al terminar.
                        </p>
                        {msgRegistro && <Alert msg={msgRegistro} />}
                        {tipoDocumentoInput === "cedula" && (
                          <button
                            type="button"
                            onClick={buscarDatosPorCedula}
                            disabled={buscandoDoc}
                            style={{
                              ...s.btnSecondary, width: "100%", textAlign: "center", marginBottom: "0.6rem",
                              opacity: buscandoDoc ? 0.6 : 1,
                            }}
                          >
                            {buscandoDoc ? "Buscando..." : "🔍 Autocompletar nombres con la cédula"}
                          </button>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0.5rem", marginBottom: "0.5rem" }}>
                          <input type="text" placeholder="Nombres *" value={formRegistro.nombres} onChange={e => setFormRegistro(f => ({ ...f, nombres: e.target.value }))} style={s.input} />
                          <input type="text" placeholder="Apellidos *" value={formRegistro.apellidos} onChange={e => setFormRegistro(f => ({ ...f, apellidos: e.target.value }))} style={s.input} />
                          <input type="email" placeholder="Correo *" value={formRegistro.correo} onChange={e => setFormRegistro(f => ({ ...f, correo: e.target.value }))} style={{ ...s.input, gridColumn: "1 / -1" }} />
                          <input type="date" placeholder="Fecha de nacimiento *" value={formRegistro.fecha_nacimiento} onChange={e => setFormRegistro(f => ({ ...f, fecha_nacimiento: e.target.value }))} style={{ ...s.input, gridColumn: "1 / -1" }} />
                        </div>

                        {!showMasDatosRegistro ? (
                          <button type="button" onClick={() => setShowMasDatosRegistro(true)} style={{ background: "none", border: "none", color: ORANGE, fontFamily: FONTC, fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", padding: "0.2rem 0", marginBottom: "0.5rem" }}>
                            + Más datos (opcional)
                          </button>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "0.5rem", marginBottom: "0.5rem" }}>
                            <input type="text" placeholder="Teléfono" value={formRegistro.telefono} onChange={e => setFormRegistro(f => ({ ...f, telefono: e.target.value }))} style={s.input} />
                            <select value={formRegistro.genero} onChange={e => setFormRegistro(f => ({ ...f, genero: e.target.value }))} style={s.select}>
                              <option value="">Género</option>
                              <option value="M">Masculino</option>
                              <option value="F">Femenino</option>
                            </select>
                            <input type="text" placeholder="Dirección" value={formRegistro.direccion} onChange={e => setFormRegistro(f => ({ ...f, direccion: e.target.value }))} style={{ ...s.input, gridColumn: "1 / -1" }} />
                          </div>
                        )}

                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={handleRegistroRapido}
                            disabled={guardandoRegistro}
                            style={{ ...s.btnFull, flex: 1, padding: "0.6rem", fontSize: "0.85rem", opacity: guardandoRegistro ? 0.7 : 1 }}
                          >
                            {guardandoRegistro ? "Registrando..." : "✓ Registrar paciente"}
                          </button>
                          <button type="button" onClick={resetFormRegistro} style={{ ...s.btnCancel, padding: "0.6rem 0.9rem" }}>Cancelar</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <SelectorExamenes examenesAgrupados={examenesAgrupados} seleccionados={form.examenes} onToggle={toggleExamen} busqueda={busquedaExamen} setBusqueda={setBusquedaExamen} label="Seleccionar Exámenes" />

              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
                <button onClick={handleCrearOrden} disabled={guardando} style={{ ...s.btnFull, flex: 1, opacity: guardando ? 0.7 : 1 }}>
                  {guardando ? "Generando..." : "📋 GENERAR ORDEN"}
                </button>
                <button onClick={() => setShowCrear(false)} style={s.btnCancel}>Cancelar</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — EDITAR ORDEN
      ════════════════════════════════════════════════════════════ */}
      {showEditar && (
        <Overlay onClose={() => setShowEditar(null)}>
          <div style={s.modalContainer}>
            <ModalHeader title="CORREGIR" titleOrange="EXÁMENES" subtitle={`Orden ${showEditar.numero_ticket || ''}`} onClose={() => setShowEditar(null)} />
            <div style={s.modalBody}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #E5E7EB", marginBottom: "1rem" }}>
                <div>
                  <p style={{ fontFamily: FONTC, fontSize: "0.65rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.15rem" }}>Paciente</p>
                  <p style={{ fontFamily: FONTC, fontWeight: 700, fontSize: "0.95rem", color: DARK, margin: 0 }}>
                    {showEditar.nombres ? `${showEditar.nombres} ${showEditar.apellidos}` : `#${showEditar.id_paciente}`}
                  </p>
                </div>
                <span style={s.ticketBadge}>{showEditar.numero_ticket || `#${showEditar.id_orden}`}</span>
              </div>
              {msgEdit && <Alert msg={msgEdit} />}
              <SelectorExamenes
                examenesAgrupados={examenesAgrupados}
                seleccionados={editExamenes}
                onToggle={toggleEditExamen}
                busqueda={busquedaEditExamen}
                setBusqueda={setBusquedaEditExamen}
                label="Exámenes en la orden"
              />
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button onClick={handleGuardarEdicion} disabled={guardandoEdit} style={{ ...s.btnFull, flex: 1, opacity: guardandoEdit ? 0.7 : 1 }}>
                  {guardandoEdit ? "Guardando..." : "💾 GUARDAR CAMBIOS"}
                </button>
                <button onClick={() => setShowEditar(null)} disabled={guardandoEdit} style={s.btnCancel}>Cancelar</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — DETALLE ORDEN
      ════════════════════════════════════════════════════════════ */}
      {showDetalle && (
        <Overlay onClose={() => setShowDetalle(null)}>
          <div style={s.modalContainer}>
            <ModalHeader title="DETALLE" titleOrange="ORDEN" subtitle={showDetalle.numero_ticket || `Orden #${showDetalle.id_orden}`} onClose={() => setShowDetalle(null)} />
            <div style={s.modalBody}>
              {loadingDetalle ? (
                <div style={{ textAlign: "center", padding: "2rem 0" }}>
                  <div style={s.spinner} />
                  <p style={{ color: "#6B7280", fontSize: "0.85rem", marginTop: "0.75rem" }}>Cargando exámenes...</p>
                </div>
              ) : (() => {
                const o = showDetalle;
                const detallesAgrupados = detalleExamenes.reduce((acc, d) => {
                  const cat = d.nombre_categoria || "General";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(d);
                  return acc;
                }, {});

                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                      <InfoItem label="Paciente" value={`${o.nombres || ""} ${o.apellidos || ""}`} />
                      <InfoItem label="Ticket"   value={o.numero_ticket} />
                      <InfoItem label="Estado"   value={o.estado} />
                      <InfoItem label="Fecha"    value={o.fecha_orden ? new Date(o.fecha_orden).toLocaleString() : "—"} />
                    </div>

                    <div style={{ background: "#F8FAFC", padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid #E5E7EB", marginBottom: "1rem" }}>
                      <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.75rem" }}>
                        Exámenes Solicitados
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "200px", overflowY: "auto", paddingRight: "0.5rem" }}>
                        {Object.keys(detallesAgrupados).length === 0 ? (
                          <p style={{ fontSize: "0.85rem", color: "#6B7280", margin: 0 }}>No hay exámenes registrados.</p>
                        ) : (
                          Object.keys(detallesAgrupados).map(cat => (
                            <div key={cat} style={{ background: "#FFF", border: "1px solid #F1F5F9", borderRadius: "6px", padding: "0.5rem" }}>
                              <p style={{ fontFamily: FONTC, fontSize: "0.75rem", fontWeight: 800, color: ORANGE, margin: "0 0 0.4rem", textTransform: "uppercase" }}>
                                {cat}
                              </p>
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", paddingLeft: "0.25rem" }}>
                                {detallesAgrupados[cat].map((d, index) => (
                                  <div key={index} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: DARK }}>
                                    <span>• {d.nombre_examen}</span>
                                    <span style={{ fontWeight: 700 }}>${parseFloat(d.subtotal || 0).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      <div style={{ borderTop: "1px dashed #E5E7EB", marginTop: "0.8rem", paddingTop: "0.6rem", display: "flex", justifyContent: "space-between", fontFamily: FONTC, fontWeight: 800, fontSize: "1.1rem" }}>
                        <span>TOTAL:</span>
                        <span style={{ color: ORANGE }}>${parseFloat(o.total || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    {o.observacion_validador && (
                      <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", padding: "0.65rem 0.85rem", borderRadius: "8px", marginBottom: "1rem" }}>
                        <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#92400E", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.3rem" }}>Observación</p>
                        <p style={{ fontFamily: FONT, fontSize: "0.85rem", color: "#374151", margin: 0 }}>{o.observacion_validador}</p>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
                      {PUEDE_EDITAR.includes(o.estado) && (
                        <button onClick={() => { setShowDetalle(null); abrirEditar(o); }} style={{ ...s.btnFull, flex: 1, background: "#3B82F6" }}>
                          ✏️ EDITAR ORDEN
                        </button>
                      )}
                      <button onClick={() => setShowDetalle(null)} style={s.btnCancel}>Cerrar</button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </Overlay>
      )}

      {/* ════════════════════════════════════════════════════════════
          MODAL — CONFIRMAR ELIMINACIÓN
      ════════════════════════════════════════════════════════════ */}
      {showConfirmEliminar && (
        <Overlay onClose={() => setShowConfirmEliminar(null)}>
          <div style={s.modalContainer}>
            <ModalHeader
              title="ELIMINAR"
              titleOrange="ORDEN"
              subtitle={`Ticket ${showConfirmEliminar.numero_ticket}`}
              onClose={() => setShowConfirmEliminar(null)}
            />
            <div style={s.modalBody}>
              <div style={{ background: "#450A0A", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.5rem", flexShrink: 0 }}>🗑️</span>
                <div>
                  <p style={{ fontFamily: FONTC, fontSize: "0.9rem", fontWeight: 800, color: "#FCA5A5", margin: "0 0 0.35rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Eliminación permanente
                  </p>
                  <p style={{ fontSize: "0.83rem", color: "#FEE2E2", margin: 0, lineHeight: 1.6 }}>
                    Esta acción <strong>no se puede deshacer</strong>. La orden y todos sus exámenes asociados serán borrados del sistema de forma definitiva.
                  </p>
                </div>
              </div>

              <div style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1.25rem" }}>
                <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
                  Resumen de la orden a eliminar
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <p style={{ fontSize: "0.88rem", color: "#374151", margin: 0 }}>
                    <strong>Ticket:</strong> <span style={{ fontFamily: FONTC, color: ORANGE, fontWeight: 700 }}>{showConfirmEliminar.numero_ticket}</span>
                  </p>
                  <p style={{ fontSize: "0.88rem", color: "#374151", margin: 0 }}>
                    <strong>Paciente:</strong> {showConfirmEliminar.nombres} {showConfirmEliminar.apellidos}
                  </p>
                  <p style={{ fontSize: "0.88rem", color: "#374151", margin: 0 }}>
                    <strong>Estado:</strong> {showConfirmEliminar.estado}
                  </p>
                  <p style={{ fontSize: "0.88rem", color: "#374151", margin: 0 }}>
                    <strong>Total:</strong> ${parseFloat(showConfirmEliminar.total || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  onClick={handleEliminar}
                  disabled={eliminando}
                  style={{ ...s.btnFull, flex: 1, background: "#7F1D1D", opacity: eliminando ? 0.6 : 1 }}
                >
                  {eliminando ? "Eliminando..." : "🗑️ SÍ, ELIMINAR DEFINITIVAMENTE"}
                </button>
                <button onClick={() => setShowConfirmEliminar(null)} style={s.btnCancel}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

    </div>
  );
}

// ─── PANEL ACCIONES POST-ESCANEO QR ──────────────────────────────────────────
function PanelAccionesQR({ data, onEditar, onVerDetalle, onNuevoScan, onCerrar }) {
  const o = data.orden || data;
  const detalles = data.examenes || data.detalles || [];
  const ec = EC[o.estado] || { bg: "#F8FAFC", color: "#6B7280", icon: "" };
  const puedeEditar = PUEDE_EDITAR.includes(o.estado);

  return (
    <div>
      <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#16A34A", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.3rem" }}>
          ✓ COMPROBACIÓN COMPLETADA
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontFamily: FONTC, fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
              {o.nombres} {o.apellidos}
            </p>
            <p style={{ fontFamily: FONT, fontSize: "0.78rem", color: "#6B7280", margin: "0.1rem 0 0" }}>
              Cédula: {o.cedula || "—"} · Ticket: {o.numero_ticket}
            </p>
          </div>
          <span style={{ background: ec.bg, color: ec.color, padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700, fontFamily: FONTC, textTransform: "uppercase" }}>
            {ec.icon} {o.estado}
          </span>
        </div>
      </div>

      <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "0.85rem", border: "1px solid #E5E7EB", marginBottom: "1rem" }}>
        <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
          Exámenes en la orden
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "150px", overflowY: "auto" }}>
          {detalles.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: DARK }}>
              <span>• {d.nombre_examen}</span>
              <span style={{ fontWeight: 600 }}>${parseFloat(d.subtotal || d.precio || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px dashed #E5E7EB", marginTop: "0.6rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontFamily: FONTC, fontSize: "1rem", fontWeight: 700 }}>
          <span>TOTAL:</span>
          <span style={{ color: ORANGE }}>${parseFloat(o.total || 0).toFixed(2)}</span>
        </div>
      </div>

      {o.estado === "Generada" && (
        <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <span style={{ fontSize: "1.2rem" }}>💳</span>
          <p style={{ fontFamily: FONT, fontSize: "0.82rem", color: "#1D4ED8", margin: 0 }}>
            Para procesar el cobro dirígete al <strong>Módulo de Caja</strong>.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button onClick={() => onVerDetalle(o)} style={{ ...btnAccion, background: "#F3F4F6", color: DARK, borderColor: "#E5E7EB" }}>
          👁️ Ver detalle completo
        </button>
        {puedeEditar && (
          <button onClick={() => onEditar(o)} style={{ ...btnAccion, background: "rgba(59,130,246,0.08)", color: "#2563EB", borderColor: "rgba(59,130,246,0.3)" }}>
            ✏️ Editar exámenes de la orden
          </button>
        )}
        {!puedeEditar && (
          <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem", border: "1px solid #E5E7EB", textAlign: "center" }}>
            <p style={{ fontFamily: FONT, fontSize: "0.82rem", color: "#6B7280", margin: 0 }}>
              Esta orden en estado <strong>{o.estado}</strong> no permite modificaciones.
            </p>
          </div>
        )}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
          <button onClick={onNuevoScan} style={{ ...btnAccion, flex: 1, textAlign: "center", background: "#F3F4F6", color: "#374151", borderColor: "#E5E7EB" }}>
            🔄 Buscar otro
          </button>
          <button onClick={onCerrar} style={{ ...btnAccion, flex: 1, textAlign: "center", background: "#FFF", color: "#6B7280", borderColor: "#E5E7EB" }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

const btnAccion = {
  padding: "0.7rem 1rem", borderRadius: "9px", border: "1.5px solid",
  fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem",
  letterSpacing: "0.04em", cursor: "pointer", transition: "opacity 0.15s",
};

// ─── SELECTOR DE EXÁMENES REUTILIZABLE ───────────────────────────────────────
function SelectorExamenes({ examenesAgrupados, seleccionados, onToggle, busqueda, setBusqueda, label = "Seleccionar Exámenes" }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input
        type="text"
        placeholder="🔍 Filtrar exámenes..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{ ...s.input, width: "100%", marginBottom: "0.75rem" }}
      />
      <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: "8px", padding: "0.5rem" }}>
        {Object.keys(examenesAgrupados).map(cat => {
          const listaFiltrada = examenesAgrupados[cat].filter(e =>
            e.nombre_examen.toLowerCase().includes(busqueda.toLowerCase())
          );
          if (listaFiltrada.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: "0.75rem" }}>
              <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: ORANGE, textTransform: "uppercase", margin: "0 0 0.3rem" }}>{cat}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                {listaFiltrada.map(e => {
                  const isChecked = seleccionados.includes(String(e.id_examen));
                  return (
                    <div
                      key={e.id_examen}
                      onClick={() => onToggle(e.id_examen)}
                      style={{
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        padding: "0.6rem 0.9rem", borderRadius: "8px", cursor: "pointer",
                        background: isChecked ? "rgba(232,139,58,0.15)" : "#F8FAFC",
                        border: `1.5px solid ${isChecked ? ORANGE : "#F1F5F9"}`,
                        transition: "all 0.15s"
                      }}
                    >
                      <div style={{
                        width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0,
                        background: isChecked ? ORANGE : "#E5E7EB",
                        display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: "0.75rem"
                      }}>
                        {isChecked ? "✓" : ""}
                      </div>
                      <p style={{ fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem", color: DARK, margin: 0 }}>{e.nombre_examen}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }} onClick={e => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

function ModalHeader({ title, titleOrange, subtitle, onClose }) {
  return (
    <div style={{ background: DARK, padding: "1rem 1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", borderTopLeftRadius: "14px", borderTopRightRadius: "14px" }}>
      <div>
        <h3 style={{ fontFamily: FONTC, fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#FFF" }}>
          {title} <span style={{ color: ORANGE }}>{titleOrange}</span>
        </h3>
        <p style={{ fontSize: "0.78rem", color: "#9CA3AF", margin: "0.15rem 0 0" }}>{subtitle}</p>
      </div>
      <button onClick={onClose} style={{ background: "rgba(255,255,255,0.1)", border: "none", width: "30px", height: "30px", borderRadius: "50%", fontSize: "1rem", color: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
    </div>
  );
}

function Alert({ msg }) {
  if (!msg) return null;
  const isErr = msg.type === "error";
  return (
    <div style={{ background: isErr ? "#FEF2F2" : "#F0FDF4", color: isErr ? "#EF4444" : "#16A34A", border: `1px solid ${isErr ? "#FCA5A5" : "#BBF7D0"}`, padding: "0.65rem 0.85rem", borderRadius: "8px", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
      {msg.text}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ background: "#F8FAFC", padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid #F1F5F9" }}>
      <p style={{ fontFamily: FONTC, fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.2rem" }}>{label}</p>
      <p style={{ fontFamily: FONT, fontSize: "0.875rem", fontWeight: 600, color: DARK, margin: 0 }}>{value || "—"}</p>
    </div>
  );
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const s = {
  btnPrimary:   { background: DARK, color: "#FFF", border: "none", padding: "0.65rem 1.35rem", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.05em", cursor: "pointer", textTransform: "uppercase" },
  btnSecondary: { background: `${ORANGE}15`, border: `1px solid ${ORANGE}55`, color: ORANGE, padding: "0.65rem 1.1rem", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.05em", cursor: "pointer" },
  btnCancel:    { background: "#FFF", border: "1.5px solid #E5E7EB", color: "#6B7280", padding: "0.6rem 1.2rem", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" },
  btnFull:      { background: ORANGE, color: "#FFF", border: "none", width: "100%", padding: "0.75rem", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.95rem", letterSpacing: "0.04em", cursor: "pointer" },
  btnIcon:      { border: "none", width: "28px", height: "28px", borderRadius: "6px", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.85rem" },
  searchWrap:   { display: "flex", alignItems: "center", background: "#FAFAFA", border: "1.5px solid #E5E7EB", borderRadius: "8px", padding: "0 0.75rem", flex: 1, minWidth: "240px", gap: "0.5rem" },
  searchInput:  { border: "none", background: "none", outline: "none", padding: "0.6rem 0", fontSize: "0.88rem", color: DARK, width: "100%", fontFamily: FONT },
  select:       { padding: "0.6rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontFamily: FONT, fontSize: "0.85rem", color: "#374151", background: "#FFF", outline: "none", cursor: "pointer" },
  input:        { padding: "0.65rem 0.9rem", border: "1.5px solid #E5E7EB", borderRadius: "8px", fontFamily: FONT, fontSize: "0.9rem", color: DARK, background: "#FAFAFA", outline: "none", boxSizing: "border-box" },
  label:        { fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.12em", color: "#6B7280", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" },
  tableWrap:    { background: "#FFF", borderRadius: "12px", border: "1px solid #E5E7EB", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" },
  tableHead:    { display: "flex", alignItems: "center", padding: "0.75rem 1.25rem", background: DARK, fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700, color: "#94A3B8", letterSpacing: "0.1em", textTransform: "uppercase" },
  tableRow:     { display: "flex", alignItems: "center", padding: "0.85rem 1.25rem", borderBottom: "1px solid #F1F5F9", transition: "background 0.15s" },
  empty:        { padding: "3rem", textAlign: "center", color: "#9CA3AF", fontSize: "0.9rem" },
  ticketBadge:  { background: `${ORANGE}15`, color: ORANGE, padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 700, fontFamily: FONTC },
  modalBody:    { background: "#FFF", padding: "1.25rem", borderBottomLeftRadius: "14px", borderBottomRightRadius: "14px", boxSizing: "border-box", overflowY: "auto" },
  modalContainer: { background: "#FFF", borderRadius: "14px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", width: "520px", maxWidth: "calc(100vw - 2rem)", maxHeight: "94vh", overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column" },
  alertError:   { background: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5", padding: "0.75rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" },
  qrInvalidBox: { background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: "12px", padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", alignItems: "center" },
  qrInvalidIcon: { fontSize: "2.5rem", marginBottom: "0.75rem" },
  spinner: { width: "32px", height: "32px", border: "3px solid #E5E7EB", borderTopColor: ORANGE, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" },
};