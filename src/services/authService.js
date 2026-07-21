import API from './api';

// ─── LOGIN OFICIAL ──────────────────────────────────────────────────────────
export const loginService = async (username, password) => {

    const { data } = await API.post('/login/login', { username, password, origen: 'web' });
    return data;
};
// ─── RECUPERACIÓN DE CONTRASEÑA (CÓDIGO AL CORREO) ──────────────────────────
export const solicitarCodigoService = async (correo) => {
    
    const { data } = await API.post('/login/solicitar-codigo', { correo });
    return data;
};

export const validarCodigoService = async (correo, codigo, nuevaPassword) => {
    
    const { data } = await API.post('/login/validar-codigo', { correo, codigo, nuevaPassword });
    return data;
};

// ─── RECUPERACIÓN DE USUARIO (POR CÉDULA O IDENTIFICADOR) ────────────────────
export const recuperarUsuarioService = async (identificador) => {
    
    const { data } = await API.post('/login/recuperar-usuario', { identificador });
    return data;
};