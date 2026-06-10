import axiosClient from './axiosClient';
import { userService } from './userService';

// Nếu bạn chưa cấu hình ENDPOINTS.TRACKING.LOG_EVENT trong file endpoints.ts, 
// thì có thể dùng chuỗi cứng '/api/tracking' ở đây.
const TRACKING_ENDPOINT = '/api/tracking'; 

export type EventType = 'popup_view' | 'detail_view';

export const trackingService = {
  /**
   * Gửi sự kiện tracking (chỉ gửi khi người dùng đã đăng nhập).
   * Không ném lỗi ra ngoài (fail-safe) để tránh làm gián đoạn trải nghiệm người dùng nếu API tracking bị lỗi.
   */
  logEvent: async (bookId: string, eventType: EventType): Promise<void> => {
    try {
      // Chỉ track người dùng đã đăng nhập (userService quản lý token)
      if (!userService.isLoggedIn()) return;

      if (!bookId) {
        console.warn('[Tracking] Bỏ qua gửi log vì bookId không hợp lệ.');
        return;
      }

      await axiosClient.post(TRACKING_ENDPOINT, {
        event_type: eventType,
        book_id: bookId
      });
      
    } catch (error) {
      // Chỉ log lỗi ngầm ở console, không hiển thị cho người dùng
      console.warn(`[Tracking] Lỗi gửi sự kiện ${eventType}:`, error);
    }
  }
};