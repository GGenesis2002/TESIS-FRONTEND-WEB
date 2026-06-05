import API from './api';

// ─── LOGIN OFICIAL ──────────────────────────────────────────────────────────
export const loginService = async (username, password) => {
    // Da como resultado exacto en el backend: POST http://localhost:4000/api/login/login
    const { data } = await API.post('/login/login', { username, password });
    return data;
};

// ─── RECUPERACIÓN DE CONTRASEÑA (CÓDIGO AL CORREO) ──────────────────────────
export const solicitarCodigoService = async (correo) => {
    // Da como resultado exacto en el backend: POST http://localhost:4000/api/login/solicitar-codigo
    const { data } = await API.post('/login/solicitar-codigo', { correo });
    return data;
};

export const validarCodigoService = async (correo, codigo, nuevaPassword) => {
    // Da como resultado exacto en el backend: POST http://localhost:4000/api/login/validar-codigo
    const { data } = await API.post('/login/validar-codigo', { correo, codigo, nuevaPassword });
    return data;
};

// ─── RECUPERACIÓN DE USUARIO (POR CÉDULA O IDENTIFICADOR) ────────────────────
export const recuperarUsuarioService = async (identificador) => {
    // Da como resultado exacto en el backend: POST http://localhost:4000/api/login/recuperar-usuario
    const { data } = await API.post('/login/recuperar-usuario', { identificador });
    return data;
};