import API from './api';

export const getAdminStats = async () => {
    const { data } = await API.get('/dashboard/admin');
    return data;
};

export const getAsistenteStats = async () => {
    const { data } = await API.get('/dashboard/secretaria');
    return data;
};