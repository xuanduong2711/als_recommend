import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Book } from '../data/books';
import { bookService } from '../../services/bookService';

interface BookContextType {
  books: Book[];
  heroBooks: Book[];
  featuredBooks: Book[];
  popularBooks: Book[]; // 1. THÊM STATE ĐỂ LƯU SÁCH HOT NHẤT MỌI THỜI ĐẠI
  recommendedBooks: Book[]; 
  isLoading: boolean;
  error: Error | null;
  refreshBooks: () => Promise<void>;
}

const BookContext = createContext<BookContextType | undefined>(undefined);

// ─── DANH SÁCH CÁC THẺ (TAGS) CẦN BỊ ĐẨY XUỐNG CUỐI ───────────────────────────
const junkTags = [
  'to-read', 'currently-reading', 'favorites', 'favourites', 'owned', 'books-i-own', 'owned-books',
  'my-books', 'my-library', 'kindle', 'audiobook', 'audiobooks', 'audio', 'audio-books', 'ebook', 'ebooks', 
  'default', 'library', 'read-in-2012', 'read-in-2013', 'read-in-2014', 'read-in-2015', 'read-in-2016', 'read-in-2017',
  '1001-books', '1001', '1001-import', 'to-buy', 'book-club', 'school', 'read-for-school', 'for-school',
  'all-time-favorites', 'favorite', 'favorite-books', 'favorite-series', 'dnf', 'did-not-finish', 'abandoned',
  'wish-list', 'rory-gilmore-reading-challenge', 'rory-gilmore-challenge', 'first-reads', 'netgalley', 'pdf'
];

// ─── HÀM XỬ LÝ VÀ SẮP XẾP THỂ LOẠI ───────────────────────────────────────────
const processGenres = (rawGenres: any): string[] => {
  if (!rawGenres) return [];
  
  let tagsArray: string[] = [];
  if (Array.isArray(rawGenres)) {
    tagsArray = rawGenres.flatMap(g => 
      typeof g === 'string' ? g.replace(/[\[\]'"]/g, '').split(',').map(t => t.trim()) : g
    );
  } else if (typeof rawGenres === 'string') {
    tagsArray = rawGenres.replace(/[\[\]'"]/g, '').split(',').map(t => t.trim());
  }

  tagsArray = tagsArray.filter(t => t.length > 0);
  tagsArray = Array.from(new Set(tagsArray));

  return tagsArray.sort((a, b) => {
    const aIsJunk = junkTags.includes(a.toLowerCase());
    const bIsJunk = junkTags.includes(b.toLowerCase());
    if (aIsJunk && !bIsJunk) return 1;  
    if (!aIsJunk && bIsJunk) return -1; 
    return 0; 
  });
};

// ─── HÀM CHUẨN HÓA SÁCH ───────────────────────────────────────────────────────
const normalizeBook = (apiBook: any): Book => {
  const safeId = apiBook.book_id || apiBook.id;
  const extractedBadges = apiBook.badges || apiBook.Badges || [];
  return {
    ...apiBook,
    id: safeId,
    book_id: safeId,
    title: apiBook.title || apiBook.original_title || 'Chưa cập nhật',
    cover: apiBook.cover || apiBook.image_url || apiBook.small_image_url || '',
    author: apiBook.author || apiBook.authors || 'Đang cập nhật',
    genres: processGenres(apiBook.genres || apiBook.tags),
    releaseYear: apiBook.releaseYear || apiBook.original_publication_year || new Date().getFullYear(),
    price: apiBook.price || 50000,
    rating: apiBook.rating || 4.5,
    ratingCount: apiBook.ratingCount || 0,
    popularity: apiBook.popularity || Math.floor(Math.random() * 100),
    badges: extractedBadges,
  } as Book;
};

export const BookProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [heroBooks, setHeroBooks] = useState<Book[]>([]);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]); // Khởi tạo state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBooks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 2. GỌI THÊM API THỨ 4: LẤY 6 CUỐN SÁCH HOT NHẤT (POPULARITY)
      const [generalRes, heroRes, featuredRes, popularRes] = await Promise.all([
        bookService.getBooks({ PageNumber: 1, PageSize: 500 }),
        bookService.getBooks({ PageNumber: 1, PageSize: 5, SortBy: 'trending_7d', SortOrder: 'desc' }),
        bookService.getBooks({ PageNumber: 1, PageSize: 10, SortBy: 'trending_30d', SortOrder: 'desc' }),
        bookService.getBooks({ PageNumber: 1, PageSize: 6, SortBy: 'popularity', SortOrder: 'desc' }) 
      ]);

      if (generalRes?.items) setBooks(generalRes.items.map(normalizeBook));

      let currentHeroBooks: Book[] = [];
      if (heroRes?.items) {
        currentHeroBooks = heroRes.items.map(normalizeBook);
        setHeroBooks(currentHeroBooks);
      }

      if (featuredRes?.items) {
        const rawFeatured = featuredRes.items.map(normalizeBook);
        const uniqueFeatured = rawFeatured
          .filter(fb => !currentHeroBooks.some(hb => hb.id === fb.id))
          .slice(0, 5);
        setFeaturedBooks(uniqueFeatured);
      }

      // Xử lý dữ liệu sách Hot nhất mọi thời đại
      if (popularRes?.items) {
        setPopularBooks(popularRes.items.map(normalizeBook));
      }

    } catch (err) {
      console.error('Lỗi khi tải sách:', err);
      setError(err instanceof Error ? err : new Error('Unknown error fetching books'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  return (
    // 3. Truyền popularBooks vào Context
    <BookContext.Provider value={{ books, heroBooks, featuredBooks, popularBooks, recommendedBooks: featuredBooks, isLoading, error, refreshBooks: fetchBooks }}>
      {children}
    </BookContext.Provider>
  );
};

export const useBooks = (): BookContextType => {
  const context = useContext(BookContext);
  if (context === undefined) throw new Error('useBooks must be used within a BookProvider');
  return context;
};

// ─── LOGIC CHIA BÀI CHO GIAO DIỆN ───────────────────────────────────────────────
export const useBookCollections = () => {
  // 4. Lấy popularBooks ra từ Context
  const { books, heroBooks, featuredBooks, popularBooks } = useBooks();

  const genreDictionary = {
    fantasy: ['fantasy', 'magic', 'witches', 'vampires', 'vampire', 'paranormal', 'urban-fantasy', 'dragons', 'epic-fantasy', 'high-fantasy', 'mythology', 'fairy-tales', 'supernatural', 'werewolves', 'shifters', 'angels', 'demons', 'paranormal-romance'],
    sciFi: ['sci-fi', 'science-fiction', 'scifi', 'dystopian', 'dystopia', 'cyberpunk', 'space-opera', 'steampunk', 'post-apocalyptic', 'aliens', 'time-travel', 'sf'],
    classics: ['classics', 'classic', 'literature', '19th-century', '1001-books', 'clàssics'],
    mystery: ['mystery', 'thriller', 'crime', 'suspense', 'detective', 'mystery-thriller', 'noir', 'espionage', 'spy', 'mysteries'],
    romance: ['romance', 'contemporary-romance', 'historical-romance', 'chick-lit', 'chicklit', 'new-adult', 'erotica', 'love', 'romantic-suspense']
  };

  const matchesGenre = (rawGenres: string[], targetTags: string[]) => {
    if (!rawGenres || rawGenres.length === 0) return false;
    const cleanedTags = rawGenres.flatMap(genreString => 
      genreString.replace(/[\[\]'"]/g, '').split(',').map(t => t.trim().toLowerCase())
    );
    return cleanedTags.some(tag => targetTags.includes(tag));
  };

  const fantasyBooks = books.filter(b => matchesGenre(b.genres, genreDictionary.fantasy)).slice(0, 20);
  const sciFiBooks = books.filter(b => matchesGenre(b.genres, genreDictionary.sciFi)).slice(0, 20);
  const classicsBooks = books.filter(b => matchesGenre(b.genres, genreDictionary.classics)).slice(0, 20);
  const mysteryBooks = books.filter(b => matchesGenre(b.genres, genreDictionary.mystery)).slice(0, 20);
  const romanceBooks = books.filter(b => matchesGenre(b.genres, genreDictionary.romance)).slice(0, 20);
  
  // 5. ĐÃ SỬA: Đổi tên biến popularBooks thành trendingBooks để KHÔNG làm vỡ component TrendingSection.tsx của bạn
  const trendingBooks = popularBooks;

  const featuredBook = featuredBooks.length > 0 ? featuredBooks[0] : (books[0] || null);
  const mosaicBooks = featuredBooks.slice(1, 5);
  
  return { 
    fantasyBooks, sciFiBooks, classicsBooks, mysteryBooks, romanceBooks, 
    trendingBooks, featuredBook, mosaicBooks, heroBooks 
  };
};