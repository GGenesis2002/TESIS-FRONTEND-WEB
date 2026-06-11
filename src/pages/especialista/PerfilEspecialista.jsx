import { useState, useEffect } from "react";
import API from "../../services/api";

/* ══════════════════════════════════════════════════════════
   PERFIL ESPECIALISTA
══════════════════════════════════════════════════════════ */
export default function PerfilEspecialista() {
  const userLocal = JSON.parse(localStorage.getItem("user") || "{}");

  const [perfil, setPerfil]       = useState(null);
  const [examenes, setExamenes]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg]             = useState(null);

  const [cambiandoPass, setCambiandoPass] = useState(false);
  const [editandoInfo, setEditandoInfo]   = useState(false);

  const [passForm, setPassForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [infoForm, setInfoForm] = useState({ nombres: "", apellidos: "", correo: "" });

  /* ── Cargar datos ── */
  const cargar = async () => {
    setLoading(true);
    try {
      const [{ data: p }, { data: exs }] = await Promise.all([
        API.get(`/personal/${userLocal.id}`),
        API.get(`/asignaciones?id_usuario=${userLocal.id}`),
      ]);
      setPerfil(p);
      setExamenes(Array.isArray(exs) ? exs : []);
      setInfoForm({
        nombres:   p.nombres   || "",
        apellidos: p.apellidos || "",
        correo:    p.correo    || "",
      });
    } catch {
      setPerfil(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const mostrarMsg = (tipo, texto) => {
    setMsg({ tipo, texto });
    setTimeout(() => setMsg(null), 4500);
  };

  /* ── Guardar info personal ── */
 const handleGuardarInfo = async () => {
  if (!infoForm.nombres || !infoForm.apellidos || !infoForm.correo) {
    return mostrarMsg("error", "Nombres, apellidos y correo son obligatorios.");
  }

  setGuardando(true);
  try {
    await API.put(`/personal/${userLocal.id}`, {
      nombres:      infoForm.nombres,
      apellidos:    infoForm.apellidos,
      correo:       infoForm.correo,
      username:     perfil?.username     || userLocal.username,
      cedula:       perfil?.cedula       || userLocal.cedula,
      id_rol:       perfil?.id_rol       || null,
      cargo:        perfil?.cargo        || null,
      especialidad: perfil?.especialidad || null,
      turno:        perfil?.turno        || null,
    });
    mostrarMsg("success", "✓ Información personal actualizada correctamente.");
    setEditandoInfo(false);
    cargar();
  } catch (err) {
    mostrarMsg("error", err.response?.data?.error || "Error al actualizar los datos.");
  } finally {
    setGuardando(false);
  }
};

  /* ── Cambiar contraseña ── */
  const handleCambiarPass = async () => {
    if (!passForm.actual)
      return mostrarMsg("error", "Ingresa tu contraseña actual.");
    if (!passForm.nueva || passForm.nueva.length < 6)
      return mostrarMsg("error", "La nueva contraseña debe tener al menos 6 caracteres.");
    if (passForm.nueva !== passForm.confirmar)
      return mostrarMsg("error", "Las contraseñas nuevas no coinciden.");

    setGuardando(true);
    try {
      await API.put("/usuarios/update-password", { actual: passForm.actual, nueva: passForm.nueva });
      mostrarMsg("success", "✓ Contraseña actualizada correctamente.");
      setPassForm({ actual: "", nueva: "", confirmar: "" });
      setCambiandoPass(false);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) mostrarMsg("error", "Contraseña actual incorrecta.");
      else mostrarMsg("error", err.response?.data?.msg || "Error al cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "5rem", gap: "1rem", fontFamily: "'Barlow', sans-serif" }}>
        <div style={S.spinner} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ color: "#9CA3AF", fontSize: "0.85rem", margin: 0 }}>Cargando perfil…</p>
      </div>
    );
  }

  return (
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={S.page}>

        {/* ── HEADER ── */}
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={S.title}>MI <span style={S.accent}>PERFIL</span></h2>
          <p style={S.sub}>Información de cuenta, especialidad y exámenes asignados</p>
        </div>

        {/* Toast */}
        {msg && (
          <div style={{ ...S.toast, background: msg.tipo === "success" ? "#F0FDF4" : "#FEF2F2", borderColor: msg.tipo === "success" ? "#10B981" : "#EF4444", color: msg.tipo === "success" ? "#065F46" : "#991B1B" }}>
            {msg.texto}
          </div>
        )}

        <div style={S.grid}>

          {/* ══════ COLUMNA IZQUIERDA — Avatar + Especialidad + Exámenes ══════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Avatar card */}
            <div style={S.avatarCard}>
              <div style={S.avatarCircle}>
                {(userLocal.nombres || perfil?.nombres || "E")[0].toUpperCase()}
              </div>
              <h3 style={S.avatarName}>
                {perfil?.nombres || userLocal.nombres} {perfil?.apellidos || userLocal.apellidos}
              </h3>
              <span style={S.rolBadge}>ESPECIALISTA</span>

              {perfil?.especialidad && (
                <div style={S.especialidadBadge}>
                  🔬 {perfil.especialidad}
                </div>
              )}

              <div style={S.divider} />

              <div style={S.infoRow}>
                <span style={S.infoLabel}>Usuario</span>
                <span style={S.infoValue}>@{userLocal.username || perfil?.username}</span>
              </div>
              {perfil?.cedula && (
                <div style={S.infoRow}>
                  <span style={S.infoLabel}>Cédula</span>
                  <span style={S.infoValue}>{perfil.cedula}</span>
                </div>
              )}
              <div style={S.infoRow}>
                <span style={S.infoLabel}>Estado</span>
                <span style={{ ...S.infoValue, color: "#16A34A", fontWeight: 700 }}>● Activo</span>
              </div>
              {perfil?.ultimo_acceso && (
                <div style={{ ...S.infoRow, flexDirection: "column", alignItems: "flex-start", gap: "0.15rem" }}>
                  <span style={S.infoLabel}>Último acceso</span>
                  <span style={{ ...S.infoValue, fontSize: "0.75rem" }}>
                    {new Date(perfil.ultimo_acceso).toLocaleString("es-EC")}
                  </span>
                </div>
              )}
            </div>

            {/* Exámenes asignados */}
            <div style={S.panel}>
              <h4 style={S.panelTitle}>MIS EXÁMENES ASIGNADOS</h4>
              {examenes.length === 0 ? (
                <p style={{ fontSize: "0.82rem", color: "#9CA3AF", textAlign: "center", padding: "1rem 0" }}>
                  No tienes exámenes asignados aún
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {examenes.map((ex, i) => (
                    <div key={ex.id_asignacion || i} style={S.examenTag}>
                      <span style={{ fontSize: "0.85rem" }}>🧪</span>
                      <span style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.82rem", color: "#374151", fontWeight: 500 }}>
                        {ex.nombre_examen}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <p style={{ fontSize: "0.72rem", color: "#C4C9D4", margin: "0.75rem 0 0", textAlign: "center" }}>
                Asignados por el técnico del sistema
              </p>
            </div>
          </div>

          {/* ══════ COLUMNA DERECHA — Información + Seguridad ══════ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* ── INFO PERSONAL ── */}
            <div style={S.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h4 style={{ ...S.panelTitle, margin: 0 }}>Información Personal</h4>
                <button
                  onClick={() => { if (editandoInfo) cargar(); setEditandoInfo(!editandoInfo); setMsg(null); }}
                  style={S.toggleBtn}
                >
                  {editandoInfo ? "Cancelar" : "✏️ Editar"}
                </button>
              </div>

              <div style={S.twoCol}>
                {editandoInfo ? (
                  <>
                    <EditField
                      label="Nombres"
                      value={infoForm.nombres}
                      onChange={v => setInfoForm(f => ({ ...f, nombres: v }))}
                    />
                    <EditField
                      label="Apellidos"
                      value={infoForm.apellidos}
                      onChange={v => setInfoForm(f => ({ ...f, apellidos: v }))}
                    />
                    <div style={{ gridColumn: "span 2" }}>
                      <EditField
                        label="Correo electrónico"
                        type="email"
                        value={infoForm.correo}
                        onChange={v => setInfoForm(f => ({ ...f, correo: v }))}
                      />
                    </div>
                    {/* Campos de solo lectura en modo edición */}
                    <InfoField label="Cédula"       value={perfil?.cedula} />
                    <InfoField label="Especialidad" value={perfil?.especialidad} />

                    <div style={{ gridColumn: "span 2", marginTop: "0.5rem" }}>
                      <button onClick={handleGuardarInfo} disabled={guardando} style={{ ...S.saveBtn, opacity: guardando ? 0.7 : 1 }}>
                        {guardando ? "Guardando…" : "GUARDAR CAMBIOS"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <InfoField label="Nombres"      value={perfil?.nombres} />
                    <InfoField label="Apellidos"    value={perfil?.apellidos} />
                    <InfoField label="Correo"       value={perfil?.correo} />
                    <InfoField label="Cédula"       value={perfil?.cedula} />
                    <InfoField label="Especialidad" value={perfil?.especialidad} />
                    <InfoField label="Username"     value={`@${perfil?.username || userLocal.username}`} />
                  </>
                )}
              </div>
            </div>

         
            

            {/* ── SEGURIDAD ── */}
            <div style={S.panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h4 style={{ ...S.panelTitle, margin: 0 }}>Seguridad de Cuenta</h4>
                <button
                  onClick={() => { setCambiandoPass(!cambiandoPass); setMsg(null); }}
                  style={S.toggleBtn}
                >
                  {cambiandoPass ? "Cancelar" : "🔒 Cambiar Contraseña"}
                </button>
              </div>

              {cambiandoPass ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <PassField label="Contraseña Actual"           value={passForm.actual}    onChange={v => setPassForm(f => ({ ...f, actual: v }))} />
                  <PassField label="Nueva Contraseña"            value={passForm.nueva}     onChange={v => setPassForm(f => ({ ...f, nueva: v }))} />
                  <PassField label="Confirmar Nueva Contraseña"  value={passForm.confirmar} onChange={v => setPassForm(f => ({ ...f, confirmar: v }))} />
                  <button onClick={handleCambiarPass} disabled={guardando} style={{ ...S.saveBtn, opacity: guardando ? 0.7 : 1 }}>
                    {guardando ? "Actualizando…" : "ACTUALIZAR CONTRASEÑA"}
                  </button>
                </div>
              ) : (
                <div style={S.secInfo}>
                  <span style={{ fontSize: "1.5rem" }}>🔐</span>
                  <p style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#6B7280", margin: 0 }}>
                    Tu contraseña está protegida con cifrado bcrypt. Cámbiala periódicamente para mayor seguridad.
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   SUB-COMPONENTES
══════════════════════════════════════════════════════════ */
function InfoField({ label, value }) {
  return (
    <div style={S.infoField}>
      <p style={S.fieldLabel}>{label}</p>
      <p style={S.fieldValue}>{value || "—"}</p>
    </div>
  );
}

function EditField({ label, value, onChange, type = "text" }) {
  return (
    <div style={S.infoField}>
      <label style={S.fieldLabel}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={S.input}
      />
    </div>
  );
}

function PassField({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label style={S.fieldLabel}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...S.input, paddingRight: "2.5rem" }}
        />
        <button type="button" onClick={() => setShow(s => !s)} style={S.eyeBtn}>
          {show ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: "#F8FAFC", borderRadius: "8px", padding: "0.85rem 1rem", display: "flex", alignItems: "center", gap: "0.65rem" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: `${color}15`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em", margin: 0 }}>{label}</p>
        <p style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.4rem", fontWeight: 800, color, margin: 0, lineHeight: 1.1 }}>{value}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ESTILOS
══════════════════════════════════════════════════════════ */
const S = {
  page:       { padding: "1rem", fontFamily: "'Barlow', sans-serif" },
  title:      { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.75rem", fontWeight: 700, color: "#1F2937", margin: 0, textTransform: "uppercase" },
  accent:     { color: "#8B5CF6" },
  sub:        { fontSize: "0.85rem", color: "#6B7280", margin: "0.25rem 0 0" },

  toast:      { padding: "0.75rem 1rem", borderRadius: "8px", border: "1px solid", fontSize: "0.85rem", marginBottom: "1.25rem", animation: "fadeIn 0.2s ease" },

  grid:       { display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start" },
  panel:      { background: "#FFF", borderRadius: "12px", padding: "1.5rem", border: "1px solid #F1F5F9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)" },
  panelTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.88rem", fontWeight: 700, color: "#1F2937", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 1.25rem" },
  twoCol:     { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" },

  // Avatar
  avatarCard:   { background: "#FFF", borderRadius: "12px", padding: "2rem 1.5rem", border: "1px solid #F1F5F9", boxShadow: "0 2px 4px rgba(0,0,0,0.02)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  avatarCircle: { width: "80px", height: "80px", borderRadius: "50%", background: "linear-gradient(135deg, #8B5CF6, #A78BFA)", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: "2rem", marginBottom: "1rem" },
  avatarName:   { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.05rem", fontWeight: 700, color: "#1F2937", margin: "0 0 0.5rem", textTransform: "uppercase" },
  rolBadge:     { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.15em", color: "#8B5CF6", background: "rgba(139,92,246,0.1)", padding: "0.3rem 0.75rem", borderRadius: "20px", border: "1px solid rgba(139,92,246,0.2)" },
  especialidadBadge: { marginTop: "0.6rem", background: "rgba(139,92,246,0.06)", border: "1px dashed rgba(139,92,246,0.25)", borderRadius: "8px", padding: "0.4rem 0.75rem", fontSize: "0.78rem", color: "#7C3AED", fontFamily: "'Barlow', sans-serif", fontWeight: 500 },
  divider:      { width: "100%", height: "1px", background: "#F1F5F9", margin: "1rem 0" },
  infoRow:      { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.35rem 0" },
  infoLabel:    { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#9CA3AF" },
  infoValue:    { fontFamily: "'Barlow', sans-serif", fontSize: "0.75rem", color: "#374151", fontWeight: 600 },

  examenTag:    { display: "flex", alignItems: "center", gap: "0.5rem", background: "#F8FAFC", border: "1px solid #F1F5F9", borderRadius: "7px", padding: "0.5rem 0.75rem" },

  // Campos
  infoField:  { background: "#F8FAFC", borderRadius: "8px", padding: "0.75rem 1rem" },
  fieldLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: "0.67rem", fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 0.25rem", display: "block" },
  fieldValue: { fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 600, color: "#1F2937", margin: 0 },
  input:      { width: "100%", padding: "0.5rem 0.7rem", border: "1.5px solid #E5E7EB", borderRadius: "6px", fontFamily: "'Barlow', sans-serif", fontSize: "0.85rem", color: "#1F2937", background: "#FFF", outline: "none", boxSizing: "border-box", marginTop: "0.1rem" },
  eyeBtn:     { position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: "0.25rem" },

  toggleBtn:  { background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "#8B5CF6", padding: "0.45rem 0.9rem", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.77rem", cursor: "pointer" },
  saveBtn:    { width: "100%", padding: "0.75rem", background: "#1F2937", color: "#FFF", border: "none", borderRadius: "8px", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: "0.9rem", letterSpacing: "0.1em", cursor: "pointer", textTransform: "uppercase" },

  secInfo:    { display: "flex", alignItems: "center", gap: "1rem", background: "#F8FAFC", borderRadius: "8px", padding: "1rem" },
  spinner:    { width: "28px", height: "28px", border: "3px solid #F1F5F9", borderTop: "3px solid #8B5CF6", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
};