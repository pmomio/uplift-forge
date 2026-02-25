import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const getTickets = () => api.get('/tickets');
export const updateTicket = (key: string, fields: any) => api.patch(`/tickets/${key}`, fields);
export const syncSingleTicket = (key: string) => api.post(`/tickets/${key}/sync`);
export const calculateHours = (key: string) => api.get(`/tickets/${key}/calculate`);
export const calculateFields = (key: string) => api.get(`/tickets/${key}/calculate-fields`);
export const triggerSync = () => api.post('/sync');
export const getConfig = () => api.get('/config');
export const saveConfig = (config: any) => api.post('/config', config);
export const getJiraFields = () => api.get('/jira/fields');
export const getJiraStatuses = () => api.get('/jira/statuses');

export default api;
