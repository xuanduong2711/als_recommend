// ─── TYPES ────────────────────────────────────────────────────────────────────

/** Kiểu dữ liệu sách dùng trong toàn bộ UI ứng dụng */
export interface Book {
  id: string | number;
  title: string;
  author: string;
  price: number;
  originalPrice?: number;
  rating: number;
  ratingCount: number;
  ratingBreakdown?: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  genres: string[];
  badges?: string[];
  cover: string;
  description: string;
  longDescription: string;
  pages: number;
  releaseYear: number;
  readTime: string;
  mood: string[];
  popularity: number;
  accentColor: string;
  language?: string;
  status?: 'complete' | 'ongoing';
  chapters?: number;
  previewText?: string;
  views_7d?: number;
  favorite_7d?: number;
  purchases_7d?: number;
  views_30d?: number;
  favorite_30d?: number;
  purchases_30d?: number;
}

// ─── UI CONFIG: GENRES & MOODS ───────────────────────────────────────────────

/** Danh sách thể loại hiển thị trên UI (dùng cho filter, badge, v.v.) */
export const GENRES = ['fantasy', 'science-fiction', 'romance', 'self-help', 'mystery', 'biography', 'philosophy'];

/** Cấu hình tâm trạng: id, nhãn tiếng Việt, emoji và màu Tailwind */
export const MOODS = [
  { id: 'adventurous', label: 'Phiêu lưu', emoji: '🗺️', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'curious', label: 'Tò mò', emoji: '🔮', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'romantic', label: 'Lãng mạn', emoji: '🌸', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  { id: 'focused', label: 'Tập trung', emoji: '⚡', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'relaxed', label: 'Thư giãn', emoji: '🌿', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
];

/**
 * Dữ liệu sách hardcoded đã được xóa hoàn toàn.
 * Toàn bộ dữ liệu sách được lấy động từ API thông qua:
 *   - bookService.getBooks()           → danh sách có phân trang + lọc
 *   - bookService.getBookById()         → chi tiết một cuốn sách
 *   - bookService.getRecommendations()  → gợi ý AI
 *
 * Xem: src/services/bookService.ts
 * Xem: src/app/hooks/useBooks.tsx (BookProvider + useBooks + useBookCollections)
 *
 * Các derived exports cũ (heroBooks, fantasyBooks, trendingBooks, v.v.)
 * đã được thay thế bằng useBookCollections() hook.
 */

// ─── UI CONFIG: GENRE COLORS ─────────────────────────────────────────────────

/** Màu badge thể loại hiển thị trên BookCard và các component khác */
export const genreColors: Record<string, string> = {
  fantasy: 'bg-violet-100 text-violet-700',
  'science-fition': 'bg-cyan-100 text-cyan-700',
  romance: 'bg-rose-100 text-rose-700',
  classics: 'bg-stone-100 text-stone-700',
  mystery: 'bg-slate-100 text-slate-700',
  biography: 'bg-red-100 text-red-700',
  philosophy: 'bg-yellow-100 text-yellow-700',
  historical: 'bg-amber-100 text-amber-700',
  adventure: 'bg-orange-100 text-orange-700',
  tech: 'bg-blue-100 text-blue-700',
  history: 'bg-amber-100 text-amber-700',
};

// ─── UI CONFIG: BADGE COLORS ─────────────────────────────────────────────────

/** Màu badge đặc biệt (Bestseller, New, v.v.) */
export const badgeColors: Record<string, string> = {
  "Best Seller": 'bg-amber-400 text-amber-900',
  New: 'bg-emerald-400 text-emerald-900',
  "Editor's Choice": 'bg-violet-400 text-violet-900',
  Original: 'bg-rose-400 text-rose-900',
  Trending: 'bg-sky-400 text-sky-900',
};

// ─── UI CONFIG: GENRE INFO ───────────────────────────────────────────────────

/** Thông tin chi tiết từng thể loại: gradient, màu, emoji, subgenres, mood tags */
export const genreInfo: Record<string, {
  description: string;
  bgGradient: string;
  heroGradient: string;
  accentColor: string;
  darkAccent: string;
  emoji: string;
  subgenres: string[];
  moodTags: string[];
}> = {
  fantasy: {
    description: 'Thế giới phép thuật, sinh vật huyền bí và những cuộc phiêu lưu vĩ đại chưa có hồi kết',
    bgGradient: 'from-violet-100 via-indigo-50 to-[#F8F7F4] dark:from-violet-950/40 dark:via-indigo-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-violet-600/30 via-indigo-600/20 to-transparent',
    accentColor: '#7C3AED',
    darkAccent: '#A78BFA',
    emoji: '🧙‍♂️',
    subgenres: ['Dark Fantasy', 'Magic Academy', 'Epic Fantasy', 'Isekai', 'Urban Fantasy', 'Fairy Tale Retelling'],
    moodTags: ['Phiêu lưu', 'Huyền bí', 'Sử thi', 'Ma thuật', 'Thần thoại'],
  },
  'science-fiction': {
    description: 'Khoa học viễn tưởng, tương lai xa xôi và những câu hỏi lớn về bản chất con người',
    bgGradient: 'from-cyan-100 via-sky-50 to-[#F8F7F4] dark:from-cyan-950/40 dark:via-sky-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-cyan-600/30 via-blue-600/20 to-transparent',
    accentColor: '#0EA5E9',
    darkAccent: '#38BDF8',
    emoji: '🚀',
    subgenres: ['Dystopia', 'Space Opera', 'Cyberpunk', 'Hard Sci-Fi', 'Time Travel', 'AI & Robots'],
    moodTags: ['Tương lai', 'Khoa học', 'Triết lý', 'Phiêu lưu', 'Bí ẩn'],
  },
  romance: {
    description: 'Tình yêu đích thực, những khoảnh khắc lãng mạn và cảm xúc chạm đến tận cùng trái tim',
    bgGradient: 'from-rose-100 via-pink-50 to-[#F8F7F4] dark:from-rose-950/40 dark:via-pink-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-rose-500/30 via-pink-500/20 to-transparent',
    accentColor: '#EC4899',
    darkAccent: '#F472B6',
    emoji: '🌸',
    subgenres: ['Contemporary', 'Historical Romance', 'Fantasy Romance', 'Slow Burn', 'Found Family', 'Sweet Romance'],
    moodTags: ['Lãng mạn', 'Cảm xúc', 'Ngọt ngào', 'Xúc động', 'Hy vọng'],
  },
  classics: {
    description: 'Những tác phẩm kinh điển vượt thời gian, định hình văn học và văn hóa nhân loại',
    bgGradient: 'from-stone-100 via-gray-50 to-[#F8F7F4] dark:from-stone-950/40 dark:via-gray-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-stone-600/30 via-gray-600/20 to-transparent',
    accentColor: '#57534E',
    darkAccent: '#A8A29E',
    emoji: '🏛️',
    subgenres: ['Classic Literature', 'Modern Classics', 'Gothic', 'Victorian', 'Renaissance', 'Ancient Texts'],
    moodTags: ['Sâu sắc', 'Suy ngẫm', 'Vượt thời gian', 'Lịch sử', 'Nghệ thuật'],
  },
  mystery: {
    description: 'Bí ẩn chưa được giải đáp, những manh mối ẩn giấu và sự thật bất ngờ luôn chực chờ',
    bgGradient: 'from-slate-100 via-gray-50 to-[#F8F7F4] dark:from-slate-950/40 dark:via-gray-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-violet-600/30 via-slate-600/20 to-transparent',
    accentColor: '#8B5CF6',
    darkAccent: '#A78BFA',
    emoji: '🔍',
    subgenres: ['Crime Thriller', 'Detective', 'Cozy Mystery', 'Psychological Thriller', 'Nordic Noir', 'Whodunit'],
    moodTags: ['Hồi hộp', 'Bí ẩn', 'Tò mò', 'Căng thẳng', 'Bất ngờ'],
  },
  biography: {
    description: 'Cuộc đời thật của những con người phi thường đã thay đổi lịch sử bằng ý chí và đam mê',
    bgGradient: 'from-amber-100 via-orange-50 to-[#F8F7F4] dark:from-amber-950/40 dark:via-orange-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-amber-600/30 via-orange-500/20 to-transparent',
    accentColor: '#D97706',
    darkAccent: '#FCD34D',
    emoji: '📖',
    subgenres: ['Memoir', 'Autobiography', 'Political Biography', 'Sports', 'Business Leaders', 'Artists & Creatives'],
    moodTags: ['Cảm hứng', 'Kiên trì', 'Khám phá', 'Chân thực', 'Truyền cảm hứng'],
  },
  philosophy: {
    description: 'Những câu hỏi lớn về ý nghĩa cuộc sống, đạo đức và bản chất sâu xa của con người',
    bgGradient: 'from-yellow-100 via-amber-50 to-[#F8F7F4] dark:from-yellow-950/40 dark:via-amber-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-yellow-600/30 via-amber-500/20 to-transparent',
    accentColor: '#CA8A04',
    darkAccent: '#FDE047',
    emoji: '💡',
    subgenres: ['Stoicism', 'Existentialism', 'Eastern Philosophy', 'Ethics', 'Political Philosophy', 'Metaphysics'],
    moodTags: ['Suy ngẫm', 'Tò mò', 'Thư giãn', 'Triết học', 'Trầm lắng'],
  },
  historical: {
    description: 'Những câu chuyện từ quá khứ hào hùng, sử thi vĩ đại và bí mật của lịch sử',
    bgGradient: 'from-amber-100 via-stone-50 to-[#F8F7F4] dark:from-amber-950/40 dark:via-stone-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-amber-700/30 via-stone-600/20 to-transparent',
    accentColor: '#D97706',
    darkAccent: '#F59E0B',
    emoji: '⚔️',
    subgenres: ['Ancient History', 'Medieval', 'World Wars', 'Empire & Conquest', 'Cultural History', 'Modern History'],
    moodTags: ['Sử thi', 'Hào hùng', 'Khám phá', 'Chân thực', 'Phiêu lưu'],
  },
  adventure: {
    description: 'Những cuộc phiêu lưu kỳ thú, thách thức giới hạn bản thân và khám phá thế giới',
    bgGradient: 'from-orange-100 via-amber-50 to-[#F8F7F4] dark:from-orange-950/40 dark:via-amber-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-orange-600/30 via-green-600/20 to-transparent',
    accentColor: '#059669',
    darkAccent: '#34D399',
    emoji: '🏔️',
    subgenres: ['Survival', 'Exploration', 'Mountain Climbing', 'Ocean Adventure', 'Wildlife', 'Travel Writing'],
    moodTags: ['Phiêu lưu', 'Hồi hộp', 'Kỳ diệu', 'Mạo hiểm', 'Cảm hứng'],
  },
  tech: {
    description: 'Công nghệ tiên tiến, AI và tương lai của ngành kỹ thuật số đang định hình thế giới',
    bgGradient: 'from-blue-100 via-sky-50 to-[#F8F7F4] dark:from-blue-950/40 dark:via-sky-950/20 dark:to-[#0D0C14]',
    heroGradient: 'from-blue-600/30 via-cyan-600/20 to-transparent',
    accentColor: '#0284C7',
    darkAccent: '#38BDF8',
    emoji: '💻',
    subgenres: ['Programming', 'AI & Machine Learning', 'Cybersecurity', 'System Design', 'Startup & Innovation', 'Data Science'],
    moodTags: ['Tập trung', 'Học hỏi', 'Kỹ thuật', 'Sáng tạo', 'Tương lai'],
  },
};

// ─── STATIC UI DATA: REVIEWS ─────────────────────────────────────────────────

/** Review mẫu hiển thị trên trang chủ (không cần API) */
export const reviews = [
  { id: 1, user: 'Minh Tuấn', avatar: 'MT', rating: 5, text: 'Một trong những cuốn sách hay nhất tôi từng đọc. Văn phong cuốn hút, nhân vật sâu sắc và cốt truyện bất ngờ đến từng trang.', date: '15 tháng 4, 2025' },
  { id: 2, user: 'Phương Linh', avatar: 'PL', rating: 5, text: 'Tôi đọc một hơi xong tập này. Không thể dừng lại được! Tác giả có khả năng xây dựng thế giới tuyệt vời.', date: '2 tháng 4, 2025' },
  { id: 3, user: 'Đức Anh', avatar: 'ĐA', rating: 4, text: 'Cốt truyện hấp dẫn, nhưng phần giữa hơi chậm. Tổng thể vẫn rất đáng đọc!', date: '28 tháng 3, 2025' },
];

/** Review chi tiết hiển thị trong trang BookDetail */
export const extendedReviews = [
  { id: 1, bookId: 0, user: 'Minh Tuấn', avatar: 'MT', rating: 5, text: 'Một trong những cuốn sách hay nhất tôi từng đọc. Văn phong cuốn hút, nhân vật sâu sắc và cốt truyện bất ngờ đến từng trang.', date: '15 tháng 4, 2025', helpful: 124 },
  { id: 2, bookId: 0, user: 'Phương Linh', avatar: 'PL', rating: 5, text: 'Tôi đọc một hơi xong tập này. Không thể dừng lại được! Tác giả có khả năng xây dựng thế giới tuyệt vời.', date: '2 tháng 4, 2025', helpful: 98 },
  { id: 3, bookId: 0, user: 'Đức Anh', avatar: 'ĐA', rating: 4, text: 'Cốt truyện hấp dẫn, nhưng phần giữa hơi chậm. Tổng thể vẫn rất đáng đọc!', date: '28 tháng 3, 2025', helpful: 45 },
  { id: 4, bookId: 0, user: 'Thu Hằng', avatar: 'TH', rating: 5, text: 'Thế giới quan được xây dựng công phu đến mức tôi cảm giác đang thực sự ở trong đó. Mỗi chi tiết đều có ý nghĩa.', date: '10 tháng 3, 2025', helpful: 87 },
  { id: 5, bookId: 0, user: 'Văn Long', avatar: 'VL', rating: 4, text: 'Nhân vật chính phát triển rất thuyết phục. Kết thúc bất ngờ và cảm xúc, đúng kiểu sách tôi yêu thích.', date: '5 tháng 3, 2025', helpful: 62 },
  { id: 6, bookId: 0, user: 'Hồng Nhung', avatar: 'HN', rating: 3, text: 'Phần đầu rất hay, nhưng tôi kỳ vọng nhiều hơn từ phần kết. Vẫn đáng đọc cho những ai yêu thể loại này.', date: '20 tháng 2, 2025', helpful: 31 },
];

/** Quote cộng đồng hiển thị trên trang chủ */
export const communityQuotes = [
  { id: 1, bookId: 1, quote: 'Cuốn sách này thay đổi cách tôi nhìn nhận về sức mạnh nội tâm. Lyra là nhân vật mà tôi sẽ không bao giờ quên.', user: 'Ngọc Ánh', reactions: 234 },
  { id: 2, bookId: 4, quote: 'Sau khi đọc The Clarity Code, năng suất làm việc của tôi tăng 40%. Không phải cường điệu — đây là sự thật.', user: 'Hoàng Nam', reactions: 412 },
  { id: 3, bookId: 12, quote: "Câu chuyện của Lin Mei khiến tôi khóc và cười trong cùng một chương. Định nghĩa lại ý nghĩa của từ 'kiên trì'.", user: 'Bảo Châu', reactions: 318 },
  { id: 4, bookId: 13, quote: 'The Library at World\'s End là cuốn sách duy nhất tôi đọc ba lần liên tiếp mà không cảm thấy chán.', user: 'Minh Khoa', reactions: 287 },
];
