import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useOutletContext } from 'react-router';
import {
  TrendingUp, Flame, BookOpen, ChevronRight, ChevronLeft, Loader2
} from 'lucide-react';
import { bookService } from '../../services/bookService';
import type { Book } from '../data/books';
import { BookCard } from '../components/BookCard';
import type { OutletContextType } from '../components/RootLayout';

// ─── DANH SÁCH THỂ LOẠI ĐƯỢC CHỈ ĐỊNH ───
const TARGET_GENRES = [
  { id: 'fantasy', label: 'Giả tưởng' },
  { id: 'science-fiction', label: 'Viễn tưởng' },
  { id: 'classics', label: 'Kinh điển' },
  { id: 'romance', label: 'Lãng mạn' },
  { id: 'mystery', label: 'Trinh thám' },
  { id: 'adventure', label: 'Phiêu lưu' }
];

const FILTERS = [
  { id: 'trending_7d', label: 'Tuần này' },
  { id: 'trending_30d', label: 'Tháng này' },
  { id: 'popularity', label: 'Mọi thời đại' },
];

function GenreTrendingSlider({ title, books, onViewAll, onOpenBook }: {
  title: string;
  books: Book[];
  onViewAll: () => void;
  onOpenBook: (b: Book) => void;
}) {
  const [startIndex, setStartIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(6);
  const [isVisible, setIsVisible] = useState(false);
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); 
        }
      },
      { rootMargin: '300px' } 
    );
    if (shelfRef.current) observer.observe(shelfRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateCardsToShow = () => {
      if (window.innerWidth >= 1280) setCardsToShow(6);
      else if (window.innerWidth >= 1024) setCardsToShow(5);
      else if (window.innerWidth >= 768) setCardsToShow(4);
      else if (window.innerWidth >= 640) setCardsToShow(3);
      else setCardsToShow(2);
    };
    updateCardsToShow();
    window.addEventListener('resize', updateCardsToShow);
    return () => window.removeEventListener('resize', updateCardsToShow);
  }, []);

  useEffect(() => {
    setStartIndex(0);
  }, [books]);

  if (books.length === 0) return null;

  const canLeft = startIndex > 0;
  const canRight = startIndex < books.length - cardsToShow;

  const prevSlide = () => {
    if (canLeft) setStartIndex((prev) => Math.max(0, prev - 1));
  };
  const nextSlide = () => {
    if (canRight) setStartIndex((prev) => Math.min(books.length - cardsToShow, prev + 1));
  };

  const visibleBooks = books.slice(startIndex, startIndex + cardsToShow);

  return (
    <motion.section
      ref={shelfRef}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      className="relative min-h-[300px] max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/30 flex items-center justify-center shadow-sm">
            <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 700 }}>
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={prevSlide} 
              disabled={!canLeft}
              className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={nextSlide} 
              disabled={!canRight}
              className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <button 
            onClick={onViewAll}
            className="hidden sm:flex text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline items-center transition-colors"
          >
            Xem tất cả <ChevronRight className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>

      <div className="pb-4">
        {isVisible && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            <AnimatePresence mode="popLayout">
              {visibleBooks.map((book, idx) => {
                const rankNumber = startIndex + idx + 1;
                return (
                  <motion.div 
                    key={book.id} 
                    initial={{ opacity: 0, x: 20 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }} 
                    className="relative group w-full"
                  >
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white rounded-full flex items-center justify-center font-black text-sm z-20 shadow-md border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                      {rankNumber}
                    </div>
                    <BookCard book={book} onOpen={onOpenBook} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
      
      <div className="h-px mt-2">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
      </div>
    </motion.section>
  );
}

// ─── TRANG CHÍNH TRENDING ───
export function Trending() {
  const navigate = useNavigate();
  const { onOpenBook } = useOutletContext<OutletContextType>();
  
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<string>('trending_7d');
  
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const [isAtTop, setIsAtTop] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setIsAtTop(currentScrollY < 80);

      if (currentScrollY > lastScrollY && currentScrollY > 120) {
        setScrollDirection('down'); 
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');   
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchTrendingData = async () => {
      setLoading(true);
      try {
        const response = await bookService.getBooks({
          PageNumber: 1,
          PageSize: 800,
          SortBy: timeframe,
          SortOrder: 'desc'
        });
        
        if (response && response.items) {
          const normalized = response.items.map((apiBook: any) => ({
            ...apiBook,
            id: apiBook.book_id || apiBook.id,
            title: apiBook.title || apiBook.original_title || 'Chưa cập nhật',
            cover: apiBook.cover || apiBook.image_url || '',
            author: apiBook.author || apiBook.authors || 'Đang cập nhật',
            genres: apiBook.genres || apiBook.tags || [],
            price: apiBook.price || 0,
            rating: apiBook.rating || apiBook.average_rating || 4.5,
            ratingCount: apiBook.ratingCount || apiBook.total_ratings || 0,
            accentColor: apiBook.accentColor || '#F59E0B'
          }));
          setResults(normalized);
        }
      } catch (error) {
        console.error("Lỗi khi tải dữ liệu thịnh hành:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingData();
  }, [timeframe]);

  const topThreeBooks = results.slice(0, 3);
  const topBook = topThreeBooks[0];
  const accentColor = topBook?.accentColor || '#F59E0B'; 
  const timeframeLabel = timeframe === 'trending_7d' ? 'Tuần này' : timeframe === 'trending_30d' ? 'Tháng này' : 'Mọi thời đại';

  const displayTopBooks = [
    { book: topThreeBooks[1], rank: 2, translateY: '16px' },
    { book: topThreeBooks[0], rank: 1, translateY: '0px' },
    { book: topThreeBooks[2], rank: 3, translateY: '24px' }
  ].filter(item => item.book !== undefined);

  const stickyTopClass = scrollDirection === 'down' && !isAtTop 
    ? 'top-0' 
    : 'top-20 md:top-24';

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14]">

      <div className="relative min-h-[35vh] lg:min-h-[50vh] flex items-end overflow-hidden transition-colors duration-700">
        <div className="absolute inset-0">
          {topBook && (
            <img src={topBook.cover} alt="" className="w-full h-full object-cover scale-125 transition-all duration-700" style={{ filter: 'blur(65px)', opacity: 0.55 }} />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8F7F4]/50 dark:from-[#0D0C14]/50 via-[#F8F7F4]/55 dark:via-[#0D0C14]/65 to-[#F8F7F4] dark:to-[#0D0C14]" />
        
        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-14 pt-32 w-full">
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-end">
            
            <div className="flex-1 space-y-5">
              <div className="flex items-center gap-2 w-fit px-4 py-2 rounded-full bg-white/60 dark:bg-white/8 backdrop-blur-sm border transition-colors duration-700" style={{ borderColor: `${accentColor}40` }}>
                <Flame className="w-4 h-4" style={{ color: accentColor }} />
                {/* ĐÃ SỬA: Thay thế text color nội tuyến bằng Gradient để đảm bảo cực kỳ dễ nhìn trên nền đen */}
                <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-orange-600 to-amber-500 dark:from-orange-400 dark:to-amber-300 bg-clip-text text-transparent">TRENDING NOW</span>
              </div>

              <h1 className="text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, lineHeight: 1.15 }}>
                Sách đang <br />
                <span className="bg-gradient-to-r from-rose-500 via-orange-500 to-amber-500 bg-clip-text text-transparent">
                  làm mưa làm gió
                </span>
              </h1>

              <p className="text-gray-600 dark:text-gray-300 max-w-xl" style={{ fontSize: '1.05rem', lineHeight: 1.7 }}>
                Khám phá những tựa sách đang được cộng đồng quan tâm nhiều nhất. Cập nhật real-time từ hàng nghìn độc giả InkShelf.
              </p>
            </div>

            {displayTopBooks.length > 0 && (
              <div className="hidden lg:flex items-end gap-4 shrink-0">
                {displayTopBooks.map((item) => (
                  <div
                    key={item.book.id}
                    onClick={() => onOpenBook(item.book)}
                    className="cursor-pointer group relative"
                    style={{
                      width: item.rank === 1 ? '120px' : '96px',
                      transform: `translateY(${item.translateY})`,
                      zIndex: item.rank === 1 ? 10 : 1
                    }}
                  >
                    <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm z-20 text-white shadow-lg
                      ${item.rank === 2 ? 'bg-gray-400' : item.rank === 1 ? 'w-10 h-10 -top-4 -right-4 text-lg' : 'bg-orange-700'}`} style={item.rank === 1 ? { backgroundColor: accentColor } : {}}>
                      #{item.rank}
                    </div>
                    <div className="relative rounded-2xl overflow-hidden shadow-xl border-2 border-transparent transition-colors" style={{ aspectRatio: '2/3' }}>
                      <img src={item.book.cover} alt={item.book.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`sticky ${stickyTopClass} z-30 bg-[#F8F7F4]/90 dark:bg-[#0D0C14]/90 backdrop-blur-xl border-b border-t border-gray-200/50 dark:border-white/10 shadow-sm transition-all duration-300 ease-in-out`}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <TrendingUp className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-400 text-xs shrink-0 mr-1 font-medium">Khoảng thời gian:</span>
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setTimeframe(f.id)}
                className="relative px-5 py-1.5 rounded-full text-sm font-semibold transition-all shrink-0"
                style={{ color: timeframe === f.id ? 'white' : undefined }}
              >
                {timeframe === f.id && (
                  <motion.div layoutId="trending-filter-bg" className="absolute inset-0 rounded-full shadow-md" style={{ background: accentColor }} />
                )}
                <span className={`relative z-10 ${timeframe === f.id ? 'text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-10 py-12">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: accentColor }} />
          </div>
        ) : (
          <>
            <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/40 dark:to-orange-900/30 flex items-center justify-center shadow-sm">
                    <Flame className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2 className="text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 700 }}>
                    Top Tổng Hợp {timeframeLabel}
                  </h2>
                </div>
                {/* ĐÃ SỬA: Thêm query param timeframe */}
                <button 
                  onClick={() => navigate(`/trending-all?timeframe=${timeframe}`)}
                  className="text-sm font-semibold text-amber-600 dark:text-amber-500 hover:underline flex items-center gap-1 transition-colors"
                >
                  Xem tất cả <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {results.slice(0, 6).map((book, i) => (
                  <motion.div key={book.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="relative group w-full">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white rounded-full flex items-center justify-center font-black text-sm z-20 shadow-md border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                      {i + 1}
                    </div>
                    <BookCard book={book} onOpen={onOpenBook} />
                  </motion.div>
                ))}
              </div>
            </section>
            
            <div className="h-px max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
            </div>

            {TARGET_GENRES.map((genreItem) => {
              const genreBooks = results
                .filter(b => b.genres?.some(g => g.toLowerCase() === genreItem.id.toLowerCase()))
                .slice(0, 20);

              if (genreBooks.length === 0) return null;

              return (
                <GenreTrendingSlider
                  key={genreItem.id}
                  title={`Top ${genreItem.label}`}
                  books={genreBooks}
                  onOpenBook={onOpenBook}
                  // ĐÃ SỬA: Chuyển hướng kèm theo timeframe và genre
                  onViewAll={() => navigate(`/trending-all?timeframe=${timeframe}&genre=${genreItem.id}`)}
                />
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}