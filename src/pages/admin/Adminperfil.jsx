import { useState, useEffect, useRef, useCallback } from "react";
import API from "../../services/api";

/* ─── URL base para mostrar la imagen de firma ───────────────────────────── */
const FIRMA_BASE = "http://localhost:4000/storage/firmas";

/* ─── Hook: canvas de firma a mano ──────────────────────────────────────── */
function useSignaturePad(ref) {
  const drawing = useRef(false);
  const last    = useRef({ x: 0, y: 0 });

  const getPos = (e, cvs) => {
    const r = cvs.getBoundingClientRect();
    const s = e.touches ? e.touches[0] : e;
    return { x: s.clientX - r.left, y: s.clientY - r.top };
  };

  const start = useCallback((e) => {
    e.preventDefault();
    drawing.current = true;
    const cvs = ref.current;
    const ctx = cvs.getContext("2d");
    const p   = getPos(e, cvs);
    last.current = p;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = "#0F2544";
    ctx.fill();
  }, [ref]);

  const move = useCallback((e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const cvs = ref.current;
    const ctx = cvs.getContext("2d");
    const p   = getPos(e, cvs);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#0F2544";
    ctx.lineWidth   = 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    last.current = p;
  }, [ref]);

  const stop  = useCallback(() => { drawing.current = false; }, []);

  const clear = useCallback(() => {
    const cvs = ref.current;
    if (cvs) cvs.getContext("2d").clearRect(0, 0, cvs.width, cvs.height);
  }, [ref]);

  const isEmpty = useCallback(() => {
    if (!ref.current) return true;
    return !ref.current
      .getContext("2d")
      .getImageData(0, 0, ref.current.width, ref.current.height)
      .data.some(v => v !== 0);
  }, [ref]);

  const toPng = useCallback(() => ref.current?.toDataURL("image/png"), [ref]);

  return { start, move, stop, clear, isEmpty, toPng };
}

/* ─── Componente Principal ───────────────────────────────────────────────── */
export default function AdminPerfil() {
  const session = JSON.parse(localStorage.getItem("user") || "{}");
  const rol     = localStorage.getItem("rolActivo") || "ADMIN";

  /* estado formulario */
  const [form, setForm] = useState({
    nombres: "", apellidos: "", correo: "", cargo: "", observacion: "",
  });
  const [formErrors,   setFormErrors]   = useState({});
  const [firmaActual,  setFirmaActual]  = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState(null);
  const [firmaMode,    setFirmaMode]    = useState("canvas");
  const [fileSelec,    setFileSelec]    = useState(null);
  const [fileThumb,    setFileThumb]    = useState(null);
  const [confirmDel,   setConfirmDel]   = useState(false);

  const canvasRef = useRef(null);
  const fileRef   = useRef(null);
  const { start, move, stop, clear, isEmpty, toPng } = useSignaturePad(canvasRef);

  /* ── Toast ──────────────────────────────────────────────────────────────── */
  const showToast = (ok, msg) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3800);
  };

  /* ── Cargar perfil ──────────────────────────────────────────────────────── */
  useEffect(() => {
    API.get("/admin/perfil")
      .then(({ data }) => {
        setForm({
          nombres:     data.nombres     || "",
          apellidos:   data.apellidos   || "",
          correo:      data.correo      || "",
          cargo:       data.cargo       || "",
          observacion: data.observacion || "",
        });
        setFirmaActual(data.firma_digital || null);
      })
      .catch((err) => {
        const msg = err.response?.data?.error || err.message;
        console.error("❌ Error al cargar perfil:", msg);
        showToast(false, `No se pudo cargar el perfil: ${msg}`);
        setForm({
          nombres:     session.nombres     || "",
          apellidos:   session.apellidos   || "",
          correo:      session.correo      || "",
          cargo:       session.cargo       || "",
          observacion: "",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  /* ── Selección de archivo de firma ─────────────────────────────────────── */
  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      showToast(false, "Solo se permiten imágenes PNG o JPG.");
      return;
    }
    setFileSelec(f);
    const reader = new FileReader();
    reader.onload = (ev) => setFileThumb(ev.target.result);
    reader.readAsDataURL(f);
  };

  /* ── Validación de campos obligatorios ─────────────────────────────────── */
  const validarForm = () => {
    const e = {};
    if (!form.nombres.trim())   e.nombres   = "El nombre es obligatorio.";
    if (!form.apellidos.trim()) e.apellidos = "Los apellidos son obligatorios.";
    if (!form.correo.trim()) {
      e.correo = "El correo es obligatorio.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo.trim())) {
      e.correo = "Ingresa un correo electrónico válido.";
    }
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  /* ── Guardar: FormData → PUT /admin/perfil ──────────────────────────────── */
  const handleSave = async () => {
    if (!validarForm()) {
      showToast(false, "Corrige los campos marcados antes de guardar.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("nombres",     form.nombres);
      fd.append("apellidos",   form.apellidos);
      fd.append("correo",      form.correo);
      fd.append("cargo",       form.cargo);
      fd.append("observacion", form.observacion);

      if (firmaMode === "canvas" && !isEmpty()) {
        const dataUrl = toPng();
        const res     = await fetch(dataUrl);
        const blob    = await res.blob();
        fd.append("firma", blob, "firma.png");
      } else if (firmaMode === "file" && fileSelec) {
        fd.append("firma", fileSelec, fileSelec.name);
      }

      const { data } = await API.put("/admin/perfil", fd);

      if (data.firma) {
        setFirmaActual(data.firma);
        setFileSelec(null);
        setFileThumb(null);
        clear();
      }

      // Persistir en localStorage para que otros componentes lean cargo y firma actualizados
      const updatedSession = { ...session, ...form };
      if (data.firma) updatedSession.firma_digital = data.firma;
      localStorage.setItem("user", JSON.stringify(updatedSession));
      showToast(true, "Perfil actualizado correctamente.");
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      showToast(false, `Error al guardar: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  if (loading) return (
    <div style={S.centered}>
      <div style={S.spinner} />
    </div>
  );

  const initials = `${form.nombres[0] || "A"}${form.apellidos[0] || ""}`.toUpperCase();

  return (
    <div style={S.page}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{ ...S.toast, background: toast.ok ? "#166534" : "#991b1b" }}>
          {toast.ok ? "✓" : "✕"}&ensp;{toast.msg}
        </div>
      )}

      {/* ── Modal confirmación quitar firma ── */}
      {confirmDel && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <p style={S.modalTitle}>¿Quitar la firma actual?</p>
            <p style={S.modalBody}>
              Si guardas sin seleccionar una firma nueva, los documentos no podrán
              ser validados hasta que registres una nueva.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDel(false)} style={S.btnSec}>Cancelar</button>
              <button
                onClick={() => {
                  setFirmaActual(null);
                  setFileSelec(null);
                  setFileThumb(null);
                  clear();
                  setConfirmDel(false);
                }}
                style={S.btnDanger}
              >
                Sí, quitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Encabezado ── */}
      <header style={S.header}>
        <div>
          <h2 style={S.title}>Perfil del Administrador</h2>
          <p style={S.subtitle}>
            Actualiza tus datos y gestiona tu firma digital para la validación de documentos.
          </p>
        </div>
        <button onClick={handleSave} disabled={saving} style={{ ...S.btnPrimary, opacity: saving ? 0.65 : 1 }}>
          {saving ? <><span style={S.spinSm} />&ensp;Guardando…</> : <>💾&ensp;Guardar cambios</>}
        </button>
      </header>

      <div style={S.grid}>

        {/* ══ DATOS PERSONALES ══ */}
        <section style={S.card}>
          <div style={S.avatarRow}>
            <div style={S.avatar}>{initials}</div>
            <div>
              <p style={S.avatarName}>{form.nombres} {form.apellidos}</p>
              <span style={S.badge}>🛡 {rol}</span>
            </div>
          </div>

          <div style={S.divider} />

          <div style={S.fieldGrid}>
            <Fld
              label="Nombres *"
              value={form.nombres}
              onChange={v => { setForm(p => ({ ...p, nombres: v })); if (v.trim()) setFormErrors(e => ({ ...e, nombres: undefined })); }}
              error={formErrors.nombres}
            />
            <Fld
              label="Apellidos *"
              value={form.apellidos}
              onChange={v => { setForm(p => ({ ...p, apellidos: v })); if (v.trim()) setFormErrors(e => ({ ...e, apellidos: undefined })); }}
              error={formErrors.apellidos}
            />
            <Fld
              label="Correo electrónico *"
              type="email"
              value={form.correo}
              onChange={v => { setForm(p => ({ ...p, correo: v })); if (v.trim()) setFormErrors(e => ({ ...e, correo: undefined })); }}
              wide
              error={formErrors.correo}
            />
            <Fld
              label="Cargo"
              value={form.cargo}
              onChange={v => setForm(p => ({ ...p, cargo: v }))}
              wide
            />
            <div style={{ gridColumn: "span 2" }}>
              <label style={S.label}>Observaciones</label>
              <textarea
                value={form.observacion}
                onChange={e => setForm(p => ({ ...p, observacion: e.target.value }))}
                rows={3}
                style={{ ...S.input, resize: "vertical", lineHeight: 1.5 }}
                placeholder="Observaciones opcionales…"
              />
            </div>
          </div>
        </section>

        {/* ══ FIRMA DIGITAL ══ */}
        <section style={S.card}>
          <div style={S.firmHeader}>
            <div>
              <p style={S.cardTitle}>✍️ Firma Digital</p>
              <p style={S.cardDesc}>
                Se imprimirá automáticamente al <strong>validar y emitir documentos</strong>.
              </p>
            </div>
            {firmaActual && <span style={S.activeBadge}>● Activa</span>}
          </div>

          {/* Firma guardada en servidor */}
          {firmaActual && (
            <div style={S.currentFirmaBox}>
              <p style={S.previewLbl}>Firma almacenada</p>
              <img
                src={`${FIRMA_BASE}/${firmaActual}`}
                alt="Firma digital"
                style={S.firmaImg}
              />
              <button onClick={() => setConfirmDel(true)} style={S.btnTrash}>
                🗑 Quitar firma actual
              </button>
            </div>
          )}

          {/* Tabs */}
          <div style={S.tabs}>
            {["canvas", "file"].map(m => (
              <button
                key={m}
                onClick={() => setFirmaMode(m)}
                style={{ ...S.tab, ...(firmaMode === m ? S.tabOn : {}) }}
              >
                {m === "canvas" ? "✏️  Dibujar" : "📎  Subir archivo"}
              </button>
            ))}
          </div>

          {/* Panel dibujar */}
          {firmaMode === "canvas" && (
            <div style={{ marginTop: "0.75rem" }}>
              <p style={S.hint}>Usa el mouse o el dedo para dibujar tu firma:</p>
              <div style={S.canvasWrap}>
                <canvas
                  ref={canvasRef}
                  width={460} height={160}
                  style={S.canvas}
                  onMouseDown={start} onMouseMove={move} onMouseUp={stop} onMouseLeave={stop}
                  onTouchStart={start} onTouchMove={move} onTouchEnd={stop}
                />
                <div style={S.baseLine} />
                <span style={S.baseLineTxt}>Firma aquí</span>
              </div>
              <button onClick={clear} style={S.btnErase}>⌫&ensp;Limpiar canvas</button>
            </div>
          )}

          {/* Panel subir archivo */}
          {firmaMode === "file" && (
            <div style={{ marginTop: "0.75rem" }}>
              <p style={S.hint}>Sube una imagen PNG o JPG con fondo blanco:</p>
              <div style={S.dropzone} onClick={() => fileRef.current?.click()}>
                {fileThumb
                  ? <img src={fileThumb} alt="preview" style={{ maxHeight: "90px", objectFit: "contain" }} />
                  : <>
                      <span style={{ fontSize: "2rem" }}>🖼</span>
                      <p style={{ color: "#94A3B8", fontSize: "0.82rem", margin: "0.4rem 0 0" }}>
                        Clic para seleccionar
                      </p>
                    </>
                }
              </div>
              <input
                ref={fileRef} type="file" accept="image/png,image/jpeg"
                style={{ display: "none" }} onChange={handleFile}
              />
            </div>
          )}

          <div style={S.legalNote}>
            <strong>Importante:</strong> La firma queda registrada en auditoría.
            Cada documento validado llevará esta firma junto a tus datos de identificación.
          </div>
        </section>
      </div>
    </div>
  );
}

/* ─── Campo editable con soporte de error ────────────────────────────────── */
function Fld({ label, value, onChange, type = "text", wide, error }) {
  return (
    <div style={{ gridColumn: wide ? "span 2" : "span 1" }}>
      <label style={S.label}>{label}</label>
      <input
        type={type} value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...S.input, borderColor: error ? "#EF4444" : "#E2E8F0" }}
      />
      {error && (
        <span style={{ fontSize: "0.72rem", color: "#EF4444", display: "block", marginTop: "0.25rem", fontFamily: "'Barlow', sans-serif" }}>
          {error}
        </span>
      )}
    </div>
  );
}

/* ─── Estilos ────────────────────────────────────────────────────────────── */
const S = {
  page:     { maxWidth: "1080px", margin: "0 auto", padding: "1.5rem 1.25rem", fontFamily: "'Barlow', sans-serif" },
  centered: { display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column" },
  spinner:  { width: "36px", height: "36px", border: "3px solid #E2E8F0", borderTopColor: "#E88B3A", borderRadius: "50%", animation: "spin 0.8s linear infinite" },
  spinSm:   { display: "inline-block", width: "13px", height: "13px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite", verticalAlign: "middle" },

  header:   { display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" },
  title:    { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "2rem", fontWeight: 700, color: "#1E293B", textTransform: "uppercase", margin: 0 },
  subtitle: { color: "#64748B", fontSize: "0.88rem", margin: "0.2rem 0 0" },

  toast:    { position: "fixed", top: "1.25rem", right: "1.25rem", zIndex: 9999, color: "#fff", padding: "0.75rem 1.25rem", borderRadius: "10px", fontSize: "0.9rem", fontFamily: "'Barlow', sans-serif", boxShadow: "0 4px 20px rgba(0,0,0,0.2)", maxWidth: "360px", display: "flex", alignItems: "center", gap: "0.5rem" },

  overlay:    { position: "fixed", inset: 0, background: "rgba(15,37,68,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9998 },
  modal:      { background: "#fff", borderRadius: "14px", padding: "1.75rem", maxWidth: "420px", width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalTitle: { fontWeight: 700, color: "#1E293B", fontSize: "1.1rem", margin: "0 0 0.5rem" },
  modalBody:  { color: "#64748B", fontSize: "0.88rem", lineHeight: 1.6, margin: "0 0 1.25rem" },

  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "linear-gradient(135deg,#E88B3A,#F5A623)", color: "#fff", border: "none", borderRadius: "10px", padding: "0.65rem 1.4rem", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "1rem", cursor: "pointer", letterSpacing: "0.02em", boxShadow: "0 4px 14px rgba(232,139,58,0.4)" },
  btnSec:     { background: "#F1F5F9", color: "#334155", border: "1px solid #CBD5E1", borderRadius: "8px", padding: "0.55rem 1.1rem", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem" },
  btnDanger:  { background: "#DC2626", color: "#fff", border: "none", borderRadius: "8px", padding: "0.55rem 1.1rem", cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontSize: "0.88rem" },
  btnTrash:   { background: "none", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: "8px", padding: "0.4rem 0.9rem", cursor: "pointer", fontSize: "0.82rem", marginTop: "0.75rem", fontFamily: "'Barlow', sans-serif" },
  btnErase:   { background: "none", border: "1px solid #CBD5E1", color: "#64748B", borderRadius: "8px", padding: "0.4rem 0.9rem", cursor: "pointer", fontSize: "0.82rem", marginTop: "0.6rem", fontFamily: "'Barlow', sans-serif" },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" },
  card: { background: "#fff", borderRadius: "16px", border: "1px solid #E2E8F0", boxShadow: "0 2px 12px rgba(0,0,0,0.04)", padding: "1.75rem" },

  avatarRow:  { display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" },
  avatar:     { width: "68px", height: "68px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#E88B3A,#F5A623)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem", fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" },
  avatarName: { fontWeight: 700, color: "#1E293B", fontSize: "1.05rem", margin: "0 0 0.35rem" },
  badge:      { background: "rgba(232,139,58,0.12)", color: "#C96A10", padding: "0.2rem 0.7rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.05em" },
  divider:    { borderTop: "1px solid #F1F5F9", margin: "0 0 1.25rem" },

  fieldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" },
  label:     { display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.3rem" },
  input:     { width: "100%", boxSizing: "border-box", padding: "0.62rem 0.85rem", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "9px", color: "#334155", fontFamily: "'Barlow', sans-serif", fontSize: "0.93rem", outline: "none" },

  cardTitle:      { fontWeight: 700, color: "#1E293B", fontSize: "1rem", margin: "0 0 0.2rem" },
  cardDesc:       { color: "#64748B", fontSize: "0.83rem", margin: 0, lineHeight: 1.55 },
  firmHeader:     { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" },
  activeBadge:    { background: "#DCFCE7", color: "#166534", padding: "0.2rem 0.65rem", borderRadius: "99px", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" },
  currentFirmaBox:{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "0.85rem 1rem", marginBottom: "1rem", textAlign: "center" },
  previewLbl:     { fontSize: "0.72rem", fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 0.5rem" },
  firmaImg:       { maxWidth: "100%", maxHeight: "90px", objectFit: "contain", display: "block", margin: "0 auto" },

  tabs:   { display: "flex", gap: "0.5rem", marginTop: "0.5rem" },
  tab:    { flex: 1, padding: "0.55rem", border: "1px solid #E2E8F0", borderRadius: "9px", background: "#F8FAFC", cursor: "pointer", fontSize: "0.84rem", fontFamily: "'Barlow', sans-serif", color: "#64748B" },
  tabOn:  { background: "#FFF7ED", border: "1px solid #F5A623", color: "#C96A10", fontWeight: 700 },
  hint:   { color: "#94A3B8", fontSize: "0.81rem", margin: "0 0 0.6rem" },

  canvasWrap:  { position: "relative", background: "#FAFBFC", border: "1.5px dashed #CBD5E1", borderRadius: "10px", overflow: "hidden" },
  canvas:      { display: "block", touchAction: "none", cursor: "crosshair", width: "100%", height: "160px" },
  baseLine:    { position: "absolute", bottom: "28px", left: "1.5rem", right: "1.5rem", height: "1px", background: "#CBD5E1", pointerEvents: "none" },
  baseLineTxt: { position: "absolute", bottom: "8px", left: "50%", transform: "translateX(-50%)", fontSize: "0.7rem", color: "#CBD5E1", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.1em", pointerEvents: "none" },

  dropzone: { border: "1.5px dashed #CBD5E1", borderRadius: "10px", background: "#FAFBFC", minHeight: "120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "1rem" },

  legalNote: { marginTop: "1.25rem", padding: "0.8rem 1rem", background: "#FFF7ED", border: "1px solid #FDE68A", borderRadius: "9px", fontSize: "0.81rem", color: "#92400E", lineHeight: 1.55 },
};