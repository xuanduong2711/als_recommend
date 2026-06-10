/**
 * Tập trung toàn bộ API endpoint của ứng dụng vào một object constant duy nhất.
 * Nguyên tắc DRY — không hardcode URL rải rác trong codebase.
 *
 * Tham chiếu Backend:
 *   - BooksControllers.cs   → [Route("api/books")]
 *   - UsersControllers.cs   → [Route("api/users")]
 *   - RatingsController.cs  → [Route("api/ratings")]
 *   - ReviewsController.cs  → [Route("api/reviews")]
 *   - TrackingController.cs → [Route("api/tracking")]
 */
export const ENDPOINTS = {

  // ─── BOOKS ─────────────────────────────────────────────────────────────────
  BOOKS: {
    /** GET /api/books?PageNumber=&PageSize=&SearchTerm=&Genre=...  */
    GET_ALL: '/api/books',

    /** GET /api/books/:book_id  (book_id là Guid) */
    GET_DETAIL: (bookId: string) => `/api/books/${bookId}`,

    /** GET /api/books/recommendations */
    GET_RECOMMENDATIONS: '/api/books/recommendations',

    /** GET /recommend/tfidf/{bookId} */
    GET_RECOMMENDATIONS_BY_BOOKID: (bookId: string) => `/recommend/tfidf/${bookId}`,

    /** POST /api/books  (Admin only) */
    CREATE: '/api/books',

    /** PUT /api/books/:book_id  (Admin only) */
    UPDATE: (bookId: string) => `/api/books/${bookId}`,

    /** DELETE /api/books/:book_id  (Admin only) */
    DELETE: (bookId: string) => `/api/books/${bookId}`,
  },

  // ─── USERS ─────────────────────────────────────────────────────────────────
  USERS: {
    /** POST /api/users/login  — body: { user_name, Password } */
    LOGIN: '/api/users/login',

    /** POST /api/users/register  — body: { user_name, email, Password, sex } */
    REGISTER: '/api/users/register',

    /** GET /api/users/:user_id  (Authorize) */
    GET_BY_ID: (userId: string) => `/api/users/${userId}`,

    /** PUT /api/users/:user_id  (Authorize, owner/admin) */
    UPDATE: (userId: string) => `/api/users/${userId}`,

    /** PUT /api/users/:user_id/change-password */
    CHANGE_PASSWORD: (userId: string) => `/api/users/${userId}/change-password`,

    /** DELETE /api/users/:user_id  (Admin only) */
    DELETE: (userId: string) => `/api/users/${userId}`,

    /** POST /api/wishlist/:bookId?collection_name */
    ADD_FAVORITE: (bookId: string) => `/api/wishlist/${bookId}`,
    
    /** DELETE /api/wishlist/:bookId */
    REMOVE_FAVORITE: (bookId: string) => `/api/wishlist/${bookId}`,

    /** POST /api/users/:user_id/purchase/:book_id */
    PURCHASE: (bookId: string) => `/api/users/me/purchase/${bookId}`,

    /** POST /api/users/admin/top-up  (Admin only) */
    TOP_UP: '/api/users/admin/top-up',
  },

  // ─── RATINGS ───────────────────────────────────────────────────────────────
  RATINGS: {
    /** POST /api/ratings  — body: { book_id, Rating } (Authorize) */
    ADD: '/api/ratings',

    /** GET /api/ratings/book/:book_id */
    GET_BY_BOOK: (bookId: string) => `/api/ratings/book/${bookId}`,

    /** DELETE /api/ratings/book/:book_id?user_id= */
    DELETE: (bookId: string, userId: string) => `/api/ratings/book/${bookId}?user_id=${userId}`,
  },

  // ─── REVIEWS ───────────────────────────────────────────────────────────────
  REVIEWS: {
    /** POST /api/reviews  — body: { book_id, Review } (Authorize) */
    ADD: '/api/reviews',

    /** GET /api/reviews/book/:book_id */
    GET_BY_BOOK: (bookId: string) => `/api/reviews/book/${bookId}`,

    /** DELETE /api/reviews/:review_id  (Authorize, owner/admin) */
    DELETE: (reviewId: string) => `/api/reviews/${reviewId}`,
  },

  // ─── TRACKING ──────────────────────────────────────────────────────────────
  TRACKING: {
    /** POST /api/tracking  — body: { session_id, event_type, book_id } */
    LOG_EVENT: '/api/tracking',
  },

} as const;
