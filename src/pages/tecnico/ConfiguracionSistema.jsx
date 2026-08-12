import { useState, useEffect } from 'react';
import API from '../../services/api';

const DEFAULTS = {
  expiracionQR:    '24',
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
      <div className="flex flex-col items-center justify-center gap-4 p-20 font-[Barlow,sans-serif]">
        <div className="w-7 h-7 rounded-full border-[3px] border-slate-100 border-t-[#E88B3A] animate-[spin_0.7s_linear_infinite]" />
        <p className="m-0 text-[0.85rem] text-gray-400">Cargando configuracion...</p>
      </div>
    );
  }

  return (
    <div className="relative max-w-[780px] p-6 font-[Barlow,sans-serif]">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[9999] max-w-[340px] rounded-lg border px-4 py-[0.7rem]
            text-[0.85rem] shadow-[0_4px_16px_rgba(0,0,0,0.08)] animate-[fadeIn_0.2s_ease]
            ${toast.tipo === 'ok'
              ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
              : 'bg-red-50 border-red-500 text-red-800'}`}
        >
          {toast.tipo === 'ok' ? 'OK' : 'Error'}: {toast.texto}
        </div>
      )}

      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-9">
        <div>
          <h2 className="m-0 text-[1.35rem] font-semibold text-gray-800">Configuracion del sistema</h2>
          <p className="mt-2 mb-0 text-[0.82rem] text-gray-500">
            Los cambios se aplican de inmediato en todo el sistema
          </p>
        </div>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className={`rounded-lg bg-[#E88B3A] px-5 py-[0.6rem] text-[0.88rem] font-semibold
            text-white transition-opacity ${guardando ? 'opacity-60 cursor-default' : 'opacity-100 cursor-pointer'}`}
        >
          {guardando ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>

      {/* Seccion: Resultados y acceso */}
      <Section titulo="Resultados y acceso">
        <Fila
          nombre="Validez del codigo QR del paciente"
          desc="Tiempo antes de que el QR expire"
        >
          <select
            value={config.expiracionQR}
            onChange={e => handleChange('expiracionQR', e.target.value)}
            className="cursor-pointer rounded-md border-[1.5px] border-gray-200 bg-[#FAFAFA]
              px-[0.7rem] py-[0.4rem] text-[0.84rem] text-gray-700 outline-none"
          >
            <option value="12">12 horas</option>
            <option value="24">24 horas</option>
            <option value="48">48 horas</option>
            <option value="72">72 horas</option>
          </select>
        </Fila>
      </Section>

      {/* Seccion: Notificaciones por correo */}
      <Section titulo="Notificaciones por correo">
        <div className="px-5 py-5">
          <p className="m-0 text-[0.92rem] font-medium text-gray-800">
            Correos para el reporte de cierre de caja
          </p>
          <p className="mt-1.5 mb-0 text-[0.78rem] leading-relaxed text-gray-500">
            Cada vez que una secretaria/asistente cierre un turno de caja, el reporte en PDF
            se enviará automáticamente a estos correos. Puedes agregar dos o más.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="email"
              value={nuevoCorreo}
              onChange={e => { setNuevoCorreo(e.target.value); setErrorCorreo(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAgregarCorreo(); } }}
              placeholder="admin@laboratorio.com"
              className="flex-1 basis-60 rounded-lg border-[1.5px] border-gray-200 bg-[#FAFAFA]
                px-[0.8rem] py-[0.55rem] text-[0.86rem] text-gray-700 outline-none
                focus:border-[#E88B3A]"
            />
            <button
              onClick={handleAgregarCorreo}
              type="button"
              className="whitespace-nowrap rounded-lg bg-gray-800 px-4 py-[0.55rem] text-[0.84rem]
                font-semibold text-white cursor-pointer"
            >
              + Agregar
            </button>
          </div>

          {errorCorreo && (
            <p className="mt-[0.4rem] mb-0 text-[0.78rem] text-red-500">{errorCorreo}</p>
          )}

          <div className="mt-[0.9rem] flex flex-wrap gap-2">
            {correos.length === 0 && (
              <p className="m-0 text-[0.8rem] text-gray-400">
                Todavía no hay correos configurados.
              </p>
            )}
            {correos.map(correo => (
              <span
                key={correo}
                className="inline-flex items-center gap-[0.4rem] rounded-full bg-slate-100
                  py-[0.35rem] pl-3 pr-2 text-[0.82rem] text-gray-700"
              >
                {correo}
                <button
                  onClick={() => handleQuitarCorreo(correo)}
                  type="button"
                  aria-label={`Quitar ${correo}`}
                  className="cursor-pointer border-none bg-transparent px-[0.2rem] text-base
                    leading-none text-gray-400"
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
          <select
            value={config.reintentosLogin}
            onChange={e => handleChange('reintentosLogin', e.target.value)}
            className="cursor-pointer rounded-md border-[1.5px] border-gray-200 bg-[#FAFAFA]
              px-[0.7rem] py-[0.4rem] text-[0.84rem] text-gray-700 outline-none"
          >
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
    <div className="mb-5 overflow-hidden rounded-xl border border-slate-100 bg-white">
      <div className="border-b border-slate-100 bg-slate-50 px-5 py-[0.65rem] text-[0.78rem]
        font-bold uppercase tracking-[0.06em] text-gray-500">
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Fila({ nombre, desc, children }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-slate-50 px-5 py-4">
      <div className="flex-1">
        <p className="m-0 text-[0.92rem] font-medium text-gray-800">{nombre}</p>
        <p className="mt-0.75 mb-0 text-[0.78rem] leading-relaxed text-gray-500">{desc}</p>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}