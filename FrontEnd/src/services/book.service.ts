/**
 * File này giữ lại để tương thích ngược (backward compatibility).
 * Logic thực tế đã được chuyển sang kiến trúc Service Pattern mới:
 *   - src/services/axiosClient.ts  → Axios instance với interceptors
 *   - src/services/endpoints.ts    → Tất cả API endpoints
 *   - src/services/bookService.ts  → Book service (axiosClient + endpoints)
 *   - src/services/userService.ts  → User service (axiosClient + endpoints)
 *
 * Re-export để các component cũ import từ đây vẫn hoạt động bình thường.
 */
export type { BookEntity, PagedList, BookFilterParams } from './bookService';
export { bookService as BookService } from './bookService';
