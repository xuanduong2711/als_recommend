import axiosClient from './axiosClient';
import { ENDPOINTS } from './endpoints';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ReviewData {
  id: string;
  user_id: string;
  book_id: string;
  full_name?: string;     // Bổ sung để hiển thị tên người dùng
  is_purchased?: boolean; // Bổ sung để hiển thị nhãn "Đã mua"
  review: string;
  time: string;
}

export interface AddReviewPayload {
  book_id: string;
  Review: string; // Viết hoa chữ R theo đúng payload Backend yêu cầu trong endpoints.ts
}

// ─── SERVICE ─────────────────────────────────────────────────────────────────

export const reviewService = {
  /**
   * Lấy danh sách đánh giá của một cuốn sách (Có phân trang)
   * GET /api/reviews/book/:book_id?pageNumber=1&pageSize=10
   */
  getReviewsByBook: async (
    bookId: string, 
    pageNumber: number = 1, 
    pageSize: number = 10
  ): Promise<ReviewData[]> => {
    const response = await axiosClient.get<ReviewData[]>(
      ENDPOINTS.REVIEWS.GET_BY_BOOK(bookId),
      {
        params: {
          pageNumber,
          pageSize
        }
      }
    );
    return response.data;
  },

  /**
   * Thêm đánh giá mới
   * POST /api/reviews
   */
  addReview: async (payload: AddReviewPayload): Promise<ReviewData> => {
    const response = await axiosClient.post<ReviewData>(
      ENDPOINTS.REVIEWS.ADD,
      payload
    );
    return response.data;
  },

  /**
   * Xóa đánh giá (Chỉ owner hoặc admin)
   * DELETE /api/reviews/:review_id
   */
  deleteReview: async (reviewId: string): Promise<void> => {
    await axiosClient.delete(ENDPOINTS.REVIEWS.DELETE(reviewId));
  }
};