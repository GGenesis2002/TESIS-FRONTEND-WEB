// services/api.js
import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:4000/api',
});

API.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }

    // ← NUEVO: enviar el id_usuario_rol activo en cada request
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.id_usuario_rol) {
        config.headers['x-id-usuario-rol'] = user.id_usuario_rol;
    }

    return config;
});

export default API;