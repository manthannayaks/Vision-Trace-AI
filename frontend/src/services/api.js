import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Health & Dashboard
export const getHealth = () => api.get('/health');
export const getDashboardStats = () => api.get('/dashboard/stats');

// Videos
export const uploadVideo = (formData, onProgress) =>
  api.post('/videos/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
export const getVideos = () => api.get('/videos/');
export const getVideo = (id) => api.get(`/videos/${id}`);
export const deleteVideo = (id) => api.delete(`/videos/${id}`);

// Search Queries
export const createSearchQuery = (formData) =>
  api.post('/search/create', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const getSearchQueries = () => api.get('/search/');

// Analysis
export const startAnalysis = (data) => api.post('/analysis/start', data);
export const getAnalysisStatus = (id) => api.get(`/analysis/${id}`);
export const getAnalysisProgress = (id) => api.get(`/analysis/${id}/progress`);
export const getAnalysisJobs = () => api.get('/analysis/');

// Results
export const getAnalysisResults = (analysisId, params = {}) =>
  api.get(`/results/${analysisId}`, { params });

export default api;
