import API from "../services/api";

/**
 * Obtiene las notificaciones del usuario en sesión,
 * filtradas por el rol activo que se le pasa como argumento.
 *
 * @param {number|null} idUsuarioRol  - El id_usuario_rol activo (FK de la tabla usuario_rol).
 *                                      Si es null el backend devuelve notificaciones globales.
 */
export const getMisNotificaciones = async (idUsuarioRol = null) => {
  const headers = {};

  // Solo añadimos el header si tenemos el id del rol activo
  if (idUsuarioRol !== null) {
    headers["x-id-usuario-rol"] = idUsuarioRol;
  }

  const { data } = await API.get("/notificaciones", { headers });
  return data; // { notificaciones: [...], totalNoLeidas: N }
};

/** Marca una notificación como leída */
export const marcarLeida = async (id) => {
  const { data } = await API.put(`/notificaciones/${id}/leer`);
  return data;
};

/** Elimina físicamente una notificación */
export const eliminarNotificacion = async (id) => {
  const { data } = await API.delete(`/notificaciones/${id}`);
  return data;
};