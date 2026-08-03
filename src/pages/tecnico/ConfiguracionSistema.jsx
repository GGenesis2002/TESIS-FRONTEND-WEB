import { useState, useEffect } from 'react';
import API from '../../services/api';

const DEFAULTS = {
  expiracionQR:    '2',
  reintentosLogin: '5',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ConfiguracionSistema() {
  const [config, setConfig]       = useState(DEFAULTS);
  const [correos, setCorreos]     = useState([]);      // correos de notificación de cierre de caja
  const [nuevoCorreo, setNuevoCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState('');
  const [loading, setLoading]     = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast]         = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const { data } = await API.get('/configuracion');
        if (data?.data) {
          setConfig({
            expiracionQR:    String(data.data.expiracionQR    ?? DEFAULTS.expiracionQR),
            reintentosLogin: String(data.data.reintentosLogin ?? DEFAULTS.reintentosLogin),
          });
          setCorreos(Array.isArray(data.data.correosCierreCaja) ? data.data.correosCierreCaja : []);
        }
      } catch {
        mostrarToast('err', 'No se pudo conectar con el servidor.');
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const mostrarToast = (tipo, texto) => {
    setToast({ tipo, texto });
    setTimeout(() => setToast(null), 4000);
  };

  const handleChange = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const handleAgregarCorreo = () => {
    const valor = nuevoCorreo.trim().toLowerCase();
    if (!valor) return;
    if (!EMAIL_REGEX.test(valor)) {
      setErrorCorreo('Ese correo no parece válido.');
      return;
    }
    if (correos.includes(valor)) {
      setErrorCorreo('Ese correo ya está en la lista.');
      return;
    }
    setCorreos(prev => [...prev, valor]);
    setNuevoCorreo('');
    setErrorCorreo('');
  };

  const handleQuitarCorreo = (correo) => {
    setCorreos(prev => prev.filter(c => c !== correo));
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setToast(null);
    try {
      const datosAEnviar = {
        expiracionQR:      Number(config.expiracionQR),
        reintentosLogin:   Number(config.reintentosLogin),
        correosCierreCaja: correos,
      };
      const { data } = await API.put('/configuracion/update', datosAEnviar);
      if (data.status === 'success') {
        mostrarToast('ok', 'Configuracion guardada correctamente.');
      }
    } catch (err) {
      console.error(err);
      mostrarToast('err', 'No se pudo guardar. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return (
      <div style={S.centered}>
        <div style={S.spinner} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#9CA3AF' }}>Cargando configuracion...</p>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          ...S.toast,
          background:  toast.tipo === 'ok' ? '#ECFDF5' : '#FEF2F2',
          borderColor: toast.tipo === 'ok' ? '#10B981' : '#EF4444',
          color:       toast.tipo === 'ok' ? '#065F46' : '#991B1B',
        }}>
          {toast.tipo === 'ok' ? 'OK' : 'Error'}: {toast.texto}
        </div>
      )}

      {/* Encabezado */}
      <div style={S.header}>
        <div>
          <h2 style={S.title}>Configuracion del sistema</h2>
          <p style={S.sub}>Los cambios se aplican de inmediato en todo el sistema</p>
        </div>
        <button onClick={handleGuardar} disabled={guardando} style={{ ...S.btnGuardar, opacity: guardando ? 0.6 : 1 }}>
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Seccion: Resultados y acceso */}
      <Section titulo="Resultados y acceso">
        <Fila
          nombre="Validez del codigo QR del paciente"
          desc="Tiempo antes de que el QR expire"
        >
          <select value={config.expiracionQR} onChange={e => handleChange('expiracionQR', e.target.value)} style={S.select}>
            <option value="2">12 horas</option>
            <option value="12">24 horas</option>
            <option value="24">48 horas</option>
            <option value="48">72 horas</option>
          </select>
        </Fila>
      </Section>

      {/* Seccion: Notificaciones por correo */}
      <Section titulo="Notificaciones por correo">
        <div style={{ padding: '1rem 1.25rem' }}>
          <p style={S.filaNombre}>Correos para el reporte de cierre de caja</p>
          <p style={S.filaDesc}>
            Cada vez que una secretaria/asistente cierre un turno de caja, el reporte en PDF
            se enviará automáticamente a estos correos. Puedes agregar dos o más.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <input
              type="email"
              value={nuevoCorreo}
              onChange={e => { setNuevoCorreo(e.target.value); setErrorCorreo(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarCorreo(); } }}
              placeholder="admin@laboratorio.com"
              style={S.inputCorreo}
            />
            <button onClick={handleAgregarCorreo} type="button" style={S.btnAgregar}>
              + Agregar
            </button>
          </div>

          {errorCorreo && (
            <p style={{ color: '#EF4444', fontSize: '0.78rem', margin: '0.4rem 0 0' }}>{errorCorreo}</p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.9rem' }}>
            {correos.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: '#9CA3AF', margin: 0 }}>
                Todavía no hay correos configurados.
              </p>
            )}
            {correos.map(correo => (
              <span key={correo} style={S.chip}>
                {correo}
                <button
                  onClick={() => handleQuitarCorreo(correo)}
                  type="button"
                  style={S.chipBtn}
                  aria-label={`Quitar ${correo}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* Seccion: Seguridad */}
      <Section titulo="Seguridad">
        <Fila
          nombre="Intentos de inicio de sesion fallidos permitidos"
          desc="Se registra una alerta si se supera este limite. El usuario que supere los intentos, deberá esperar 5 minutos para volver a ingresar."
        >
          <select value={config.reintentosLogin} onChange={e => handleChange('reintentosLogin', e.target.value)} style={S.select}>
            <option value="3">3 intentos</option>
            <option value="5">5 intentos</option>
            <option value="10">10 intentos</option>
          </select>
        </Fila>
      </Section>
    </div>
  );
}

/* Sub-componentes */

function Section({ titulo, children }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{titulo}</div>
      {children}
    </div>
  );
}

function Fila({ nombre, desc, children }) {
  return (
    <div style={S.fila}>
      <div style={{ flex: 1 }}>
        <p style={S.filaNombre}>{nombre}</p>
        <p style={S.filaDesc}>{desc}</p>
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}

/* Estilos */
const S = {
  page: {
    padding: '1.5rem',
    fontFamily: "'Barlow', sans-serif",
    position: 'relative',
    maxWidth: '780px',
  },
  centered: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '5rem', gap: '1rem',
    fontFamily: "'Barlow', sans-serif",
  },
  spinner: {
    width: '28px', height: '28px',
    border: '3px solid #F1F5F9',
    borderTop: '3px solid #E88B3A',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  toast: {
    position: 'fixed', top: '1rem', right: '1rem', zIndex: 9999,
    padding: '0.7rem 1rem', borderRadius: '8px', border: '1px solid',
    fontSize: '0.85rem', fontFamily: "'Barlow', sans-serif",
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    animation: 'fadeIn 0.2s ease', maxWidth: '340px',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem',
  },
  title: {
    fontSize: '1.35rem', fontWeight: 600,
    color: '#1F2937', margin: 0,
  },
  sub: {
    fontSize: '0.82rem', color: '#6B7280', margin: '4px 0 0',
  },
  btnGuardar: {
    background: '#E88B3A', color: '#FFF', border: 'none',
    padding: '0.6rem 1.25rem', borderRadius: '8px',
    fontFamily: "'Barlow', sans-serif", fontWeight: 600,
    fontSize: '0.88rem', cursor: 'pointer',
  },
  section: {
    background: '#FFF',
    border: '1px solid #F1F5F9',
    borderRadius: '12px',
    marginBottom: '1.25rem',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: '#6B7280',
    padding: '0.65rem 1.25rem',
    background: '#F8FAFC',
    borderBottom: '1px solid #F1F5F9',
  },
  fila: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '1rem 1.25rem', borderBottom: '1px solid #F8FAFC',
    gap: '1.5rem',
  },
  filaNombre: { fontSize: '0.92rem', fontWeight: 500, color: '#1F2937', margin: 0 },
  filaDesc:   { fontSize: '0.78rem', color: '#6B7280', margin: '3px 0 0', lineHeight: 1.5 },
  select: {
    padding: '0.4rem 0.7rem', borderRadius: '6px',
    border: '1.5px solid #E5E7EB', outline: 'none',
    fontFamily: "'Barlow', sans-serif", fontSize: '0.84rem',
    color: '#374151', background: '#FAFAFA', cursor: 'pointer',
  },
  inputCorreo: {
    flex: '1 1 240px',
    padding: '0.55rem 0.8rem', borderRadius: '8px',
    border: '1.5px solid #E5E7EB', outline: 'none',
    fontFamily: "'Barlow', sans-serif", fontSize: '0.86rem',
    color: '#374151', background: '#FAFAFA',
  },
  btnAgregar: {
    background: '#1F2937', color: '#FFF', border: 'none',
    padding: '0.55rem 1rem', borderRadius: '8px',
    fontFamily: "'Barlow', sans-serif", fontWeight: 600,
    fontSize: '0.84rem', cursor: 'pointer', whiteSpace: 'nowrap',
  },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    background: '#F1F5F9', color: '#374151',
    padding: '0.35rem 0.5rem 0.35rem 0.75rem', borderRadius: '999px',
    fontSize: '0.82rem', fontFamily: "'Barlow', sans-serif",
  },
  chipBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#9CA3AF', fontSize: '1rem', lineHeight: 1, padding: '0 0.2rem',
  },
  toggleBase: {
    width: '44px', height: '24px', borderRadius: '12px',
    border: 'none', cursor: 'pointer', position: 'relative',
    transition: 'background 0.2s',
  },
  toggleKnob: {
    position: 'absolute', top: '3px',
    width: '18px', height: '18px', borderRadius: '50%',
    background: '#FFF', transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
};