// api.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

// Создаём инстанс с базовым URL
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерсептор для добавления токена
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерсептор для обработки ответов и ошибок
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string }>) => {
    if (error.response?.status === 401) {
      // Автоматический разлогин при истечении токена
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    // Прокидываем понятное сообщение об ошибке
    const message = error.response?.data?.detail || error.message || 'Произошла ошибка';
    return Promise.reject(new Error(message));
  }
);

// ==========================================
// HELPER: построение query-строки
// ==========================================

export function buildQuery(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export default api;