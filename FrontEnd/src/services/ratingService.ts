import axiosClient from './axiosClient';
import { ENDPOINTS } from './endpoints';

export interface RatingData {
  book_id: string;
  rating: number;
  user_id?: string;
}

export interface AddRatingPayload {
  book_id: string;
  Rating: number; 
}

export const ratingService = {
  /**
   * Thêm hoặc cập nhật đánh giá sao
   * POST /api/ratings
   */
  addRating: async (payload: AddRatingPayload): Promise<void> => {
    await axiosClient.post(ENDPOINTS.RATINGS.ADD, payload);
  },

  /**
   * Lấy chi tiết đánh giá (thường dùng để lấy tổng hợp sao của sách)
   * GET /api/ratings/book/:book_id
   */
  getRatingsByBook: async (bookId: string): Promise<any> => {
    const response = await axiosClient.get(ENDPOINTS.RATINGS.GET_BY_BOOK(bookId));
    return response.data;
  },

  /**
   * Xóa đánh giá sao của người dùng hiện tại cho cuốn sách
   * DELETE /api/ratings/book/:book_id
   */
  deleteRating: async (bookId: string, userId: string): Promise<void> => {
    await axiosClient.delete(ENDPOINTS.RATINGS.DELETE(bookId, userId));
  }
};