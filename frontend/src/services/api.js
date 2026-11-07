import axios from 'axios';

// Backend base URL (empty on local development or when using Vercel rewrites)
const BASE_HOST = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/+$/, '') : '';
const API_BASE = BASE_HOST ? `${BASE_HOST}/api` : '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Helper to convert relative media paths (/api/files/...) to absolute URLs on Vercel
export const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BASE_HOST}${path}`;
};

// Health & Dashboard
export const getHealth = () => api.get('/health');
export const getDashboardStats = () => api.get('/dashboard/stats');

// Videos
export const uploadVideo = (formData, onProgress) =>
  api.post('/videos/upload', formData, {
    headers: { 'Content-Type': undefined },
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
    headers: { 'Content-Type': undefined },
  });
export const getSearchQueries = () => api.get('/search/');

// Analysis
export const startAnalysis = (data) => api.post('/analysis/start', data);
export const getAnalysisStatus = (id) => api.get(`/analysis/${id}`);
export const getAnalysisProgress = (id) => api.get(`/analysis/${id}/progress`);
export const getAnalysisJobs = () => api.get('/analysis/');
export const deleteAnalysisJob = (id) => api.delete(`/analysis/${id}`);

// Results
export const getAnalysisResults = (analysisId, params = {}) =>
  api.get(`/results/${analysisId}`, { params });

export default api;
