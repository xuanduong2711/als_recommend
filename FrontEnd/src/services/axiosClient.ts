import axios from 'axios';

/**
 * Axios instance chính của ứng dụng.
 * - Base URL lấy từ biến môi trường VITE_API_BASE_URL
 * - Timeout mặc định: 10 giây
 */
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── REQUEST INTERCEPTOR ─────────────────────────────────────────────────────
// Tự động gán Bearer Token vào header nếu có token trong localStorage
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Xử lý lỗi xảy ra khi cấu hình request
    return Promise.reject(error);
  }
);

// ─── RESPONSE INTERCEPTOR ────────────────────────────────────────────────────
// Xử lý lỗi response chung: log lỗi, xử lý 401 Unauthorized
axiosClient.interceptors.response.use(
  (response) => {
    // Trả về response bình thường nếu thành công
    return response;
  },
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Token hết hạn hoặc không hợp lệ → xóa token và có thể redirect về login
      console.warn('[axiosClient] Token không hợp lệ hoặc hết hạn. Đang xóa...');
      localStorage.removeItem('accessToken');
      // TODO: Redirect về trang login nếu cần
      // window.location.href = '/login';
    }

    if (status === 403) {
      console.warn('[axiosClient] Không có quyền truy cập tài nguyên này.');
    }

    if (status === 500) {
      console.error('[axiosClient] Lỗi server:', error.response?.data);
    }

    // Log chi tiết lỗi để debug
    console.error(`[axiosClient] Lỗi ${status ?? 'Network'}:`, error.message);

    return Promise.reject(error);
  }
);

export default axiosClient;
