import { useState, useEffect, useRef } from "react";
import API from "../../services/api";
import jsQR from "jsqr";

// ─── MÉTODOS DE PAGO ──────────────────────────────────────────────────────────
// El sistema solo maneja estos dos métodos en todo el módulo (cobros, reembolsos,
// fondo de caja y arqueo). No se agregan tarjetas ni otros medios.
const METODOS = ["Efectivo", "Transferencia"];

// ─── DENOMINACIONES DE EFECTIVO (USD — Ecuador) ──────────────────────────────
// Se usan para el arqueo/conteo físico de caja al abrir y cerrar un turno.
// Esto es puramente un cálculo del lado del cliente: no agrega columnas ni
// tablas nuevas en la base de datos. El backend sigue recibiendo únicamente
// el monto total (monto_inicial / efectivo_contado), igual que antes.
const DENOMINACIONES = [
  { id: "b100", label: "$100", valor: 100,  grupo: "Billetes" },
  { id: "b50",  label: "$50",  valor: 50,   grupo: "Billetes" },
  { id: "b20",  label: "$20",  valor: 20,   grupo: "Billetes" },
  { id: "b10",  label: "$10",  valor: 10,   grupo: "Billetes" },
  { id: "b5",   label: "$5",   valor: 5,    grupo: "Billetes" },
  { id: "b1",   label: "$1",   valor: 1,    grupo: "Billetes" },
  { id: "m100", label: "$1.00", valor: 1.00, grupo: "Monedas" },
  { id: "m050", label: "$0.50", valor: 0.50, grupo: "Monedas" },
  { id: "m025", label: "$0.25", valor: 0.25, grupo: "Monedas" },
  { id: "m010", label: "$0.10", valor: 0.10, grupo: "Monedas" },
  { id: "m005", label: "$0.05", valor: 0.05, grupo: "Monedas" },
  { id: "m001", label: "$0.01", valor: 0.01, grupo: "Monedas" },
];




const totalDenominaciones = (cant) =>
  DENOMINACIONES.reduce((acc, d) => acc + (parseInt(cant?.[d.id], 10) || 0) * d.valor, 0);

const hayConteoDenominaciones = (cant) =>
  DENOMINACIONES.some(d => (parseInt(cant?.[d.id], 10) || 0) > 0);

// Genera un texto plano con el detalle del arqueo, para dejarlo registrado
// dentro del campo de observaciones (ya existente en la BD) sin tocar el esquema.
const resumenDenominacionesTexto = (cant) => {
  const partes = DENOMINACIONES
    .filter(d => (parseInt(cant?.[d.id], 10) || 0) > 0)
    .map(d => `${d.label} x${parseInt(cant[d.id], 10)} = $${((parseInt(cant[d.id], 10) || 0) * d.valor).toFixed(2)}`);
  if (partes.length === 0) return "";
  return `Arqueo físico de efectivo:\n${partes.join("\n")}\nTotal contado: $${totalDenominaciones(cant).toFixed(2)}`;
};

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

const isToday = (dateString) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const hoy = new Date();
  return d.getDate() === hoy.getDate() &&
         d.getMonth() === hoy.getMonth() &&
         d.getFullYear() === hoy.getFullYear();
};

// ─── ESTADO INICIAL DEL FORMULARIO DE COBRO ──────────────────────────────────
const estadoInicial = () => ({
  modoPago: "simple",          // "simple" | "mixto"
  partes: [
    { metodo_pago: "Efectivo", monto: "", referencia: "" }
  ],
});

export default function ModuloCaja() {
  const [ordenesGeneradas, setOrdenesGeneradas] = useState([]);
  const [pagosHistorial, setPagosHistorial]     = useState([]);
  const [loading, setLoading]                   = useState(false);
  
  const [buscar, setBuscar]                     = useState("");
  const [filtroTiempo, setFiltroTiempo]         = useState("hoy");
  const [fechaEspecifica, setFechaEspecifica]   = useState("");

  const [vistaTab, setVistaTab]                 = useState("cobrar");
  const [msg, setMsg]                           = useState(null);

  // Modal cobro
  const [showCobro, setShowCobro]   = useState(null);
  const [formCobro, setFormCobro]   = useState(estadoInicial());
  const [procesando, setProcesando] = useState(false);

  // Comprobante
  const [comprobante, setComprobante] = useState(null);

  // Comprobante desde historial
  const [comprobanteHistorial, setComprobanteHistorial] = useState(null);

  // Paginado historial
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const ITEMS_POR_PAGINA = 10;

  // Paginado del resto de listas (Cobrar, Reembolsos de hoy, Historial de cierres)
  const [paginaOrdenes, setPaginaOrdenes]           = useState(1);
  const [paginaReembolsables, setPaginaReembolsables] = useState(1);
  const [paginaCierres, setPaginaCierres]           = useState(1);

  // Resetear a la página 1 cada vez que cambian los filtros de búsqueda/tiempo/fecha
  useEffect(() => { setPaginaHistorial(1); }, [buscar, filtroTiempo, fechaEspecifica]);
  useEffect(() => { setPaginaOrdenes(1); }, [buscar, filtroTiempo, fechaEspecifica]);
  useEffect(() => { setPaginaCierres(1); }, [buscar, filtroTiempo, fechaEspecifica]);
  useEffect(() => { setPaginaReembolsables(1); }, [buscar]);

  // Modal detalle orden
  const [showDetalle, setShowDetalle] = useState(null);

  // ── CIERRE DE CAJA ────────────────────────────────────────────────────────
  const [turnoActivo, setTurnoActivo]         = useState(null);   // turno abierto de la secretaria (o null)
  const [cierresHistorial, setCierresHistorial] = useState([]);
  const [cargandoCaja, setCargandoCaja]       = useState(false);

  const [showAbrirTurno, setShowAbrirTurno]   = useState(false);
  const [montoInicial, setMontoInicial]       = useState("");
  const [procesandoAbrir, setProcesandoAbrir] = useState(false);
  const [msgAbrir, setMsgAbrir]               = useState(null);
  const [modoApertura, setModoApertura]       = useState("conteo"); // "conteo" | "directo"
  const [denomApertura, setDenomApertura]     = useState({});
  const [comprobanteApertura, setComprobanteApertura] = useState(null); // acta de apertura recién generada (solo de esta sesión)

  const [showCerrarTurno, setShowCerrarTurno] = useState(false);
  const [efectivoContado, setEfectivoContado] = useState("");
  const [observacionesCierre, setObservacionesCierre] = useState("");
  const [procesandoCierre, setProcesandoCierre] = useState(false);
  const [msgCierre, setMsgCierre]             = useState(null);
  const [modoCierre, setModoCierre]           = useState("conteo"); // "conteo" | "directo"
  const [denomCierre, setDenomCierre]         = useState({});
  const [confirmarCierre, setConfirmarCierre] = useState(false); // pantalla de revisión antes de confirmar

  const [comprobanteCierre, setComprobanteCierre] = useState(null); // detalle completo de un cierre ya cerrado

  // ── REEMBOLSOS ────────────────────────────────────────────────────────────
  const [reembolsosHistorial, setReembolsosHistorial] = useState([]);
  const [showReembolso, setShowReembolso]     = useState(null);   // pago seleccionado del historial

  // Filtros y paginado del historial de reembolsos procesados
  const [filtroTicket, setFiltroTicket]             = useState("");
  const [filtroFechaInicio, setFiltroFechaInicio]   = useState("");
  const [filtroFechaFin, setFiltroFechaFin]         = useState("");
  const [paginaActual, setPaginaActual]             = useState(1);
  const ITEMS_POR_PAGINA_REEMBOLSOS = 10;

  // Resetear a la página 1 cada vez que cambian los filtros del historial de reembolsos
  useEffect(() => { setPaginaActual(1); }, [filtroTicket, filtroFechaInicio, filtroFechaFin]);
  const [formReembolso, setFormReembolso]     = useState({ monto: "", metodo_reembolso: "Efectivo", referencia: "", motivo: "" });
  const [procesandoReembolso, setProcesandoReembolso] = useState(false);
  const [msgReembolso, setMsgReembolso]       = useState(null);

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

  

  // ── CARGA ─────────────────────────────────────────────────────────────────
  const cargar = async () => {
    setLoading(true);
    try {
      const [resOrdenes, resPagos] = await Promise.all([
        API.get("/pagos/ordenes-generadas").catch(() => ({ data: [] })),
        API.get("/pagos/todos").catch(() => ({ data: [] })),
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

  // ── CIERRE DE CAJA: CARGA ────────────────────────────────────────────────
  const cargarCaja = async () => {
    setCargandoCaja(true);
    try {
      const [resActual, resHistorial, resReembolsos] = await Promise.all([
        API.get("/caja/actual").catch(() => ({ data: null })),
        API.get("/caja/historial").catch(() => ({ data: [] })),
        API.get("/pagos/reembolsos").catch(() => ({ data: [] })),
      ]);
      setTurnoActivo(resActual.data || null);
      setCierresHistorial(Array.isArray(resHistorial.data) ? resHistorial.data : []);
      setReembolsosHistorial(Array.isArray(resReembolsos.data) ? resReembolsos.data : []);
    } catch (e) {
      console.error("Error al cargar datos de cierre de caja:", e);
    } finally {
      setCargandoCaja(false);
    }
  };

  useEffect(() => { cargarCaja(); }, []);

  // ── ABRIR TURNO ───────────────────────────────────────────────────────────
  const abrirModalTurno = () => {
    setMontoInicial("");
    setDenomApertura({});
    setModoApertura("conteo");
    setMsgAbrir(null);
    setShowAbrirTurno(true);
  };

  const handleAbrirTurno = async () => {
    const monto = modoApertura === "conteo" ? totalDenominaciones(denomApertura) : (parseFloat(montoInicial) || 0);
    if (modoApertura === "conteo" && !hayConteoDenominaciones(denomApertura)) {
      return setMsgAbrir({ type: "error", text: "Cuenta al menos un billete o moneda, o cambia a 'monto directo'." });
    }
    setProcesandoAbrir(true);
    setMsgAbrir(null);
    try {
      const { data } = await API.post("/caja/abrir", { monto_inicial: monto });
      setTurnoActivo({ ...data.turno, total_efectivo_sistema: 0, total_transferencia_sistema: 0, num_pagos: 0, total_reembolsos_efectivo: 0, total_reembolsos_transferencia: 0, num_reembolsos: 0, efectivo_esperado_actual: parseFloat(data.turno.monto_inicial) });
      setShowAbrirTurno(false);
      setMsg(null);
      cargarCaja();
    } catch (err) {
      setMsgAbrir({ type: "error", text: err.response?.data?.error || "Error al abrir el turno de caja." });
    } finally {
      setProcesandoAbrir(false);
    }
  };

  // ── CERRAR TURNO ──────────────────────────────────────────────────────────
  const abrirModalCierre = () => {
    setEfectivoContado("");
    setObservacionesCierre("");
    setDenomCierre({});
    setModoCierre("conteo");
    setConfirmarCierre(false);
    setMsgCierre(null);
    setShowCerrarTurno(true);
  };

  // Monto contado según el modo activo (conteo por denominación o monto directo)
  const totalContadoActual = modoCierre === "conteo"
    ? totalDenominaciones(denomCierre)
    : (parseFloat(efectivoContado) || 0);

  // Paso 1: valida y pasa a la pantalla de revisión (no cierra todavía)
  const irARevisarCierre = () => {
    if (modoCierre === "conteo" && !hayConteoDenominaciones(denomCierre)) {
      return setMsgCierre({ type: "error", text: "Cuenta al menos un billete o moneda, o cambia a 'monto directo'." });
    }
    if (modoCierre === "directo" && (!efectivoContado || parseFloat(efectivoContado) < 0)) {
      return setMsgCierre({ type: "error", text: "Ingresa el monto de efectivo contado físicamente en caja." });
    }
    setMsgCierre(null);
    setConfirmarCierre(true);
  };

  // Paso 2: cierre definitivo, ya confirmado por la secretaria
  const handleCerrarTurno = async () => {
    setProcesandoCierre(true);
    setMsgCierre(null);
    try {
      const detalleDenom = modoCierre === "conteo" ? resumenDenominacionesTexto(denomCierre) : "";
      const observacionesFinales = [observacionesCierre.trim(), detalleDenom].filter(Boolean).join("\n\n");
      const { data } = await API.post("/caja/cerrar", {
        id_cierre: turnoActivo.id_cierre,
        efectivo_contado: totalContadoActual,
        observaciones: observacionesFinales || undefined,
      });
      setShowCerrarTurno(false);
      setConfirmarCierre(false);
      setTurnoActivo(null);
      cargarCaja();
      // Abrir automáticamente el comprobante de cierre recién generado
      const detalle = await API.get(`/caja/cierre/${data.turno.id_cierre}`);
      setComprobanteCierre(detalle.data);
    } catch (err) {
      setMsgCierre({ type: "error", text: err.response?.data?.error || "Error al cerrar el turno de caja." });
      setConfirmarCierre(false);
    } finally {
      setProcesandoCierre(false);
    }
  };

  const verDetalleCierre = async (cierre) => {
    try {
      const { data } = await API.get(`/caja/cierre/${cierre.id_cierre}`);
      setComprobanteCierre(data);
    } catch (err) {
      setMsg({ type: "error", text: "No se pudo cargar el detalle de ese cierre." });
    }
  };

  // ── REEMBOLSOS ────────────────────────────────────────────────────────────
  // Cuánto se ha reembolsado ya para una orden dada (para no dejar reembolsar de más desde el front)
  const reembolsadoPorOrden = reembolsosHistorial.reduce((acc, r) => {
    acc[r.id_orden] = (acc[r.id_orden] || 0) + parseFloat(r.monto || 0);
    return acc;
  }, {});

  const abrirReembolso = (pago) => {
    // Política: solo se puede reembolsar el mismo día en que se pagó la orden.
    if (!isToday(pago.fecha_pago)) {
      setMsgReembolso(null);
      setMsg({ type: "error", text: "Solo se pueden reembolsar pagos realizados el mismo día de hoy." });
      return;
    }
    const yaReembolsado = reembolsadoPorOrden[pago.id_orden] || 0;
    const disponible = Math.max(0, parseFloat(pago.monto || 0) - yaReembolsado);
    setFormReembolso({ monto: disponible.toFixed(2), metodo_reembolso: "Efectivo", referencia: "", motivo: "" });
    setMsgReembolso(null);
    setShowReembolso(pago);
  };

  const handleProcesarReembolso = async () => {
    const { monto, metodo_reembolso, referencia, motivo } = formReembolso;

    // Doble validación defensiva: aunque la lista ya solo muestra pagos de hoy,
    // nos aseguramos de que el pago seleccionado siga siendo del día actual.
    if (!isToday(showReembolso?.fecha_pago)) {
      return setMsgReembolso({ type: "error", text: "Este pago ya no es de hoy: solo se permite reembolsar el mismo día del pago." });
    }
    if (!monto || parseFloat(monto) <= 0) {
      return setMsgReembolso({ type: "error", text: "El monto del reembolso debe ser mayor a 0." });
    }
    if (metodo_reembolso === "Transferencia" && !referencia.trim()) {
      return setMsgReembolso({ type: "error", text: "Ingresa el número de referencia de la transferencia." });
    }
    if (!motivo.trim()) {
      return setMsgReembolso({ type: "error", text: "Indica el motivo del reembolso." });
    }

    setProcesandoReembolso(true);
    setMsgReembolso(null);
    try {
      await API.post("/pagos/reembolsar", {
        id_orden: showReembolso.id_orden,
        monto: parseFloat(monto),
        metodo_reembolso,
        referencia: referencia.trim() || undefined,
        motivo: motivo.trim(),
      });
      setShowReembolso(null);
      cargar();
      cargarCaja();
    } catch (err) {
      setMsgReembolso({ type: "error", text: err.response?.data?.error || "Error al procesar el reembolso." });
    } finally {
      setProcesandoReembolso(false);
    }
  };

  // ── COBRO ─────────────────────────────────────────────────────────────────
  const abrirCobro = (orden) => {
    if (!turnoActivo) {
      setVistaTab("cierre");
      setMsg({ type: "error", text: "Debes abrir un turno de caja antes de registrar cobros." });
      return;
    }
    const total = parseFloat(orden.total || 0).toFixed(2);
    setFormCobro({
      modoPago: "simple",
      partes: [{ metodo_pago: "Efectivo", monto: total, referencia: "" }],
    });
    setShowCobro(orden);
    setMsg(null);
  };

  // Cambiar modo pago (simple ↔ mixto)
  const cambiarModo = (modo) => {
    const total = parseFloat(showCobro?.total || 0);
    if (modo === "simple") {
      setFormCobro(f => ({
        ...f,
        modoPago: "simple",
        partes: [{ metodo_pago: f.partes[0]?.metodo_pago || "Efectivo", monto: total.toFixed(2), referencia: "" }],
      }));
    } else {
      // Mixto: dividir 50/50 como punto de partida
      const mitad = (total / 2).toFixed(2);
      const resto = (total - parseFloat(mitad)).toFixed(2);
      setFormCobro(f => ({
        ...f,
        modoPago: "mixto",
        partes: [
          { metodo_pago: "Efectivo",       monto: mitad, referencia: "" },
          { metodo_pago: "Transferencia",  monto: resto, referencia: "" },
        ],
      }));
    }
    setMsg(null);
  };

  // Actualizar una parte del pago
  const actualizarParte = (idx, campo, valor) => {
    setFormCobro(f => {
      const nuevas = [...f.partes];
      nuevas[idx] = { ...nuevas[idx], [campo]: valor };

      // En modo mixto: ajustar la otra parte automáticamente al cambiar monto
      if (campo === "monto" && f.modoPago === "mixto" && nuevas.length === 2) {
        const total = parseFloat(showCobro?.total || 0);
        const esteVal = parseFloat(valor) || 0;
        const otro = Math.max(0, total - esteVal);
        const otroIdx = idx === 0 ? 1 : 0;
        nuevas[otroIdx] = { ...nuevas[otroIdx], monto: otro.toFixed(2) };
      }

      return { ...f, partes: nuevas };
    });
    setMsg(null);
  };

  const handleProcesarCobro = async () => {
    const total = parseFloat(showCobro?.total || 0);
    const { partes } = formCobro;

    // Validaciones frontend
    for (const p of partes) {
      if (!p.monto || parseFloat(p.monto) <= 0) {
        return setMsg({ type: "error", text: `El monto para "${p.metodo_pago}" debe ser mayor a 0.` });
      }
      if (p.metodo_pago === "Transferencia" && !p.referencia.trim()) {
        return setMsg({ type: "error", text: "Ingresa el número de referencia de la transferencia." });
      }
    }

    const suma = partes.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
    if (Math.abs(suma - total) > 0.01) {
      return setMsg({ type: "error", text: `La suma ($${suma.toFixed(2)}) no coincide con el total de la orden ($${total.toFixed(2)}).` });
    }

    setProcesando(true);
    setMsg(null);
    try {
      const payload = {
        id_orden: showCobro.id_orden,
        pagos: partes.map(p => ({
          monto: parseFloat(p.monto),
          metodo_pago: p.metodo_pago,
          referencia: p.referencia.trim() || undefined,
        })),
      };

      const { data } = await API.post("/pagos/procesar", payload);

      // Guardar datos del comprobante
      setComprobante({
        orden: showCobro,
        partes,
        total,
        fecha: new Date(),
        esMixto: partes.length > 1,
        pagosGuardados: data.pagos,
      });

      setShowCobro(null);
      cargar();
      cargarCaja(); // refresca el efectivo esperado / KPIs de Cierre de Caja sin recargar la página
    } catch (err) {
      setMsg({ type: "error", text: err.response?.data?.error || "Error al procesar el cobro." });
    } finally {
      setProcesando(false);
    }
  };

  // ── QR CÁMARA ─────────────────────────────────────────────────────────────
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

  const abrirLectorQR = () => {
    setShowQR(true); setOrdenEscaneada(null); setQrError(""); setQrInvalido(false);
    setTicketManual(""); setModoQR("camara"); setShowQRAcciones(false);
  };

  const cerrarQR = () => {
    setShowQR(false); setShowQRAcciones(false); setOrdenEscaneada(null);
    setQrInvalido(false); setQrError(""); detenerCamara();
  };

  // ── FILTROS Y KPIs ────────────────────────────────────────────────────────
  const aplicarFiltros = (item, campoFecha) => {
    const valorFecha = item[campoFecha];
    const fechaStr = valorFecha ? new Date(valorFecha).toLocaleDateString("es-EC") : "";
    const txt = `${item.nombres || ""} ${item.apellidos || ""} ${item.numero_ticket || ""} ${item.cedula || ""} ${fechaStr}`.toLowerCase();
    const matchTexto = txt.includes(buscar.toLowerCase());
    let matchTiempo = true;
    if (filtroTiempo === "hoy") {
      matchTiempo = isToday(valorFecha);
    } else if (filtroTiempo === "fecha" && fechaEspecifica) {
      if (!valorFecha) return false;
      const isoDate = new Date(valorFecha).toISOString().split('T')[0];
      matchTiempo = (isoDate === fechaEspecifica);
    }
    return matchTexto && matchTiempo;
  };

  const ordenesFiltradas = ordenesGeneradas.filter(o => aplicarFiltros(o, "fecha_orden"));
  const pagosFiltrados   = pagosHistorial.filter(p => aplicarFiltros(p, "fecha_pago"));
  const cierresFiltrados = cierresHistorial.filter(c => aplicarFiltros(c, "fecha_apertura"));

  // ── REEMBOLSOS: solo pagos de HOY con saldo pendiente por reembolsar ──────
  // (la política del negocio es fija: solo se reembolsa el mismo día del pago,
  // por eso aquí no se aplica el selector de "Solo Hoy / Todos / Fecha específica")
  const pagosReembolsables = pagosHistorial.filter(p => {
    if (!isToday(p.fecha_pago)) return false;
    const saldo = parseFloat(p.monto || 0) - (reembolsadoPorOrden[p.id_orden] || 0);
    if (saldo <= 0.01) return false;
    const fechaStr = p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString("es-EC") : "";
    const txt = `${p.nombres || ""} ${p.apellidos || ""} ${p.numero_ticket || ""} ${p.cedula || ""} ${fechaStr}`.toLowerCase();
    return txt.includes(buscar.toLowerCase());
  });

  // Paginado del historial
  const totalPaginas = Math.ceil(pagosFiltrados.length / ITEMS_POR_PAGINA);
  const pagosPaginados = pagosFiltrados.slice((paginaHistorial - 1) * ITEMS_POR_PAGINA, paginaHistorial * ITEMS_POR_PAGINA);

  // Paginado de órdenes por cobrar
  const totalPaginasOrdenes = Math.max(1, Math.ceil(ordenesFiltradas.length / ITEMS_POR_PAGINA));
  const ordenesPaginadas = ordenesFiltradas.slice((paginaOrdenes - 1) * ITEMS_POR_PAGINA, paginaOrdenes * ITEMS_POR_PAGINA);

  // Paginado de pagos reembolsables de hoy
  const totalPaginasReembolsables = Math.max(1, Math.ceil(pagosReembolsables.length / ITEMS_POR_PAGINA));
  const pagosReembolsablesPaginados = pagosReembolsables.slice((paginaReembolsables - 1) * ITEMS_POR_PAGINA, paginaReembolsables * ITEMS_POR_PAGINA);

  // Paginado del historial de cierres de caja
  const cierresCerrados = cierresFiltrados.filter(c => c.estado === "CERRADO");
  const totalPaginasCierres = Math.max(1, Math.ceil(cierresCerrados.length / ITEMS_POR_PAGINA));
  const cierresPaginados = cierresCerrados.slice((paginaCierres - 1) * ITEMS_POR_PAGINA, paginaCierres * ITEMS_POR_PAGINA);

  // ── HISTORIAL DE REEMBOLSOS: filtro por ticket / rango de fechas + paginado ──
  const reembolsosFiltrados = reembolsosHistorial.filter(r => {
    const matchTicket = !filtroTicket || (r.numero_ticket || "").toLowerCase().includes(filtroTicket.toLowerCase());

    let matchFecha = true;
    const fechaReembolso = r.fecha_reembolso ? new Date(r.fecha_reembolso) : null;
    if (filtroFechaInicio) {
      const inicio = new Date(filtroFechaInicio);
      inicio.setHours(0, 0, 0, 0);
      if (!fechaReembolso || fechaReembolso < inicio) matchFecha = false;
    }
    if (filtroFechaFin) {
      const fin = new Date(filtroFechaFin);
      fin.setHours(23, 59, 59, 999);
      if (!fechaReembolso || fechaReembolso > fin) matchFecha = false;
    }
    return matchTicket && matchFecha;
  });

  const totalPaginasReembolsos = Math.max(1, Math.ceil(reembolsosFiltrados.length / ITEMS_POR_PAGINA_REEMBOLSOS));
  const reembolsosPaginados = reembolsosFiltrados.slice(
    (paginaActual - 1) * ITEMS_POR_PAGINA_REEMBOLSOS,
    paginaActual * ITEMS_POR_PAGINA_REEMBOLSOS
  );

  const totalRecaudado     = pagosFiltrados.reduce((s, p) => s + parseFloat(p.monto || 0), 0);
  const totalTransacciones = pagosFiltrados.length;
  const porMetodo = pagosFiltrados.reduce((acc, p) => {
    // metodo_pago puede ser "Efectivo", "Transferencia (REF: XXX)", o "Efectivo + Transferencia..."
    // Para KPIs agrupamos por la primera palabra
    const clave = (p.metodo_pago || "").includes("Transferencia") && (p.metodo_pago || "").includes("Efectivo")
      ? "Mixto" : (p.metodo_pago || "").split(" ")[0];
    acc[clave] = (acc[clave] || 0) + parseFloat(p.monto || 0);
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
        <div style={{ display: "flex", gap: "0.65rem" }}>
          <button onClick={abrirLectorQR} style={S.btnQR}>📷 LEER QR / TICKET</button>
          <button onClick={cargar} disabled={loading} style={S.btnRefresh}>{loading ? "…" : "↻ Actualizar"}</button>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: "flex", background: "#F3F4F6", borderRadius: "10px", padding: "0.25rem", gap: "0.25rem", marginBottom: "1.5rem", width: "fit-content" }}>
        {[
          { key: "cobrar",     label: `💳 Cobrar (${ordenesFiltradas.length})` },
          { key: "reembolsos", label: `↩️ Reembolsos (${pagosReembolsables.length})` },
          { key: "reporte",    label: `📊 Reporte (${totalTransacciones})` },
          { key: "cierre",     label: `🗄️ Cierre de Caja${turnoActivo ? " •" : ""}` },
        ].map(t => (
          <button key={t.key} onClick={() => setVistaTab(t.key)} style={{
            ...S.tabBtn,
            background: vistaTab === t.key ? "#FFF" : "transparent",
            color:      vistaTab === t.key ? DARK : "#6B7280",
            fontWeight: vistaTab === t.key ? 700 : 500,
            boxShadow:  vistaTab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div style={{ ...S.searchWrap, flex: "1 1 300px", maxWidth: "400px" }}>
          <span style={{ color: "#9CA3AF" }}>🔍</span>
          <input
            placeholder="Buscar paciente, cédula, ticket o fecha..."
            value={buscar}
            onChange={e => setBuscar(e.target.value)}
            style={S.searchInput}
          />
        </div>
        {vistaTab !== "reembolsos" && (
          <select value={filtroTiempo} onChange={e => setFiltroTiempo(e.target.value)} style={{ ...S.input, flex: "0 1 180px" }}>
            <option value="hoy">Solo Hoy</option>
            <option value="todos">Todos los registros</option>
            <option value="fecha">Fecha específica</option>
          </select>
        )}
        {vistaTab !== "reembolsos" && filtroTiempo === "fecha" && (
          <input type="date" value={fechaEspecifica} onChange={e => setFechaEspecifica(e.target.value)} style={{ ...S.input, flex: "0 1 180px" }} />
        )}
      </div>

      {/* ══════════ VISTA: COBRAR ══════════ */}
      {vistaTab === "cobrar" && (
        <>
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
            ordenesPaginadas.map((o, i) => (
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
                  <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: 0 }}>{o.cedula || "—"}</p>
                </div>
                <div style={{ flex: 1, fontSize: "0.82rem", color: "#6B7280" }}>
                  {o.fecha_orden ? new Date(o.fecha_orden).toLocaleDateString("es-EC") : "—"}
                </div>
                <div style={{ flex: "0 0 100px", textAlign: "right" }}>
                  <span style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: DARK }}>${parseFloat(o.total || 0).toFixed(2)}</span>
                </div>
                <div style={{ flex: "0 0 110px", display: "flex", justifyContent: "center", gap: "0.4rem" }}>
                  <button onClick={() => setShowDetalle(o)} style={S.btnVer} title="Ver detalle">👁️</button>
                  <button onClick={() => abrirCobro(o)} style={S.btnCobrar}>💳 Cobrar</button>
                </div>
              </div>
            ))
          )}
        </div>
        <Paginador pagina={paginaOrdenes} totalPaginas={totalPaginasOrdenes} setPagina={setPaginaOrdenes} />
        </>
      )}

      
{/* ══════════ VISTA: REEMBOLSOS ══════════ */}
        {vistaTab === "reembolsos" && (
          <>
            {/* Mensaje Informativo de la Política */}
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1.25rem", display: "flex", gap: "0.6rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1rem" }}>ℹ️</span>
              <p style={{ fontFamily: FONT, fontSize: "0.82rem", color: "#7F1D1D", margin: 0 }}>
                Política de reembolsos: solo se pueden reembolsar pagos <strong>realizados hoy</strong>. Los pagos de días anteriores ya no aparecen en esta lista y no pueden reembolsarse.
              </p>
            </div>

            {msg && <Alert msg={msg} />}

            {/* SECCIÓN 1: PAGOS DEL DÍA DISPONIBLES PARA REEMBOLSAR */}
            <h3 style={{ fontFamily: FONTC, color: DARK, fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.75rem", textTransform: "uppercase" }}>
              💵 Pagos Recibidos Hoy (Disponibles para Reembolso)
            </h3>

            <div style={{ ...S.tableCard, marginBottom: "2.5rem" }}>
              <div style={S.tableHead}>
                <span style={{ flex: "0 0 130px" }}>TICKET</span>
                <span style={{ flex: 2 }}>PACIENTE</span>
                <span style={{ flex: 1 }}>MÉTODO</span>
                <span style={{ flex: 1 }}>HORA PAGO</span>
                <span style={{ flex: 1, textAlign: "right" }}>MONTO TOTAL</span>
                <span style={{ flex: "0 0 60px", textAlign: "center" }}>ACCIONES</span>
              </div>

              {pagosReembolsables.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280", fontFamily: FONT, fontSize: "0.85rem" }}>
                  No hay pagos registrados el día de hoy con saldos disponibles para reembolsar.
                </div>
              ) : (
                pagosReembolsablesPaginados.map((p, idx) => {
                  const yaReembolsado = reembolsadoPorOrden[p.id_orden] || 0;
                  const disponible = Math.max(0, parseFloat(p.monto || 0) - yaReembolsado);
                  return (
                    <div key={idx} style={S.tableRow}>
                      <span style={{ flex: "0 0 130px", fontFamily: FONTC, fontWeight: 700, color: ORANGE }}>{p.numero_ticket}</span>
                      <span style={{ flex: 2, fontFamily: FONT, fontSize: "0.85rem", fontWeight: 500, color: DARK }}>
                        {p.nombres} {p.apellidos}
                        <br />
                        <small style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>C.I. {p.cedula}</small>
                      </span>
                      <span style={{ flex: 1, fontFamily: FONT, fontSize: "0.8rem", color: "#4B5563" }}>{p.metodo_pago}</span>
                      <span style={{ flex: 1, fontFamily: FONT, fontSize: "0.8rem", color: "#4B5563" }}>
                        {p.fecha_pago ? new Date(p.fecha_pago).toLocaleTimeString("es-EC", { hour: '2-digit', minute: '2-digit' }) : "—"}
                      </span>
                      <span style={{ flex: 1, textAlign: "right", fontFamily: FONTC, fontWeight: 700, color: DARK, fontSize: "0.9rem" }}>
                        ${parseFloat(p.monto || 0).toFixed(2)}
                        {yaReembolsado > 0 && (
                          <div style={{ fontSize: "0.7rem", color: "#EF4444", fontWeight: 500 }}>
                            Reembolsado: ${yaReembolsado.toFixed(2)}
                          </div>
                        )}
                      </span>
                      <div style={{ flex: "0 0 60px", display: "flex", justifyContent: "center" }}>
                        <button
                          title="Reembolsar"
                          onClick={() => abrirReembolso(p)}
                          style={{ ...S.btnVer, background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.25)", color: "#EF4444" }}
                        >↩️</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <Paginador pagina={paginaReembolsables} totalPaginas={totalPaginasReembolsables} setPagina={setPaginaReembolsables} />

            {/* SECCIÓN 2: HISTORIAL DE REEMBOLSOS COMPLETADOS */}
            <h3 style={{ fontFamily: FONTC, color: DARK, fontSize: "1.1rem", fontWeight: 700, marginTop: "1.5rem", marginBottom: "0.75rem", textTransform: "uppercase" }}>
              📋 Historial General de Reembolsos Procesados
            </h3>

            {/* BARRA DE FILTROS (BÚSQUEDA) */}
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem", background: "#F9FAFB", padding: "1rem", borderRadius: "8px", border: "1px solid #E5E7EB" }}>
              <div style={{ flex: "1 1 200px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontFamily: FONT, fontSize: "0.75rem", fontWeight: 600, color: "#4B5563" }}>Buscar por Ticket:</label>
                <input
                  type="text"
                  placeholder="Ej: T-0001"
                  value={filtroTicket}
                  onChange={(e) => setFiltroTicket(e.target.value)}
                  style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #D1D5DB", fontFamily: FONT, fontSize: "0.85rem", color: DARK }}
                />
              </div>
              <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontFamily: FONT, fontSize: "0.75rem", fontWeight: 600, color: "#4B5563" }}>Desde Fecha:</label>
                <input
                  type="date"
                  value={filtroFechaInicio}
                  onChange={(e) => setFiltroFechaInicio(e.target.value)}
                  style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #D1D5DB", fontFamily: FONT, fontSize: "0.85rem", color: DARK }}
                />
              </div>
              <div style={{ flex: "1 1 150px", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <label style={{ fontFamily: FONT, fontSize: "0.75rem", fontWeight: 600, color: "#4B5563" }}>Hasta Fecha:</label>
                <input
                  type="date"
                  value={filtroFechaFin}
                  onChange={(e) => setFiltroFechaFin(e.target.value)}
                  style={{ padding: "0.4rem 0.6rem", borderRadius: "6px", border: "1px solid #D1D5DB", fontFamily: FONT, fontSize: "0.85rem", color: DARK }}
                />
              </div>
              {(filtroTicket || filtroFechaInicio || filtroFechaFin) && (
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                  <button
                    onClick={() => { setFiltroTicket(""); setFiltroFechaInicio(""); setFiltroFechaFin(""); }}
                    style={{ padding: "0.4rem 0.8rem", background: "#E5E7EB", border: "none", borderRadius: "6px", fontFamily: FONT, fontSize: "0.8rem", cursor: "pointer", color: "#374151" }}
                  >
                    Limpiar Filtros
                  </button>
                </div>
              )}
            </div>

            {/* TABLA DEL HISTORIAL */}
            <div style={S.tableCard}>
              <div style={S.tableHead}>
                <span style={{ flex: "0 0 120px" }}>TICKET</span>
                <span style={{ flex: 2 }}>PACIENTE</span>
                <span style={{ flex: 1.5 }}>MOTIVO / OBSERVACIÓN</span>
                <span style={{ flex: 1 }}>MÉTODO REEMB.</span>
                <span style={{ flex: 1.2 }}>FECHA / HORA</span>
                <span style={{ flex: 1, textAlign: "right" }}>MONTO DEVUELTO</span>
              </div>

              {reembolsosPaginados.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#6B7280", fontFamily: FONT, fontSize: "0.85rem" }}>
                  No se encontraron reembolsos que coincidan con los criterios de búsqueda.
                </div>
              ) : (
                reembolsosPaginados.map((r, idx) => (
                  <div key={idx} style={S.tableRow}>
                    <span style={{ flex: "0 0 120px", fontFamily: FONTC, fontWeight: 700, color: "#374151" }}>{r.numero_ticket}</span>
                    <span style={{ flex: 2, fontFamily: FONT, fontSize: "0.85rem", fontWeight: 500, color: DARK }}>
                      {r.nombres} {r.apellidos}
                      <br />
                      <small style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>C.I. {r.cedula}</small>
                    </span>
                    <span style={{ flex: 1.5, fontFamily: FONT, fontSize: "0.8rem", color: "#4B5563", fontStyle: "italic" }}>
                      {r.motivo || "Sin motivo especificado"}
                      {r.secretaria && <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontStyle: "normal", marginTop: "2px" }}>Por: @{r.secretaria}</div>}
                    </span>
                    <span style={{ flex: 1, fontFamily: FONT, fontSize: "0.8rem", color: "#4B5563" }}>{r.metodo_reembolso}</span>
                    <span style={{ flex: 1.2, fontFamily: FONT, fontSize: "0.8rem", color: "#4B5563" }}>
                      {r.fecha_reembolso ? new Date(r.fecha_reembolso).toLocaleDateString("es-EC") : "—"}
                      <br />
                      <small style={{ color: "#9CA3AF" }}>
                        {r.fecha_reembolso ? new Date(r.fecha_reembolso).toLocaleTimeString("es-EC", { hour: '2-digit', minute: '2-digit' }) : ""}
                      </small>
                    </span>
                    <span style={{ flex: 1, textAlign: "right", fontFamily: FONTC, fontWeight: 700, color: "#EF4444", fontSize: "0.9rem" }}>
                      -${parseFloat(r.monto || 0).toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* CONTROLES DE PAGINACIÓN */}
            {totalPaginasReembolsos > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  disabled={paginaActual === 1}
                  onClick={() => setPaginaActual(prev => prev - 1)}
                  style={{ padding: "0.3rem 0.6rem", background: paginaActual === 1 ? "#F3F4F6" : "#FFF", border: "1px solid #D1D5DB", borderRadius: "6px", cursor: paginaActual === 1 ? "not-allowed" : "pointer", color: paginaActual === 1 ? "#9CA3AF" : DARK, fontFamily: FONT, fontSize: "0.8rem" }}
                >
                  ◀ Anterior
                </button>
                <span style={{ fontFamily: FONT, fontSize: "0.85rem", color: "#4B5563" }}>
                  Página <strong>{paginaActual}</strong> de {totalPaginasReembolsos}
                </span>
                <button
                  type="button"
                  disabled={paginaActual === totalPaginasReembolsos}
                  onClick={() => setPaginaActual(prev => prev + 1)}
                  style={{ padding: "0.3rem 0.6rem", background: paginaActual === totalPaginasReembolsos ? "#F3F4F6" : "#FFF", border: "1px solid #D1D5DB", borderRadius: "6px", cursor: paginaActual === totalPaginasReembolsos ? "not-allowed" : "pointer", color: paginaActual === totalPaginasReembolsos ? "#9CA3AF" : DARK, fontFamily: FONT, fontSize: "0.8rem" }}
                >
                  Siguiente ▶
                </button>
              </div>
            )}
          </>
        )}


      {/* ══════════ VISTA: REPORTE ══════════ */}
      {vistaTab === "reporte" && (
        <>
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
              <span style={{ flex: "0 0 90px" }}></span>
            </div>
            {loading ? (
              <div style={S.empty}>Cargando...</div>
            ) : pagosFiltrados.length === 0 ? (
              <div style={S.empty}>No hay pagos registrados para los filtros actuales.</div>
            ) : (
              pagosPaginados.map((p, i) => (
                <div key={p.id_pago || i} style={{ ...S.tableRow, background: i % 2 === 0 ? "#FFF" : "#F9FAFB" }}>
                  <div style={{ flex: "0 0 130px" }}>
                    <span style={S.ticketBadge}>{p.numero_ticket || `#${p.id_orden}`}</span>
                  </div>
                  <div style={{ flex: 2 }}>
                    <p style={{ fontWeight: 600, fontSize: "0.875rem", color: DARK, margin: 0 }}>
                      {p.nombres ? `${p.nombres} ${p.apellidos}` : `Orden #${p.id_orden}`}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "#9CA3AF", margin: 0 }}>Cobrado por: {p.cobrado_por || p.secretaria_username || p.secretaria || "—"}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{
                      ...S.metodoBadge,
                      background: (p.metodo_pago || "").includes("+") || (p.metodo_pago || "").includes("Transferencia") && (p.metodo_pago || "").includes("Efectivo")
                        ? "rgba(139,92,246,0.1)" : "rgba(59,130,246,0.1)",
                      color: (p.metodo_pago || "").includes("+") ? "#7C3AED" : "#2563EB",
                    }}>
                      {p.metodo_pago || "—"}
                    </span>
                  </div>
                  <div style={{ flex: 1, fontSize: "0.82rem", color: "#6B7280" }}>
                    {p.fecha_pago ? new Date(p.fecha_pago).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </div>
                  <div style={{ flex: "0 0 110px", textAlign: "right" }}>
                    <span style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: "#10B981" }}>${parseFloat(p.monto || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ flex: "0 0 90px", display: "flex", justifyContent: "center", gap: "0.35rem" }}>
                    <button
                      title="Ver / imprimir comprobante"
                      onClick={() => setComprobanteHistorial(p)}
                      style={S.btnVer}
                    >🖨️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Paginador */}
          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
              <button
                onClick={() => setPaginaHistorial(p => Math.max(1, p - 1))}
                disabled={paginaHistorial === 1}
                style={{ ...S.btnCancel, padding: "0.4rem 0.85rem", opacity: paginaHistorial === 1 ? 0.4 : 1 }}
              >‹ Anterior</button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => setPaginaHistorial(n)}
                  style={{
                    padding: "0.4rem 0.75rem",
                    borderRadius: "7px",
                    border: `1.5px solid ${n === paginaHistorial ? ORANGE : "#E5E7EB"}`,
                    background: n === paginaHistorial ? ORANGE : "#FFF",
                    color: n === paginaHistorial ? "#FFF" : "#374151",
                    fontFamily: FONTC, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                  }}
                >{n}</button>
              ))}
              <button
                onClick={() => setPaginaHistorial(p => Math.min(totalPaginas, p + 1))}
                disabled={paginaHistorial === totalPaginas}
                style={{ ...S.btnCancel, padding: "0.4rem 0.85rem", opacity: paginaHistorial === totalPaginas ? 0.4 : 1 }}
              >Siguiente ›</button>
              <span style={{ fontFamily: FONTC, fontSize: "0.75rem", color: "#9CA3AF" }}>
                {(paginaHistorial - 1) * ITEMS_POR_PAGINA + 1}–{Math.min(paginaHistorial * ITEMS_POR_PAGINA, pagosFiltrados.length)} de {pagosFiltrados.length}
              </span>
            </div>
          )}
        </>
      )}

      {/* ══════════ VISTA: CIERRE DE CAJA ══════════ */}
      {vistaTab === "cierre" && (
        <>
          {msg && <Alert msg={msg} />}
          {cargandoCaja && !turnoActivo && cierresHistorial.length === 0 ? (
            <div style={S.empty}>Cargando...</div>
          ) : !turnoActivo ? (
            <div style={{ ...S.tableCard, padding: "2.5rem 1.5rem", textAlign: "center" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🗄️</div>
              <p style={{ fontFamily: FONTC, fontSize: "1.15rem", fontWeight: 800, color: DARK, margin: "0 0 0.4rem", textTransform: "uppercase" }}>
                No tienes un turno de caja abierto
              </p>
              <p style={{ fontSize: "0.85rem", color: "#6B7280", margin: "0 0 1.25rem" }}>
                Debes abrir un turno antes de poder registrar cobros. Indica el fondo inicial de efectivo con el que arrancas.
              </p>
              <button onClick={abrirModalTurno} style={{ ...S.btnFull2, padding: "0.75rem 1.5rem" }}>🔓 ABRIR TURNO DE CAJA</button>
            </div>
          ) : (
            <>
              <CascadaCaja turno={turnoActivo} />
              {(parseFloat(turnoActivo.total_reembolsos_efectivo || 0) > 0 || parseFloat(turnoActivo.total_reembolsos_transferencia || 0) > 0) && (
                <p style={{ fontSize: "0.78rem", color: "#6B7280", margin: "-0.5rem 0 1rem", fontFamily: FONT }}>
                  ↩️ Este turno tiene {turnoActivo.num_reembolsos || 0} reembolso(s) registrado(s). El dinero reembolsado ya se restó de lo cobrado; por eso no aparece en el efectivo/transferencia esperados arriba.
                </p>
              )}

              <div style={{ ...S.tableCard, padding: "1.25rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.25rem" }}>Turno abierto</p>
                  <p style={{ fontFamily: FONT, fontSize: "0.85rem", color: DARK, margin: 0 }}>
                    #{turnoActivo.id_cierre} · Desde {new Date(turnoActivo.fecha_apertura).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {turnoActivo.num_pagos || 0} cobro(s)
                  </p>
                </div>
                <button onClick={abrirModalCierre} style={{ ...S.btnFull2, background: "#EF4444" }}>🔒 CERRAR TURNO</button>
              </div>
            </>
          )}

          {/* Historial de cierres */}
          <p style={{ fontFamily: FONTC, fontSize: "0.85rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 0.6rem" }}>
            Historial de cierres
          </p>
          <div style={S.tableCard}>
            <div style={S.tableHead}>
              <span style={{ flex: "0 0 70px" }}>#</span>
              <span style={{ flex: 1.5 }}>SECRETARIA</span>
              <span style={{ flex: 1 }}>APERTURA</span>
              <span style={{ flex: 1 }}>CIERRE</span>
              <span style={{ flex: "0 0 110px", textAlign: "right" }}>DIFERENCIA</span>
              <span style={{ flex: "0 0 50px" }}></span>
            </div>
            {cierresCerrados.length === 0 ? (
              <div style={S.empty}>
                {buscar || filtroTiempo !== "todos" ? "Sin resultados para los filtros aplicados." : "Aún no se ha cerrado ningún turno de caja."}
              </div>
            ) : (
              cierresPaginados.map((c, i) => {
                const dif = parseFloat(c.diferencia || 0);
                return (
                  <div key={c.id_cierre} style={{ ...S.tableRow, background: i % 2 === 0 ? "#FFF" : "#F9FAFB" }}>
                    <div style={{ flex: "0 0 70px" }}><span style={S.ticketBadge}>#{c.id_cierre}</span></div>
                    <div style={{ flex: 1.5, fontSize: "0.85rem", color: DARK }}>{c.nombres} {c.apellidos}</div>
                    <div style={{ flex: 1, fontSize: "0.8rem", color: "#6B7280" }}>{new Date(c.fecha_apertura).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                    <div style={{ flex: 1, fontSize: "0.8rem", color: "#6B7280" }}>{c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                    <div style={{ flex: "0 0 110px", textAlign: "right" }}>
                      <span style={{ fontFamily: FONTC, fontWeight: 700, fontSize: "0.9rem", color: Math.abs(dif) < 0.01 ? "#10B981" : (dif > 0 ? "#3B82F6" : "#EF4444") }}>
                        {dif > 0 ? "+" : ""}{dif.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ flex: "0 0 50px", display: "flex", justifyContent: "center" }}>
                      <button title="Ver detalle / comprobante" onClick={() => verDetalleCierre(c)} style={S.btnVer}>🖨️</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <Paginador pagina={paginaCierres} totalPaginas={totalPaginasCierres} setPagina={setPaginaCierres} />
        </>
      )}

      {/* ══════════ MODAL DETALLE ══════════ */}
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
                    <DetalleItem label="Estado"   value={<span style={{ background: ec.bg, color: ec.color, fontFamily: FONTC, fontWeight: 700, fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "6px" }}>{o.estado}</span>} />
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

      {/* ══════════ MODAL COBRO (con pagos mixtos) ══════════ */}
      {showCobro && (
        <Overlay onClose={() => !procesando && setShowCobro(null)}>
          <ModalHeader
            title="REGISTRAR"
            titleOrange="COBRO"
            subtitle={`Orden: ${showCobro.numero_ticket || `#${showCobro.id_orden}`}`}
            onClose={() => !procesando && setShowCobro(null)}
          />
          <div style={S.modalBody}>

            {/* Info del paciente + total */}
            <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem", border: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontFamily: FONTC, fontSize: "0.68rem", color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Paciente</p>
                  <p style={{ fontFamily: FONTC, fontSize: "1rem", fontWeight: 700, color: DARK, margin: 0 }}>
                    {showCobro.nombres ? `${showCobro.nombres} ${showCobro.apellidos}` : `#${showCobro.id_paciente}`}
                  </p>
                  <p style={{ fontFamily: FONT, fontSize: "0.78rem", color: "#6B7280", margin: "0.15rem 0 0" }}>CI: {showCobro.cedula || "—"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontFamily: FONTC, fontSize: "0.68rem", color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.2rem" }}>Total a Cobrar</p>
                  <p style={{ fontFamily: FONTC, fontSize: "1.5rem", fontWeight: 800, color: "#10B981", margin: 0 }}>
                    ${parseFloat(showCobro.total || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {msg && <Alert msg={msg} />}

            {/* Selector modo pago */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={S.label}>Modo de Pago</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                {[
                  { key: "simple", label: "💳 Un solo método" },
                  { key: "mixto",  label: "🔀 Pago mixto" },
                ].map(({ key, label }) => {
                  const activo = formCobro.modoPago === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => cambiarModo(key)}
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
                        transition: "all 0.15s",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {formCobro.modoPago === "mixto" && (
                <p style={{ fontSize: "0.75rem", color: "#6B7280", margin: "0.5rem 0 0", fontFamily: FONT }}>
                  Divide el cobro entre Efectivo y Transferencia. La suma debe ser igual al total.
                </p>
              )}
            </div>

            {/* Partes del pago */}
            {formCobro.partes.map((parte, idx) => (
              <PagoParteSub
                key={idx}
                parte={parte}
                idx={idx}
                esMixto={formCobro.modoPago === "mixto"}
                totalOrden={parseFloat(showCobro.total || 0)}
                onChange={actualizarParte}
              />
            ))}

            {/* Resumen si es mixto */}
            {formCobro.modoPago === "mixto" && (
              <ResumenMixto partes={formCobro.partes} total={parseFloat(showCobro.total || 0)} />
            )}

            {/* Botones */}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button
                onClick={handleProcesarCobro}
                disabled={procesando}
                style={{ ...S.btnFull, flex: 1, opacity: procesando ? 0.7 : 1 }}
              >
                {procesando ? "Procesando..." : "✅ CONFIRMAR COBRO"}
              </button>
              <button onClick={() => setShowCobro(null)} disabled={procesando} style={S.btnCancel}>Cancelar</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ══════════ MODAL COMPROBANTE ══════════ */}
      {comprobante && (
        <Overlay onClose={() => setComprobante(null)}>
          <ModalHeader title="COMPROBANTE" titleOrange="DE PAGO" subtitle={comprobante.orden.numero_ticket} onClose={() => setComprobante(null)} />
          <div style={S.modalBody}>
            <ComprobanteView comprobante={comprobante} onCerrar={() => setComprobante(null)} />
          </div>
        </Overlay>
      )}

      {/* ══════════ MODAL COMPROBANTE HISTORIAL ══════════ */}
      {comprobanteHistorial && (
        <Overlay onClose={() => setComprobanteHistorial(null)}>
          <ModalHeader
            title="COMPROBANTE"
            titleOrange="DE PAGO"
            subtitle={comprobanteHistorial.numero_ticket || `Orden #${comprobanteHistorial.id_orden}`}
            onClose={() => setComprobanteHistorial(null)}
          />
          <div style={S.modalBody}>
            <ComprobanteView
              comprobante={{
                orden: comprobanteHistorial,
                partes: (() => {
                  const m = comprobanteHistorial.metodo_pago || "";
                  const monto = parseFloat(comprobanteHistorial.monto || 0);
                  if (m.includes("+")) {
                    // Pago mixto guardado como cadena; mostrar como una sola línea
                    return [{ metodo_pago: m, monto, referencia: comprobanteHistorial.referencia || "" }];
                  }
                  const ref = m.includes("REF:") ? m.split("REF:")[1]?.replace(")", "").trim() : (comprobanteHistorial.referencia || "");
                  const metodoLimpio = m.includes("Transferencia") ? "Transferencia" : m.split(" ")[0] || m;
                  return [{ metodo_pago: metodoLimpio, monto, referencia: ref }];
                })(),
                total: parseFloat(comprobanteHistorial.monto || 0),
                fecha: comprobanteHistorial.fecha_pago ? new Date(comprobanteHistorial.fecha_pago) : new Date(),
                esMixto: (comprobanteHistorial.metodo_pago || "").includes("+"),
              }}
              onCerrar={() => setComprobanteHistorial(null)}
            />
          </div>
        </Overlay>
      )}

      {/* ══════════ MODAL ABRIR TURNO ══════════ */}
      {showAbrirTurno && (
        <Overlay onClose={() => !procesandoAbrir && setShowAbrirTurno(false)}>
          <ModalHeader title="ABRIR" titleOrange="TURNO DE CAJA" subtitle="Registra el fondo inicial de efectivo" onClose={() => !procesandoAbrir && setShowAbrirTurno(false)} />
          <div style={S.modalBody}>
            {msgAbrir && <Alert msg={msgAbrir} />}

            <ModoConteoToggle modo={modoApertura} setModo={setModoApertura} />

            {modoApertura === "conteo" ? (
              <ConteoDenominaciones cantidades={denomApertura} onChange={setDenomApertura} />
            ) : (
              <>
                <label style={S.label}>Fondo inicial de efectivo</label>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={montoInicial}
                  onChange={e => setMontoInicial(e.target.value)}
                  style={{ ...S.input, width: "100%", marginBottom: "1.25rem" }}
                />
              </>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={handleAbrirTurno} disabled={procesandoAbrir} style={{ ...S.btnFull, flex: 1, opacity: procesandoAbrir ? 0.7 : 1 }}>
                {procesandoAbrir ? "Abriendo..." : "🔓 ABRIR TURNO"}
              </button>
              <button onClick={() => setShowAbrirTurno(false)} disabled={procesandoAbrir} style={S.btnCancel}>Cancelar</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ══════════ MODAL CERRAR TURNO ══════════ */}
      {showCerrarTurno && turnoActivo && (
        <Overlay onClose={() => !procesandoCierre && setShowCerrarTurno(false)}>
          <ModalHeader title="CERRAR" titleOrange="TURNO DE CAJA" subtitle={`Turno #${turnoActivo.id_cierre}`} onClose={() => !procesandoCierre && setShowCerrarTurno(false)} />
          <div style={S.modalBody}>
            {msgCierre && <Alert msg={msgCierre} />}

            <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem", border: "1px solid #F1F5F9" }}>
              <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>💵 Efectivo (esto es lo que se cuenta físicamente)</p>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                <span style={{ color: "#6B7280" }}>Fondo inicial</span>
                <span style={{ fontWeight: 600 }}>${parseFloat(turnoActivo.monto_inicial || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                <span style={{ color: "#6B7280" }}>+ Efectivo cobrado</span>
                <span style={{ fontWeight: 600, color: "#10B981" }}>${parseFloat(turnoActivo.total_efectivo_sistema || 0).toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                <span style={{ color: "#6B7280" }}>− Reembolsos en efectivo</span>
                <span style={{ fontWeight: 600, color: "#EF4444" }}>${parseFloat(turnoActivo.total_reembolsos_efectivo || 0).toFixed(2)}</span>
              </div>
              <div style={{ borderTop: "1px dashed #E5E7EB", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontFamily: FONTC, fontWeight: 700 }}>
                <span>EFECTIVO ESPERADO EN CAJA</span>
                <span style={{ color: ORANGE }}>${parseFloat(turnoActivo.efectivo_esperado_actual || 0).toFixed(2)}</span>
              </div>

              {(parseFloat(turnoActivo.total_transferencia_sistema || 0) > 0 || parseFloat(turnoActivo.total_reembolsos_transferencia || 0) > 0) && (
                <>
                  <div style={{ borderTop: "1px solid #E5E7EB", margin: "0.85rem 0" }} />
                  <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>🏧 Transferencia (no afecta el conteo físico de efectivo)</p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.4rem" }}>
                    <span style={{ color: "#6B7280" }}>+ Transferencia cobrada</span>
                    <span style={{ fontWeight: 600, color: "#3B82F6" }}>${parseFloat(turnoActivo.total_transferencia_sistema || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
                    <span style={{ color: "#6B7280" }}>− Reembolsos por transferencia</span>
                    <span style={{ fontWeight: 600, color: "#EF4444" }}>${parseFloat(turnoActivo.total_reembolsos_transferencia || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: "1px dashed #E5E7EB", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontFamily: FONTC, fontWeight: 700 }}>
                    <span>NETO TRANSFERENCIA DEL TURNO</span>
                    <span style={{ color: ORANGE }}>${(parseFloat(turnoActivo.total_transferencia_sistema || 0) - parseFloat(turnoActivo.total_reembolsos_transferencia || 0)).toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {!confirmarCierre ? (
              <>
                <ModoConteoToggle modo={modoCierre} setModo={setModoCierre} />

                {modoCierre === "conteo" ? (
                  <ConteoDenominaciones cantidades={denomCierre} onChange={setDenomCierre} />
                ) : (
                  <>
                    <label style={S.label}>Efectivo contado físicamente</label>
                    <input
                      type="number" min="0" step="0.01" placeholder="0.00"
                      value={efectivoContado}
                      onChange={e => setEfectivoContado(e.target.value)}
                      style={{ ...S.input, width: "100%", marginBottom: "0.5rem" }}
                    />
                  </>
                )}

                {(() => {
                  const dif = totalContadoActual - parseFloat(turnoActivo.efectivo_esperado_actual || 0);
                  const ok = Math.abs(dif) < 0.01;
                  return (
                    <p style={{ fontSize: "0.8rem", margin: "0 0 1rem", color: ok ? "#10B981" : (dif > 0 ? "#3B82F6" : "#EF4444"), fontFamily: FONTC, fontWeight: 700 }}>
                      {ok ? "✓ Caja cuadrada" : dif > 0 ? `Sobrante de $${dif.toFixed(2)}` : `Faltante de $${Math.abs(dif).toFixed(2)}`}
                    </p>
                  );
                })()}

                <label style={S.label}>Observaciones (opcional)</label>
                <textarea
                  rows={2} placeholder="Notas sobre el cierre, novedades, etc."
                  value={observacionesCierre}
                  onChange={e => setObservacionesCierre(e.target.value)}
                  style={{ ...S.input, width: "100%", marginBottom: "1.25rem", resize: "vertical", fontFamily: FONT }}
                />

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={irARevisarCierre} style={{ ...S.btnFull, flex: 1, background: "#EF4444" }}>
                    🔒 REVISAR Y CERRAR
                  </button>
                  <button onClick={() => setShowCerrarTurno(false)} style={S.btnCancel}>Cancelar</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem" }}>
                  <p style={{ fontFamily: FONTC, fontSize: "0.8rem", fontWeight: 700, color: "#92400E", margin: "0 0 0.6rem", textTransform: "uppercase" }}>
                    Confirma los datos antes de cerrar
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", marginBottom: "0.3rem" }}>
                    <span style={{ color: "#6B7280" }}>Efectivo contado</span>
                    <span style={{ fontWeight: 700 }}>${totalContadoActual.toFixed(2)}</span>
                  </div>
                  {(() => {
                    const dif = totalContadoActual - parseFloat(turnoActivo.efectivo_esperado_actual || 0);
                    const ok = Math.abs(dif) < 0.01;
                    return (
                      <p style={{ fontSize: "0.8rem", margin: "0.3rem 0 0", color: ok ? "#10B981" : (dif > 0 ? "#3B82F6" : "#EF4444"), fontFamily: FONTC, fontWeight: 700 }}>
                        {ok ? "✓ Caja cuadrada" : dif > 0 ? `Sobrante de $${dif.toFixed(2)}` : `Faltante de $${Math.abs(dif).toFixed(2)}`}
                      </p>
                    );
                  })()}
                </div>

                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button onClick={handleCerrarTurno} disabled={procesandoCierre} style={{ ...S.btnFull, flex: 1, background: "#EF4444", opacity: procesandoCierre ? 0.7 : 1 }}>
                    {procesandoCierre ? "Cerrando..." : "✅ CONFIRMAR CIERRE DEFINITIVO"}
                  </button>
                  <button onClick={() => setConfirmarCierre(false)} disabled={procesandoCierre} style={S.btnCancel}>Volver</button>
                </div>
              </>
            )}
          </div>
        </Overlay>
      )}

      {/* ══════════ MODAL COMPROBANTE DE CIERRE ══════════ */}
      {comprobanteCierre && (
        <Overlay onClose={() => setComprobanteCierre(null)}>
          <ModalHeader title="CIERRE" titleOrange="DE CAJA" subtitle={`Turno #${comprobanteCierre.cierre.id_cierre}`} onClose={() => setComprobanteCierre(null)} />
          <div style={S.modalBody}>
            <ComprobanteCierreView detalle={comprobanteCierre} onCerrar={() => setComprobanteCierre(null)} />
          </div>
        </Overlay>
      )}

      {/* ══════════ MODAL REEMBOLSO ══════════ */}
      {showReembolso && (
        <Overlay onClose={() => !procesandoReembolso && setShowReembolso(null)}>
          <ModalHeader
            title="REGISTRAR"
            titleOrange="REEMBOLSO"
            subtitle={`Orden: ${showReembolso.numero_ticket || `#${showReembolso.id_orden}`}`}
            onClose={() => !procesandoReembolso && setShowReembolso(null)}
          />
          <div style={S.modalBody}>
            {msgReembolso && <Alert msg={msgReembolso} />}

            <div style={{ background: "#FEF2F2", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1.25rem", border: "1px solid #FECACA" }}>
              <p style={{ fontSize: "0.8rem", color: "#991B1B", margin: 0 }}>
                Paciente: <strong>{showReembolso.nombres} {showReembolso.apellidos}</strong> · Pagado: <strong>${parseFloat(showReembolso.monto || 0).toFixed(2)}</strong>
              </p>
            </div>

            <label style={S.label}>Monto a reembolsar</label>
            <input
              type="number" min="0" step="0.01"
              value={formReembolso.monto}
              onChange={e => setFormReembolso(f => ({ ...f, monto: e.target.value }))}
              style={{ ...S.input, width: "100%", marginBottom: "1rem" }}
            />

            <label style={S.label}>Método de reembolso</label>
            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
              {METODOS.map(m => (
                <button
                  key={m}
                  onClick={() => setFormReembolso(f => ({ ...f, metodo_reembolso: m }))}
                  style={{
                    flex: 1, padding: "0.6rem", borderRadius: "8px",
                    border: `1.5px solid ${formReembolso.metodo_reembolso === m ? "#EF4444" : "#E5E7EB"}`,
                    background: formReembolso.metodo_reembolso === m ? "#FEF2F2" : "#FAFAFA",
                    color: formReembolso.metodo_reembolso === m ? "#EF4444" : "#374151",
                    fontFamily: FONTC, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer",
                  }}
                >{m}</button>
              ))}
            </div>

            {formReembolso.metodo_reembolso === "Transferencia" && (
              <>
                <label style={S.label}>Número de referencia</label>
                <input
                  placeholder="Ej: TRX123456"
                  value={formReembolso.referencia}
                  onChange={e => setFormReembolso(f => ({ ...f, referencia: e.target.value }))}
                  style={{ ...S.input, width: "100%", marginBottom: "1rem" }}
                />
              </>
            )}

            <label style={S.label}>Motivo del reembolso</label>
            <textarea
              rows={2} placeholder="Ej: El paciente canceló la orden antes de tomar la muestra."
              value={formReembolso.motivo}
              onChange={e => setFormReembolso(f => ({ ...f, motivo: e.target.value }))}
              style={{ ...S.input, width: "100%", marginBottom: "1.25rem", resize: "vertical", fontFamily: FONT }}
            />

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={handleProcesarReembolso} disabled={procesandoReembolso} style={{ ...S.btnFull, flex: 1, background: "#EF4444", opacity: procesandoReembolso ? 0.7 : 1 }}>
                {procesandoReembolso ? "Procesando..." : "↩️ CONFIRMAR REEMBOLSO"}
              </button>
              <button onClick={() => setShowReembolso(null)} disabled={procesandoReembolso} style={S.btnCancel}>Cancelar</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ══════════ MODAL QR ══════════ */}
      {showQR && (
        <Overlay onClose={cerrarQR}>
          <ModalHeader title="LEER" titleOrange="QR / TICKET" subtitle="Escanea el código del paciente o ingresa el ticket manual" onClose={cerrarQR} />
          <div style={S.modalBody}>
            {qrLoading && (
              <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                <div style={S.spinner} />
                <p style={{ color: "#6B7280", fontSize: "0.85rem", marginTop: "0.75rem" }}>Buscando orden...</p>
              </div>
            )}
            {qrInvalido && !qrLoading && (
              <div style={S.qrInvalidBox}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⛔</div>
                <p style={{ fontFamily: FONTC, fontSize: "1.1rem", fontWeight: 800, color: "#991B1B", margin: "0 0 0.5rem", textAlign: "center" }}>CÓDIGO QR NO VÁLIDO</p>
                <p style={{ fontSize: "0.85rem", color: "#B91C1C", textAlign: "center", margin: "0 0 1rem", lineHeight: 1.6 }}>Este código QR ya no es válido.</p>
                <button onClick={() => { setQrInvalido(false); setQrError(""); setOrdenEscaneada(null); setTicketManual(""); setModoQR("manual"); }} style={{ ...S.btnFull, marginBottom: "0.5rem" }}>
                  ⌨️ BUSCAR POR NÚMERO DE TICKET
                </button>
                <button onClick={cerrarQR} style={{ ...S.btnCancel, width: "100%" }}>Cerrar</button>
              </div>
            )}
            {qrError && !qrInvalido && !qrLoading && (
              <div style={S.alertError}>⚠️ {qrError}</div>
            )}
            {showQRAcciones && ordenEscaneada && !qrLoading && (
              <PanelAccionesQR
                data={ordenEscaneada}
                onCobrar={(o) => { cerrarQR(); abrirCobro(o); }}
                onVerDetalle={(o) => { cerrarQR(); setShowDetalle(o); }}
                onNuevoScan={() => {
                  setOrdenEscaneada(null); setShowQRAcciones(false);
                  setQrError(""); setQrInvalido(false); setTicketManual("");
                  if (modoQR === "camara") iniciarCamara();
                }}
                onCerrar={cerrarQR}
              />
            )}
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
                    <button onClick={cerrarQR} style={S.btnCancel}>Cerrar Cámara</button>
                  </div>
                ) : (
                  <div>
                    <label style={S.label}>Código de Ticket (Ej: LAB-XXXX)</label>
                    <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                      <input type="text" placeholder="LAB-XXXX" value={ticketManual} onChange={e => setTicketManual(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarManual()} style={{ ...S.input, flex: 1 }} />
                      <button onClick={buscarManual} style={S.btnFull2}>BUSCAR</button>
                    </div>
                    <button onClick={cerrarQR} style={{ ...S.btnCancel, width: "100%" }}>Cerrar</button>
                  </div>
                )}
              </>
            )}
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTE: PARTE DE PAGO ───────────────────────────────────────────
function PagoParteSub({ parte, idx, esMixto, totalOrden, onChange }) {
  const titulo = esMixto ? `Parte ${idx + 1}` : "Método de Pago";
  return (
    <div style={{
      background: "#F8FAFC",
      border: "1.5px solid #E5E7EB",
      borderRadius: "10px",
      padding: "1rem",
      marginBottom: "0.85rem",
    }}>
      <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.75rem" }}>
        {titulo}
      </p>

      {/* Selector de método */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem", marginBottom: "0.75rem" }}>
        {METODOS.map(m => {
          // En modo mixto no permitir repetir el mismo método en ambas partes
          const activo = parte.metodo_pago === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(idx, "metodo_pago", m)}
              style={{
                padding: "0.55rem",
                borderRadius: "7px",
                border: `1.5px solid ${activo ? ORANGE : "#E5E7EB"}`,
                background: activo ? `${ORANGE}15` : "#FFF",
                color: activo ? ORANGE : "#374151",
                fontFamily: FONTC,
                fontWeight: activo ? 700 : 500,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              {m === "Efectivo" ? "💵" : "🏦"} {m}
            </button>
          );
        })}
      </div>

      {/* Monto */}
      <div style={{ marginBottom: parte.metodo_pago === "Transferencia" ? "0.75rem" : 0 }}>
        <label style={S.label}>Monto *</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          max={totalOrden}
          value={parte.monto}
          onChange={e => onChange(idx, "monto", e.target.value)}
          style={{ ...S.input, width: "100%" }}
          placeholder="0.00"
        />
      </div>

      {/* Referencia (solo Transferencia) */}
      {parte.metodo_pago === "Transferencia" && (
        <div>
          <label style={S.label}>N° de Referencia / Comprobante *</label>
          <input
            type="text"
            value={parte.referencia}
            onChange={e => onChange(idx, "referencia", e.target.value)}
            style={{ ...S.input, width: "100%", textTransform: "uppercase" }}
            placeholder="Ej: TRF-20250629-001"
          />
          <p style={{ fontSize: "0.73rem", color: "#6B7280", margin: "0.3rem 0 0", fontFamily: FONT }}>
            Ingresa el número de transacción que aparece en el comprobante bancario.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTE: RESUMEN MIXTO ───────────────────────────────────────────
function ResumenMixto({ partes, total }) {
  const suma = partes.reduce((s, p) => s + (parseFloat(p.monto) || 0), 0);
  const diff = Math.abs(suma - total);
  const ok   = diff <= 0.01;

  return (
    <div style={{
      background: ok ? "rgba(16,185,129,0.06)" : "rgba(239,68,68,0.06)",
      border: `1.5px solid ${ok ? "#BBF7D0" : "#FCA5A5"}`,
      borderRadius: "10px",
      padding: "0.85rem 1rem",
    }}>
      <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: ok ? "#065F46" : "#991B1B", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>
        {ok ? "✓ Desglose correcto" : "⚠ La suma no coincide con el total"}
      </p>
      {partes.map((p, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#1F2937", marginBottom: "0.2rem" }}>
          <span>{p.metodo_pago || "—"}{p.referencia ? ` (${p.referencia.toUpperCase()})` : ""}</span>
          <span style={{ fontFamily: FONTC, fontWeight: 700 }}>${parseFloat(p.monto || 0).toFixed(2)}</span>
        </div>
      ))}
      <div style={{ borderTop: "1px dashed #D1FAE5", marginTop: "0.5rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontFamily: FONTC, fontWeight: 800, fontSize: "0.95rem", color: ok ? "#065F46" : "#991B1B" }}>
        <span>SUMA</span>
        <span>${suma.toFixed(2)}</span>
      </div>
      {!ok && (
        <p style={{ fontSize: "0.78rem", color: "#DC2626", margin: "0.4rem 0 0", fontFamily: FONT }}>
          Diferencia: ${diff.toFixed(2)}. Ajusta los montos hasta que sumen ${total.toFixed(2)}.
        </p>
      )}
    </div>
  );
}

// ─── SUB-COMPONENTE: COMPROBANTE ─────────────────────────────────────────────
function ComprobanteView({ comprobante, onCerrar }) {
  const { orden, partes, total, fecha, esMixto } = comprobante;

  const imprimir = () => {
    // Inyectar estilos de impresión temporalmente
    const styleId = "comprobante-print-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        @media print {
          body > *:not(#comprobante-print-wrapper) { display: none !important; }
          #comprobante-print-wrapper {
            position: fixed !important;
            inset: 0 !important;
            display: block !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 20px !important;
          }
          #comprobante-print {
            font-family: 'Courier New', monospace !important;
            font-size: 12px !important;
            max-width: 320px !important;
            margin: 0 auto !important;
            background: white !important;
            border: none !important;
            padding: 0 !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Mover el comprobante a un wrapper de nivel raíz temporal
    const wrapper = document.getElementById("comprobante-print-wrapper") || (() => {
      const el = document.createElement("div");
      el.id = "comprobante-print-wrapper";
      document.body.appendChild(el);
      return el;
    })();

    const contenido = document.getElementById("comprobante-print");
    const clon = contenido.cloneNode(true);
    clon.id = "comprobante-print";
    wrapper.innerHTML = "";
    wrapper.appendChild(clon);

    window.print();

    // Limpiar después de imprimir
    setTimeout(() => {
      wrapper.innerHTML = "";
    }, 500);
  };

  return (
    <>
      {/* Vista previa */}
      <div id="comprobante-print" style={{
        fontFamily: "'Courier New', monospace",
        background: "#FAFAFA",
        border: "1px dashed #D1D5DB",
        borderRadius: "10px",
        padding: "1.25rem",
        marginBottom: "1.25rem",
        fontSize: "0.82rem",
        lineHeight: 1.6,
      }}>
        <p style={{ fontSize: "1rem", fontWeight: "bold", textAlign: "center", margin: "0 0 2px" }}>
          LABORATORIO CLÍNICO CARDENAS-GAROFALO
        </p>
        <p style={{ fontSize: "0.7rem", textAlign: "center", color: "#6B7280", marginBottom: "0.75rem" }}>
          COMPROBANTE DE PAGO
        </p>

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.5rem 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ color: "#6B7280" }}>Ticket:</span>
          <strong>{orden.numero_ticket || `#${orden.id_orden}`}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ color: "#6B7280" }}>Paciente:</span>
          <span>{orden.nombres ? `${orden.nombres} ${orden.apellidos}` : `#${orden.id_paciente}`}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ color: "#6B7280" }}>Cédula:</span>
          <span>{orden.cedula || "—"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ color: "#6B7280" }}>Fecha:</span>
          <span>{fecha.toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.5rem 0" }} />

        <p style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {esMixto ? "Detalle de Pago Mixto" : "Método de Pago"}
        </p>
        {partes.map((p, i) => (
          <div key={i} style={{ marginBottom: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{p.metodo_pago}</span>
              <strong>${parseFloat(p.monto || 0).toFixed(2)}</strong>
            </div>
            {p.metodo_pago === "Transferencia" && p.referencia && (
              <div style={{ fontSize: "0.72rem", color: "#6B7280", paddingLeft: "0.5rem" }}>
                REF: {p.referencia.toUpperCase()}
              </div>
            )}
          </div>
        ))}

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.5rem 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1rem", fontWeight: "bold" }}>
          <span>TOTAL PAGADO:</span>
          <span>${parseFloat(total || 0).toFixed(2)}</span>
        </div>

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.75rem 0 0.5rem" }} />
        <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#9CA3AF" }}>
          Gracias por su pago. Conserve este comprobante.
        </p>
      </div>

      {/* Botones */}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={imprimir} style={{ ...S.btnFull, flex: 1, background: "#1D4ED8" }}>
          🖨️ IMPRIMIR COMPROBANTE
        </button>
        <button onClick={onCerrar} style={S.btnCancel}>Cerrar</button>
      </div>
    </>
  );
}

// ─── COMPROBANTE DE CIERRE DE CAJA ────────────────────────────────────────────
function ComprobanteCierreView({ detalle, onCerrar }) {
  const { cierre, pagos, reembolsos } = detalle;
  const dif = parseFloat(cierre.diferencia || 0);
  const cuadrado = Math.abs(dif) < 0.01;

  const imprimir = () => {
    const styleId = "cierre-print-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        @media print {
          body > *:not(#cierre-print-wrapper) { display: none !important; }
          #cierre-print-wrapper {
            position: fixed !important; inset: 0 !important; display: block !important;
            background: white !important; z-index: 99999 !important; padding: 20px !important;
          }
          #cierre-print {
            font-family: 'Courier New', monospace !important; font-size: 12px !important;
            max-width: 340px !important; margin: 0 auto !important;
            background: white !important; border: none !important; padding: 0 !important;
          }
        }
      `;
      document.head.appendChild(style);
    }
    const wrapper = document.getElementById("cierre-print-wrapper") || (() => {
      const el = document.createElement("div");
      el.id = "cierre-print-wrapper";
      document.body.appendChild(el);
      return el;
    })();
    const contenido = document.getElementById("cierre-print");
    const clon = contenido.cloneNode(true);
    clon.id = "cierre-print";
    wrapper.innerHTML = "";
    wrapper.appendChild(clon);
    window.print();
    setTimeout(() => { wrapper.innerHTML = ""; }, 500);
  };

  return (
    <>
      <div id="cierre-print" style={{
        fontFamily: "'Courier New', monospace", background: "#FAFAFA", border: "1px dashed #D1D5DB",
        borderRadius: "10px", padding: "1.25rem", marginBottom: "1.25rem", fontSize: "0.8rem", lineHeight: 1.6,
        maxHeight: "45vh", overflowY: "auto",
      }}>
        <p style={{ fontSize: "1rem", fontWeight: "bold", textAlign: "center", margin: "0 0 2px" }}>
          LABORATORIO CLÍNICO CARDENAS-GAROFALO
        </p>
        <p style={{ fontSize: "0.7rem", textAlign: "center", color: "#6B7280", marginBottom: "0.75rem" }}>
          CIERRE DE CAJA #{cierre.id_cierre}
        </p>

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.5rem 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ color: "#6B7280" }}>Secretaria:</span>
          <strong>{cierre.nombres} {cierre.apellidos}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ color: "#6B7280" }}>Apertura:</span>
          <span>{new Date(cierre.fecha_apertura).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ color: "#6B7280" }}>Cierre:</span>
          <span>{cierre.fecha_cierre ? new Date(cierre.fecha_cierre).toLocaleString("es-EC", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</span>
        </div>

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.5rem 0" }} />

        <p style={{ fontWeight: "bold", marginBottom: "4px", fontSize: "0.75rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Resumen</p>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span>Fondo inicial</span><span>${parseFloat(cierre.monto_inicial || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span>+ Efectivo cobrado ({pagos.filter(p => (p.metodo_pago || "").includes("Efectivo")).length})</span>
          <span>${parseFloat(cierre.total_efectivo_sistema || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span>+ Transferencia cobrada</span><span>${parseFloat(cierre.total_transferencia_sistema || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span>− Reembolsos efectivo ({reembolsos.filter(r => r.metodo_reembolso === "Efectivo").length})</span>
          <span>${parseFloat(cierre.total_reembolsos_efectivo || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span>− Reembolsos transferencia</span><span>${parseFloat(cierre.total_reembolsos_transferencia || 0).toFixed(2)}</span>
        </div>

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.5rem 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>Efectivo esperado:</span><span>${parseFloat(cierre.efectivo_esperado || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
          <span>Efectivo contado:</span><span>${parseFloat(cierre.efectivo_contado || 0).toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "1rem", color: cuadrado ? "#10B981" : (dif > 0 ? "#3B82F6" : "#EF4444") }}>
          <span>{cuadrado ? "CAJA CUADRADA" : dif > 0 ? "SOBRANTE:" : "FALTANTE:"}</span>
          <span>{cuadrado ? "$0.00" : `$${Math.abs(dif).toFixed(2)}`}</span>
        </div>

        {cierre.observaciones && (
          <>
            <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.5rem 0" }} />
            <p style={{ fontSize: "0.72rem", color: "#6B7280", margin: 0 }}><strong>Obs:</strong> {cierre.observaciones}</p>
          </>
        )}

        <div style={{ borderTop: "1px dashed #D1D5DB", margin: "0.75rem 0 0.5rem" }} />
        <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#9CA3AF" }}>
          {pagos.length} cobro(s) · {reembolsos.length} reembolso(s) en este turno
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button onClick={imprimir} style={{ ...S.btnFull, flex: 1, background: "#1D4ED8" }}>🖨️ IMPRIMIR CIERRE</button>
        <button onClick={onCerrar} style={S.btnCancel}>Cerrar</button>
      </div>
    </>
  );
}

// ─── PANEL QR ─────────────────────────────────────────────────────────────────
function PanelAccionesQR({ data, onCobrar, onVerDetalle, onNuevoScan, onCerrar }) {
  const o = data.orden || data;
  const detalles = data.examenes || data.detalles || [];
  const ec = estadoColor[o.estado] || { bg: "#F8FAFC", color: "#6B7280" };
  const puedeCobrar = o.estado === "Generada";

  return (
    <div>
      <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1rem" }}>
        <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#16A34A", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 0.3rem" }}>✓ ORDEN ENCONTRADA</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontFamily: FONTC, fontSize: "1.1rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>{o.nombres} {o.apellidos}</p>
            <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", color: "#6B7280", margin: "0.1rem 0 0" }}>Cédula: {o.cedula || "—"} · Ticket: {o.numero_ticket}</p>
          </div>
          <span style={{ background: ec.bg, color: ec.color, padding: "0.3rem 0.6rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: 700, fontFamily: FONTC, textTransform: "uppercase" }}>{o.estado}</span>
        </div>
      </div>

      <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "0.85rem", border: "1px solid #E5E7EB", marginBottom: "1rem" }}>
        <p style={{ fontFamily: FONTC, fontSize: "0.7rem", fontWeight: 700, color: "#6B7280", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.5rem" }}>Exámenes en la orden</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "150px", overflowY: "auto" }}>
          {detalles.map((d, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#1F2937" }}>
              <span>• {d.nombre_examen}</span>
              <span style={{ fontWeight: 600 }}>${parseFloat(d.subtotal || d.precio || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px dashed #E5E7EB", marginTop: "0.6rem", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontFamily: FONTC, fontSize: "1rem", fontWeight: 700 }}>
          <span>TOTAL:</span>
          <span style={{ color: "#E88B3A" }}>${parseFloat(o.total || 0).toFixed(2)}</span>
        </div>
      </div>

      {puedeCobrar ? (
        <button onClick={() => onCobrar(o)} style={{ ...btnAccionQR, background: "#10B981", color: "#FFF", borderColor: "#10B981", marginBottom: "0.5rem" }}>
          💳 Proceder al cobro
        </button>
      ) : (
        <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem", border: "1px solid #E5E7EB", textAlign: "center", marginBottom: "0.5rem" }}>
          <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#6B7280", margin: 0 }}>
            Esta orden está en estado <strong>{o.estado}</strong>, no requiere cobro.
          </p>
        </div>
      )}
      <button onClick={() => onVerDetalle(o)} style={{ ...btnAccionQR, background: "#F3F4F6", color: "#1F2937", borderColor: "#E5E7EB", marginBottom: "0.5rem" }}>👁️ Ver detalle completo</button>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={onNuevoScan} style={{ ...btnAccionQR, flex: 1, textAlign: "center", background: "#F3F4F6", color: "#374151", borderColor: "#E5E7EB" }}>🔄 Buscar otro</button>
        <button onClick={onCerrar} style={{ ...btnAccionQR, flex: 1, textAlign: "center", background: "#FFF", color: "#6B7280", borderColor: "#E5E7EB" }}>Cerrar</button>
      </div>
    </div>
  );
}

const btnAccionQR = {
  padding: "0.7rem 1rem", borderRadius: "9px", border: "1.5px solid",
  fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem",
  letterSpacing: "0.04em", cursor: "pointer", transition: "opacity 0.15s",
  width: "100%", boxSizing: "border-box",
};

// ─── CONTEO INTERACTIVO DE DENOMINACIONES (arqueo de caja) ───────────────────
// Grilla de billetes/monedas con conteo por unidades; calcula el total en vivo.
// Es la forma estándar en que se maneja un arqueo físico de caja.
function ConteoDenominaciones({ cantidades, onChange }) {
  const grupos = ["Billetes", "Monedas"];
  return (
    <div style={{ background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E5E7EB", padding: "0.85rem", marginBottom: "0.75rem" }}>
      {grupos.map(g => (
        <div key={g} style={{ marginBottom: "0.65rem" }}>
          <p style={{ fontFamily: FONTC, fontSize: "0.68rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.4rem" }}>{g}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            {DENOMINACIONES.filter(d => d.grupo === g).map(d => {
              const cant = parseInt(cantidades?.[d.id], 10) || 0;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "7px", padding: "0.35rem 0.5rem" }}>
                  <span style={{ fontFamily: FONTC, fontWeight: 700, fontSize: "0.8rem", color: DARK, width: "44px" }}>{d.label}</span>
                  <span style={{ color: "#D1D5DB", fontSize: "0.75rem" }}>×</span>
                  <input
                    type="number" min="0" step="1" placeholder="0" inputMode="numeric"
                    value={cantidades?.[d.id] ?? ""}
                    onChange={e => onChange({ ...cantidades, [d.id]: e.target.value.replace(/[^0-9]/g, "") })}
                    style={{ width: "48px", border: "1px solid #E5E7EB", borderRadius: "5px", padding: "0.25rem 0.3rem", fontFamily: FONT, fontSize: "0.8rem", textAlign: "center", outline: "none" }}
                  />
                  <span style={{ marginLeft: "auto", fontSize: "0.76rem", color: "#6B7280", fontFamily: FONTC, fontWeight: 700 }}>${(cant * d.valor).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div style={{ borderTop: "1px dashed #E5E7EB", paddingTop: "0.5rem", display: "flex", justifyContent: "space-between", fontFamily: FONTC, fontWeight: 800, fontSize: "0.95rem" }}>
        <span>TOTAL CONTADO</span>
        <span style={{ color: ORANGE }}>${totalDenominaciones(cantidades).toFixed(2)}</span>
      </div>
    </div>
  );
}

// Selector entre "contar billete por billete" (recomendado) o ingresar el monto directo.
function ModoConteoToggle({ modo, setModo }) {
  const opciones = [
    { id: "conteo", label: "🧮 Contar denominaciones" },
    { id: "directo", label: "✏️ Ingresar monto directo" },
  ];
  return (
    <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.75rem" }}>
      {opciones.map(op => (
        <button
          key={op.id}
          type="button"
          onClick={() => setModo(op.id)}
          style={{
            flex: 1, padding: "0.45rem 0.5rem", borderRadius: "7px",
            border: `1.5px solid ${modo === op.id ? ORANGE : "#E5E7EB"}`,
            background: modo === op.id ? "rgba(232,139,58,0.1)" : "#FFF",
            color: modo === op.id ? ORANGE : "#6B7280",
            fontFamily: FONTC, fontWeight: 700, fontSize: "0.75rem", letterSpacing: "0.02em", cursor: "pointer",
          }}
        >{op.label}</button>
      ))}
    </div>
  );
}

// Paginador simple y reutilizable: "‹ Anterior · Página X de Y · Siguiente ›"
function Paginador({ pagina, totalPaginas, setPagina }) {
  if (totalPaginas <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => setPagina(p => Math.max(1, p - 1))}
        disabled={pagina === 1}
        style={{ ...S.btnCancel, padding: "0.4rem 0.85rem", opacity: pagina === 1 ? 0.4 : 1 }}
      >‹ Anterior</button>
      <span style={{ fontFamily: FONTC, fontSize: "0.8rem", color: "#6B7280" }}>
        Página <strong>{pagina}</strong> de {totalPaginas}
      </span>
      <button
        type="button"
        onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
        disabled={pagina === totalPaginas}
        style={{ ...S.btnCancel, padding: "0.4rem 0.85rem", opacity: pagina === totalPaginas ? 0.4 : 1 }}
      >Siguiente ›</button>
    </div>
  );
}

// Fila de la cascada de caja: muestra el signo (+ / − / =) junto al concepto,
// para que quede visualmente claro qué se suma, qué se resta y a qué resultado se llega.
function FilaCascada({ signo, label, value, bold, color }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "baseline",
      padding: bold ? "0.5rem 0 0" : "0.3rem 0",
      fontFamily: bold ? FONTC : FONT,
      fontWeight: bold ? 800 : 500,
      fontSize: bold ? "0.95rem" : "0.85rem",
      color: color || "#374151",
    }}>
      <span style={{ display: "flex", gap: "0.4rem" }}>
        {signo && <span style={{ color: "#9CA3AF", fontWeight: 700, width: "0.9rem" }}>{signo}</span>}
        <span style={bold ? { textTransform: "uppercase", letterSpacing: "0.03em" } : undefined}>{label}</span>
      </span>
      <span>{value}</span>
    </div>
  );
}

// Cascada de caja del turno EN VIVO: separa Efectivo y Transferencia y muestra
// explícitamente cobrado − reembolsado = neto, para que se entienda a dónde
// "se fue" el dinero de un reembolso en vez de mostrar cifras sueltas sin relación.
function CascadaCaja({ turno }) {
  const fondo            = parseFloat(turno.monto_inicial || 0);
  const efCobrado         = parseFloat(turno.total_efectivo_sistema || 0);
  const efReembolsado     = parseFloat(turno.total_reembolsos_efectivo || 0);
  const efEsperado        = parseFloat(turno.efectivo_esperado_actual || 0);
  const transCobrado      = parseFloat(turno.total_transferencia_sistema || 0);
  const transReembolsado  = parseFloat(turno.total_reembolsos_transferencia || 0);
  const transNeto         = transCobrado - transReembolsado;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
      <div style={{ ...S.tableCard, padding: "1.1rem 1.25rem" }}>
        <p style={{ fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.4rem" }}>💵 Efectivo</p>
        <FilaCascada label="Fondo inicial" value={`$${fondo.toFixed(2)}`} />
        <FilaCascada signo="+" label="Cobrado" value={`$${efCobrado.toFixed(2)}`} color="#10B981" />
        <FilaCascada signo="−" label="Reembolsado" value={`$${efReembolsado.toFixed(2)}`} color="#EF4444" />
        <div style={{ borderTop: "1px dashed #E5E7EB", marginTop: "0.2rem" }} />
        <FilaCascada signo="=" label="Esperado en caja" value={`$${efEsperado.toFixed(2)}`} bold color={ORANGE} />
      </div>
      <div style={{ ...S.tableCard, padding: "1.1rem 1.25rem" }}>
        <p style={{ fontFamily: FONTC, fontSize: "0.72rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.4rem" }}>🏧 Transferencia</p>
        <FilaCascada signo="+" label="Cobrada" value={`$${transCobrado.toFixed(2)}`} color="#3B82F6" />
        <FilaCascada signo="−" label="Reembolsada" value={`$${transReembolsado.toFixed(2)}`} color="#EF4444" />
        <div style={{ borderTop: "1px dashed #E5E7EB", marginTop: "0.2rem" }} />
        <FilaCascada signo="=" label="Neto del turno" value={`$${transNeto.toFixed(2)}`} bold color={ORANGE} />
      </div>
    </div>
  );
}

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
  btnQR:       { background: "#1F2937", border: "1px solid #1F2937", color: "#FFF", padding: "0.5rem 1.1rem", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.84rem", cursor: "pointer" },
  btnFull2:    { background: "#1F2937", color: "#FFF", border: "none", padding: "0.65rem 1.25rem", borderRadius: "8px", fontFamily: FONTC, fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em", cursor: "pointer" },
  qrInvalidBox: { background: "#FEF2F2", border: "1.5px solid #FCA5A5", borderRadius: "12px", padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", alignItems: "center" },
  alertError:  { background: "#FEF2F2", color: "#EF4444", border: "1px solid #FCA5A5", padding: "0.75rem 0.85rem", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1rem", textAlign: "center" },
  spinner:     { width: "32px", height: "32px", border: "3px solid #E5E7EB", borderTopColor: "#E88B3A", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto" },
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