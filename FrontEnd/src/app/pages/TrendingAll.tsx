import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router';
import { BookOpen, ArrowLeft, Loader2, Flame, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { bookService } from '../../services/bookService';
import type { Book } from '../data/books';
import { BookCard } from '../components/BookCard';
import type { OutletContextType } from '../components/RootLayout';

const FILTERS = [
  { id: 'trending_7d', label: 'Tuần này' },
  { id: 'trending_30d', label: 'Tháng này' },
  { id: 'popularity', label: 'Mọi thời đại' },
];

const GENRE_LABELS: Record<string, string> = {
  'fantasy': 'Giả tưởng',
  'science-fiction': 'Viễn tưởng',
  'classics': 'Kinh điển',
  'romance': 'Lãng mạn',
  'mystery': 'Trinh thám',
  'adventure': 'Phiêu lưu'
};

export function TrendingAll() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const timeframe = searchParams.get('timeframe') || 'trending_7d'; 
  const genre = searchParams.get('genre'); // Lấy thể loại nếu bấm từ slider
  
  const { onOpenBook } = useOutletContext<OutletContextType>();
  
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('up');
  const [isAtTop, setIsAtTop] = useState(true);

  // Hiệu ứng thanh công cụ cuộn
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

  // Thay đổi trang về 1 khi người dùng bấm Filter khác
  useEffect(() => {
    setPage(1);
  }, [timeframe, genre]);

  // GỌI API ĐỂ LẤY TẤT CẢ SÁCH THEO THỜI GIAN VÀ THỂ LOẠI
  useEffect(() => {
    const fetchTrendingBooks = async () => {
      setLoading(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      try {
        const response = await bookService.getBooks({
          PageNumber: page,
          PageSize: 60,
          SortBy: timeframe,
          SortOrder: 'desc',
          Genre: genre || undefined // Lọc thêm thể loại nếu có
        });

        if (response && response.items) {
          const normalized = response.items.map((b: any) => ({ ...b, id: b.book_id || b.id }));
          setResults(normalized);
          
          const apiTotalPages = (response as any).totalPages || (response as any).TotalPages;
          if (apiTotalPages) setTotalPages(apiTotalPages);
          else setTotalPages(normalized.length === 60 ? page + 1 : page);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error("Lỗi khi tải sách:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingBooks();
  }, [timeframe, genre, page]);

  // Hàm chuyển filter
  const setTimeframe = (newTimeframe: string) => {
    setSearchParams(prev => {
      prev.set('timeframe', newTimeframe);
      return prev;
    });
  };

  const titleText = timeframe === 'trending_7d' ? 'Hot Tuần Này' : timeframe === 'trending_30d' ? 'Hot Tháng Này' : 'Hot Mọi Thời Đại';
  const genreLabel = genre ? (GENRE_LABELS[genre.toLowerCase()] || genre) : '';

  const stickyTopClass = scrollDirection === 'down' && !isAtTop 
    ? 'top-0' 
    : 'top-20 md:top-24';

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14]">
      
      <div className="pt-24 pb-8 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            {genre ? <BookOpen className="w-6 h-6 text-amber-500" /> : <Flame className="w-6 h-6 text-amber-500" />}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)' }}>
              Top  {titleText} {genreLabel && <span className="text-amber-600 dark:text-amber-500">- {genreLabel}</span>}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Trang {page} / {totalPages}</p>
          </div>
        </div>
      </div>

      {/* THANH CÔNG CỤ FILTER */}
      <div className={`sticky ${stickyTopClass} z-30 bg-[#F8F7F4]/90 dark:bg-[#0D0C14]/90 backdrop-blur-xl border-b border-t border-gray-200/50 dark:border-white/10 shadow-sm transition-all duration-300 ease-in-out mb-8`}>
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
                  <motion.div layoutId="trending-all-filter-bg" className="absolute inset-0 rounded-full shadow-md bg-amber-500" />
                )}
                <span className={`relative z-10 ${timeframe === f.id ? 'text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}>
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-amber-500" /></div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <span className="text-6xl mb-4">🔍</span>
            <p>Không tìm thấy cuốn sách nào trong danh mục này.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-5 gap-y-10">
              {results.map((book, i) => {
                const rank = (page - 1) * 60 + i + 1;
                return (
                  <div key={book.id} className="relative group flex justify-center">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white rounded-full flex items-center justify-center font-black text-sm z-10 shadow-md border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                      {rank}
                    </div>
                    <BookCard book={book} onOpen={onOpenBook} size="md" />
                  </div>
                );
              })}
            </div>

            {/* THANH PHÂN TRANG */}
            {totalPages > 1 && (
              <div className="mt-14 flex items-center justify-center gap-4">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
                
                <div className="flex items-center gap-2">
                  {[...Array(totalPages)].map((_, i) => {
                    if (i + 1 === 1 || i + 1 === totalPages || (i + 1 >= page - 1 && i + 1 <= page + 1)) {
                      return (
                        <button
                          key={i}
                          onClick={() => setPage(i + 1)}
                          className={`w-10 h-10 rounded-xl text-sm font-semibold transition-colors ${
                            page === i + 1 ? 'bg-amber-500 text-white shadow-md' : 'bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/20'
                          }`}
                        >
                          {i + 1}
                        </button>
                      );
                    } else if (i + 1 === page - 2 || i + 1 === page + 2) {
                      return <span key={i} className="text-gray-500">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-white/20 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}