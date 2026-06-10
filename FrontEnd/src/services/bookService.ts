import axios from 'axios';
import axiosClient from './axiosClient';
import { ENDPOINTS } from './endpoints';
import type { Book } from '../app/data/books';

// ─── TYPES: BACKEND RESPONSE ──────────────────────────────────────────────────

/**
 * Kiểu dữ liệu thô trả về từ Backend.
 * Khớp 1-1 với BookEntity.cs trong Backend/Core/Entities/BookEntity.cs
 *
 * Lưu ý:
 * - book_id là Guid (string trong JSON)
 * - mood là string phân cách bởi dấu phẩy (ví dụ: "adventurous,curious")
 * - readTime là số nguyên (số phút), frontend tự format thành "X tiếng"
 * - price đã đổi từ "cost" → "price" theo Backend mới nhất
 */
export interface BookEntity {
  book_id: string;                      // Guid → string
  authors: string;
  original_title: string;
  language_code: string;
  original_publication_year?: number;   // nullable double
  tags: string[];                       // List<string>
  ratings_1: number;
  ratings_2: number;
  ratings_3: number;
  ratings_4: number;
  ratings_5: number;
  image_url: string;
  small_image_url: string;
  price: number;                        // decimal (đổi từ cost → price)
  // Các trường mới có sẵn từ Backend — ánh xạ trực tiếp, không cần sinh giả
  mood?: string;                        // "adventurous,curious" (comma-separated)
  badges?: string[];                    // ĐÃ SỬA: Đổi thành mảng string[] cho khớp API
  description?: string;
  longDescription?: string;
  pages: number;
  readTime: number;                     // số phút đọc (int)
  status?: string;                      // "complete" | "ongoing"
  chapters: number;
  previewText?: string;
  accentColor?: string;
}

/**
 * Kiểu trả về từ Backend.
 * Axios nhận về: { items }
 */
export interface PagedList<T> {
  items: T[];
}

/**
 * Tham số lọc danh sách sách.
 * - PaginationParams: PageNumber, PageSize (tách riêng trong backend)
 * - BookFilterParams: SearchTerm, Title, Author, Genre, SortBy, SortOrder, MinRating, MaxRating, MinYear, MaxYear
 * Tất cả gộp vào một object để tiện gọi API.
 */
export interface BookFilterParams {
  // PaginationParams (Backend/Core/Models/PaginationParams.cs)
  PageNumber?: number;
  PageSize?: number;
  // BookFilterParams (Backend/Core/Models/BookFilterParams.cs)
  SearchTerm?: string;
  Title?: string;
  Author?: string;
  Genre?: string;
  Badges?: string; // Đổi từ Badge → Badges để khớp API mới (phân cách bởi dấu phẩy)
  SortBy?: string;
  SortOrder?: string;
  MinRating?: number;
  MaxRating?: number;
  MinYear?: number;
  MaxYear?: number;
}

// ─── MAPPER: BookEntity → Book (UI) ──────────────────────────────────────────

/**
 * Tạo hash số từ chuỗi để sinh fallback xác định (deterministic).
 * Dùng khi một số trường Backend là null/empty.
 */
const hashStr = (str: string): number => {
  if (!str) return 0;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h);
};

// Fallback constants dùng khi Backend chưa có dữ liệu
const FALLBACK_GENRES = ['fantasy', 'science-fiction', 'romance', 'classics', 'mystery', 'biography', 'philosophy', 'historical', 'adventure', 'tech'];
const FALLBACK_MOODS = ['adventurous', 'curious', 'romantic', 'focused', 'relaxed'];
const FALLBACK_BADGES = ['Best Seller', 'New', "Editor's Choice", 'Hot', 'Trending'];
const FALLBACK_COLORS = ['#4F46E5', '#0EA5E9', '#EC4899', '#10B981', '#8B5CF6', '#D97706', '#059669', '#6366F1', '#CA8A04', '#DB2777'];

/**
 * Chuyển đổi BookEntity (JSON từ API) → Book (kiểu UI).
 * Ưu tiên dùng dữ liệu thực từ Backend, chỉ fallback khi trường là null/empty.
 */
// Từ điển ánh xạ mã ngôn ngữ sang tên hiển thị
const LANGUAGE_MAP: Record<string, string> = {
  'vie': 'Tiếng Việt',
  'eng': 'English',
  'en-US': 'English (US)',
  'en-CA': 'English (Canada)',
  'en-GB': 'English (UK)',
  'en': 'English',
  'spa': 'Tiếng Tây Ban Nha',
  'fre': 'Tiếng Pháp',
  'nl': 'Tiếng Hà Lan',
  'ara': 'Tiếng Ả Rập',
  'por': 'Tiếng Bồ Đào Nha',
  'ger': 'Tiếng Đức',
  'nor': 'Tiếng Na Uy',
  'jpn': 'Tiếng Nhật',
  'ind': 'Tiếng Indonesia',
  'pol': 'Tiếng Ba Lan',
  'tur': 'Tiếng Thổ Nhĩ Kỳ',
  'dan': 'Tiếng Đan Mạch',
  'fil': 'Tiếng Philippines',
  'ita': 'Tiếng Ý',
  'per': 'Tiếng Ba Tư',
  'swe': 'Tiếng Thụy Điển',
  'rum': 'Tiếng Romania',
  'mul': 'Đa ngôn ngữ',
  'rus': 'Tiếng Nga'
};
export const mapToBook = (entity: BookEntity): Book => {
  // Tính rating trung bình có trọng số từ ratings_1..5
  const totalRatings = entity.ratings_1 + entity.ratings_2 + entity.ratings_3 + entity.ratings_4 + entity.ratings_5;
  const weightedSum = entity.ratings_1 * 1 + entity.ratings_2 * 2 + entity.ratings_3 * 3 + entity.ratings_4 * 4 + entity.ratings_5 * 5;
  const averageRating = totalRatings > 0 ? Number((weightedSum / totalRatings).toFixed(1)) : 0;

  const h = hashStr(entity.original_title);

  // ── Genres: ưu tiên tags từ Backend, fallback hash
  let genres = entity.tags?.length > 0 
    ? entity.tags.map(t => t.toLowerCase())
    : [FALLBACK_GENRES[h % FALLBACK_GENRES.length]];

  // ── Mood: Backend trả về chuỗi "adventurous,curious" → split thành mảng
  let mood: string[];
  if (entity.mood && entity.mood.trim()) {
    mood = entity.mood.split(',').map(m => m.trim()).filter(Boolean);
  } else {
    mood = [FALLBACK_MOODS[h % FALLBACK_MOODS.length], FALLBACK_MOODS[(h + 1) % FALLBACK_MOODS.length]];
  }

  // ── Badges: ĐÃ SỬA: Lấy mảng từ Backend, fallback mảng chứa 1 nhãn nếu cần
  let badges: string[] = [];
  if (entity.badges && Array.isArray(entity.badges) && entity.badges.length > 0) {
    badges = entity.badges;
  } else if (h % 3 === 0) {
    badges = [FALLBACK_BADGES[h % FALLBACK_BADGES.length]];
  }

  // ── readTime: Backend lưu số nguyên (phút) → format thành "X tiếng"
  const readTimeDisplay = entity.readTime > 0
    ? (entity.readTime >= 60
      ? `${Math.round(entity.readTime / 60)} tiếng`
      : `${entity.readTime} phút`)
    : `${2 + (h % 6)} tiếng`;

  // ── Popularity: tính từ tổng ratings (chuẩn hóa về 50-100)
  const popularity = Math.min(100, 50 + Math.round((totalRatings / 1000) * 50));

  return {
    id: entity.book_id,
    title: entity.original_title || 'Unknown Title',
    author: entity.authors || 'Unknown Author',
    price: entity.price > 0 ? entity.price : 50000 + (h % 5) * 10000,
    originalPrice: entity.price > 0 ? entity.price * 1.25 : undefined,
    rating: averageRating,
    ratingCount: totalRatings,
    ratingBreakdown: {
      1: entity.ratings_1 || 0,
      2: entity.ratings_2 || 0,
      3: entity.ratings_3 || 0,
      4: entity.ratings_4 || 0,
      5: entity.ratings_5 || 0,
    },
    genres,
    badges,
    cover: entity.image_url,
    description: entity.description
      || `Tác phẩm nổi bật của ${entity.authors || 'tác giả'} trong thể loại ${genres[0] || 'này'}.`,
    longDescription: entity.longDescription
      || `"${entity.original_title}" của ${entity.authors || 'tác giả'} — xuất bản năm ${entity.original_publication_year || 'không rõ'}. Một tác phẩm đáng đọc trong thể loại ${genres[0] || 'này'}.`,
    pages: entity.pages > 0 ? entity.pages : 200 + (h % 300),
    releaseYear: entity.original_publication_year ?? 2020,
    readTime: readTimeDisplay,
    mood,
    popularity,
    accentColor: entity.accentColor || FALLBACK_COLORS[h % FALLBACK_COLORS.length],
    language: entity.language_code 
      ? (LANGUAGE_MAP[entity.language_code] || entity.language_code) 
      : 'Đang cập nhật',
    status: (entity.status === 'complete' || entity.status === 'ongoing')
      ? entity.status
      : (h % 5 === 0 ? 'ongoing' : 'complete'),
    chapters: entity.chapters > 0 ? entity.chapters : 10 + (h % 40),
    previewText: entity.previewText || undefined,
  };
};

// ─── SERVICE ──────────────────────────────────────────────────────────────────

const mlAxiosClient = axios.create({
  baseURL: import.meta.env.VITE_ML_API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const bookService = {
  /**
   * Lấy danh sách sách có phân trang và lọc.
   * Tương ứng: GET /api/books?PageNumber=&PageSize=&SearchTerm=...
   *
   * @example
   * bookService.getBooks({ PageNumber: 1, PageSize: 20, SearchTerm: 'harry', Genre: 'Fantasy' })
   */
  getBooks: async (params: BookFilterParams = {}): Promise<PagedList<Book>> => {
    const queryParams: BookFilterParams = { PageNumber: 1, PageSize: 40, ...params };

    const response = await axiosClient.get<PagedList<BookEntity>>(
      ENDPOINTS.BOOKS.GET_ALL,
      { params: queryParams }
    );

    return {
      ...response.data,
      items: response.data.items.map(mapToBook),
    };
  },

  /**
   * Lấy chi tiết một cuốn sách theo ID (Guid).
   * Tương ứng: GET /api/books/{book_id}
   */
  getBookById: async (bookId: string): Promise<Book> => {
    const response = await axiosClient.get<BookEntity>(
      ENDPOINTS.BOOKS.GET_DETAIL(bookId)
    );
    return mapToBook(response.data);
  },

  /**
   * Lấy danh sách sách gợi ý được lọc từ DB thông qua các feature
   */
  getRecommendations: async (count: number = 8): Promise<Book[]> => {
    const response = await axiosClient.get<BookEntity[]>(
      ENDPOINTS.BOOKS.GET_RECOMMENDATIONS,
      { params: { count } }
    );
    return response.data.map(mapToBook);
  },
  /**
   * Lấy danh sách sách gợi ý được đề xuất bằng ML qua BookID
   */
  getRecommendationsByBookId: async (bookId: string, count: number = 8): Promise<Book[]> => {
    const response = await axiosClient.get<BookEntity[]>(
      ENDPOINTS.BOOKS.GET_RECOMMENDATIONS_BY_BOOKID(bookId), 
      { params: { limit: count } }
    );
    return response.data.map(mapToBook);
  },

  /**
   * Tìm kiếm sách bằng Elasticsearch (Python FastAPI).
   * Tương ứng: GET /recommend/es/search?q=...&limit=...
   */
  searchBooks: async (query: string, limit: number = 50): Promise<Book[]> => {
    const response = await mlAxiosClient<BookEntity[]>(
      '/recommend/es/search',
      { params: { q: query, limit } }
    );
    return (response.data || []).map(mapToBook);
  },
};