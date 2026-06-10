import axiosClient from './axiosClient';
import { ENDPOINTS } from './endpoints';
import type { BookEntity } from './bookService';

// ─── TYPES: REQUEST PAYLOADS ──────────────────────────────────────────────────

/**
 * Payload đăng nhập.
 * Khớp với UserLoginDto.cs: { user_name, Password }
 * Lưu ý: dùng "user_name" (không phải "email"), "Password" viết hoa P
 */
export interface LoginPayload {
  user_name: string;
  password: string;
}

/**
 * Payload đăng ký tài khoản mới.
 * Khớp với UserRegistrationDto.cs: { user_name, email, password, sex }
 */
export interface RegisterPayload {
  user_name: string;
  email: string;
  full_name: string;
  password: string;
  sex?: 'Man' | 'Woman' | 'Other';
}

/**
 * Payload cập nhật thông tin người dùng.
 * Khớp với UserUpdateDto.cs
 */
export interface UpdateUserPayload {
  user_name?: string;
  email?: string;
  full_name?: string;
  sex?: 'Man' | 'Woman' | 'Other';
}

/**
 * Payload đổi mật khẩu.
 * Khớp với ChangePasswordDto.cs
 */
export interface ChangePasswordPayload {
  CurrentPassword: string;
  NewPassword: string;
}

// ─── TYPES: RESPONSES ─────────────────────────────────────────────────────────

/**
 * Phản hồi sau khi đăng nhập thành công.
 * Backend trả về: { Token: "..." }
 */
export interface LoginResponse {
  Token: string;
}

/**
 * Thông tin người dùng trả về từ API.
 * Khớp với UserDto.cs: { user_id, user_name, email, role, sex, current_balance, FavoriteBooks, PurchasedBooks }
 */
export interface UserDto {
  user_id: string;            // Guid → string
  user_name: string;
  full_name?: string;
  email?: string;
  role: string;               // "User" | "Admin"
  sex?: string;               
  current_balance?: number;   // decimal
  favoriteBooks?: BookEntity[];
  purchasedBooks?: BookEntity[];
}

// ─── SERVICE ──────────────────────────────────────────────────────────────────

export const userService = {
  /**
   * Đăng nhập người dùng.
   * POST /api/users/login  → { Token: "Bearer JWT..." }
   * Tự động lưu token vào localStorage để interceptor tự gắn vào mọi request.
   */
  login: async (payload: LoginPayload): Promise<LoginResponse> => {
    const response = await axiosClient.post<LoginResponse>(
      ENDPOINTS.USERS.LOGIN,
      payload
    );
    const tokenStr = response.data.Token || (response.data as any).token;
    if (tokenStr) {
      localStorage.setItem('accessToken', tokenStr);
    }
    return response.data;
  },

  /**
   * Đăng ký tài khoản mới.
   * POST /api/users/register → trả về UserDto
   */
  register: async (payload: RegisterPayload): Promise<UserDto> => {
    const response = await axiosClient.post<UserDto>(
      ENDPOINTS.USERS.REGISTER,
      payload
    );
    return response.data;
  },

  /**
   * Lấy thông tin người dùng theo ID.
   * GET /api/users/:user_id  (Authorize)
   * Yêu cầu đã đăng nhập — Bearer Token tự động được gắn bởi interceptor.
   */
  getUserById: async (userId: string): Promise<UserDto> => {
    const response = await axiosClient.get<UserDto>(
      ENDPOINTS.USERS.GET_BY_ID(userId)
    );
    return response.data;
  },
  /**
   * Lấy danh sách sách đã mua của người dùng
   * GET /api/users/{user_id}/books
   */
  getPurchasedBooks: async (userId: string): Promise<BookEntity[]> => {
    const response = await axiosClient.get<BookEntity[]>(`/api/users/${userId}/books`);
    return response.data;
  },

  /**
   * Lấy danh sách wishlist (sách yêu thích) của người dùng hiện tại
   * GET /api/wishlist
   */
  getWishlist: async (): Promise<BookEntity[]> => {
    const response = await axiosClient.get<BookEntity[]>('/api/wishlist');
    return response.data;
  },

  /**
   * Cập nhật thông tin người dùng.
   * PUT /api/users/:user_id  (Authorize, chỉ owner/admin)
   */
  updateUser: async (userId: string, payload: UpdateUserPayload): Promise<UserDto> => {
    const response = await axiosClient.put<UserDto>(
      ENDPOINTS.USERS.UPDATE(userId),
      payload
    );
    return response.data;
  },

  /**
   * Đổi mật khẩu.
   * PUT /api/users/:user_id/change-password  (Authorize, chỉ owner/admin)
   */
  changePassword: async (userId: string, payload: ChangePasswordPayload): Promise<void> => {
    await axiosClient.put(
      ENDPOINTS.USERS.CHANGE_PASSWORD(userId),
      payload
    );
  },

  /**
   * Thêm sách vào danh sách yêu thích.
   * POST /api/users/:user_id/favorites/:book_id
   */
  addFavorite: async (bookId: string): Promise<void> => {
    await axiosClient.post(ENDPOINTS.USERS.ADD_FAVORITE(bookId));
  },

  /**
   * Xóa sách khỏi danh sách yêu thích.
   * DELETE /api/users/:user_id/favorites/:book_id
   */
  removeFavorite: async (bookId: string): Promise<void> => {
    await axiosClient.delete(ENDPOINTS.USERS.REMOVE_FAVORITE(bookId));
  },

  /**
   * Mua sách (trừ số dư tài khoản).
   * POST /api/users/me/purchase/:book_id  (Authorize)
   */
  purchaseBook: async (bookId: string): Promise<void> => {
    await axiosClient.post(ENDPOINTS.USERS.PURCHASE(bookId));
  },

  /**
   * Đăng xuất — chỉ xóa token khỏi localStorage.
   * Backend không có endpoint logout (stateless JWT).
   */
  logout: (): void => {
    localStorage.removeItem('accessToken');
  },

  /**
   * Lấy user_id từ JWT token đang lưu trong localStorage.
   * Decode payload của JWT mà không cần thư viện ngoài.
   * Trả về null nếu không có token hoặc token không hợp lệ.
   */
  getCurrentUserId: (): string | null => {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      let base64Url = parts[1];
      let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = base64.length % 4;
      if (pad) {
        if (pad === 1) return null;
        base64 += new Array(5 - pad).join('=');
      }
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      const payload = JSON.parse(jsonPayload);
      
      return payload['nameid'] 
          ?? payload['sub'] 
          ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] 
          ?? payload['user_id']
          ?? payload['userId']
          ?? payload['id'] 
          ?? null;
    } catch (e) {
      console.error('Lỗi khi decode JWT:', e);
      return null;
    }
  },

  /**
   * Kiểm tra người dùng hiện tại có đang đăng nhập không.
   */
  isLoggedIn: (): boolean => {
    return !!localStorage.getItem('accessToken');
  },
};
