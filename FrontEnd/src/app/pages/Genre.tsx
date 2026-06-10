import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate, useOutletContext } from 'react-router';
import {
  Star, ShoppingCart, ChevronRight, TrendingUp, Sparkles, BookOpen,
  Filter, ChevronLeft, Loader2
} from 'lucide-react';
import { genreInfo, badgeColors, GENRES } from '../data/books';
import { bookService } from '../../services/bookService';
import type { Book } from '../data/books';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { BookCard } from '../components/BookCard';
import { BookShelf } from '../components/BookShelf';
import type { OutletContextType } from '../components/RootLayout';

export function Genre() {
  const { genre } = useParams<{ genre: string }>();
  const navigate = useNavigate();
  const { onOpenBook } = useOutletContext<OutletContextType>();
  
  const [results, setResults] = useState<Book[]>([]);
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [trendingInGenre, setTrendingInGenre] = useState<Book[]>([]);
  // THÊM STATE RIÊNG CHO EDITOR'S CHOICE
  const [editorChoice, setEditorChoice] = useState<Book[]>([]);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedSubgenre, setSelectedSubgenre] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [genre, selectedSubgenre]);

  useEffect(() => {
    const fetchGenreBooks = async () => {
      if (!genre) return;
      setLoading(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      try {
        const targetGenre = selectedSubgenre || genre;
        const isFirstPage = page === 1;

        if (isFirstPage) {
          // GỌI ĐỒNG THỜI 4 API RIÊNG BIỆT (Thêm API lấy sách Editor's Choice/Original)
          const [generalRes, popularRes, trendingRes, editorRes] = await Promise.all([
            bookService.getBooks({ PageNumber: page, PageSize: 60, Genre: targetGenre }),
            bookService.getBooks({ PageNumber: 1, PageSize: 3, Genre: targetGenre, SortBy: 'popularity', SortOrder: 'desc' }),
            bookService.getBooks({ PageNumber: 1, PageSize: 10, Genre: targetGenre, SortBy: 'trending_7d', SortOrder: 'desc' }),
            // Gọi API dùng filter Badge mới cập nhật ở Backend (Phân cách bởi dấu phẩy)
            bookService.getBooks({ PageNumber: 1, PageSize: 10, Genre: targetGenre, Badges: "Editor's Choice,Original" })
          ]);

          // Xử lý Lưới Thư viện chung
          if (generalRes && generalRes.items) {
            const normalized = generalRes.items.map((b: any) => ({ ...b, id: b.book_id || b.id }));
            setResults(normalized);
            
            const apiTotalPages = (generalRes as any).totalPages || (generalRes as any).TotalPages;
            const apiTotalCount = (generalRes as any).totalCount || (generalRes as any).TotalCount || normalized.length;
            
            if (apiTotalPages) {
               setTotalPages(apiTotalPages);
            } else if (apiTotalCount) {
               setTotalPages(Math.max(1, Math.ceil(apiTotalCount / 60)));
            } else {
               setTotalPages(normalized.length === 60 ? page + 1 : page);
            }
            setTotalCount(apiTotalCount);
          } else {
            setResults([]);
            setTotalPages(1);
            setTotalCount(0);
          }

          // Xử lý 3 thẻ Hero Banner
          if (popularRes && popularRes.items) {
            setFeaturedBooks(popularRes.items.map((b: any) => ({ ...b, id: b.book_id || b.id })));
          } else {
            setFeaturedBooks([]);
          }

          // Xử lý Kệ sách Trending
          if (trendingRes && trendingRes.items) {
            setTrendingInGenre(trendingRes.items.map((b: any) => ({ ...b, id: b.book_id || b.id })));
          } else {
            setTrendingInGenre([]);
          }

          // Xử lý Kệ sách Editor's Choice
          if (editorRes && editorRes.items) {
            setEditorChoice(editorRes.items.map((b: any) => ({ ...b, id: b.book_id || b.id })));
          } else {
            setEditorChoice([]);
          }

        } else {
          // TỪ TRANG 2 TRỞ ĐI: CHỈ CẦN GỌI ĐÚNG 1 API LƯỚI CHUNG CHO NHẸ SERVER
          const response = await bookService.getBooks({
            PageNumber: page,
            PageSize: 60,
            Genre: targetGenre 
          });

          if (response && response.items) {
            const normalized = response.items.map((b: any) => ({ ...b, id: b.book_id || b.id }));
            setResults(normalized);
            
            const apiTotalPages = (response as any).totalPages || (response as any).TotalPages;
            const apiTotalCount = (response as any).totalCount || (response as any).TotalCount || normalized.length;
            
            if (apiTotalPages) {
               setTotalPages(apiTotalPages);
            } else if (apiTotalCount) {
               setTotalPages(Math.max(1, Math.ceil(apiTotalCount / 60)));
            } else {
               setTotalPages(normalized.length === 60 ? page + 1 : page);
            }
            setTotalCount(apiTotalCount);
          } else {
            setResults([]);
            setTotalPages(1);
            setTotalCount(0);
          }
        }
      } catch (error) {
        console.error("Lỗi khi tải sách thể loại:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchGenreBooks();
  }, [genre, selectedSubgenre, page]);

  if (!genre) return <NotFound navigate={navigate} />;

  const info = genreInfo[genre];
  const accentColor = info?.accentColor ?? '#4F46E5';

  const isFirstPage = page === 1;
  const libraryBooks = results;

  // ĐÃ XÓA HOÀN TOÀN CÁC PHẦN BÓC TÁCH THỦ CÔNG (Bao gồm cả sách Mới)
  
  // ─── TỪ ĐIỂN TỔNG HỢP: ICON & MÔ TẢ THEO VIBE ──────────────────────────────
  const customGenreData: Record<string, { icon: string, desc: string }> = {
    'fantasy': { icon: '🐉', desc: 'Bước vào những thế giới phép thuật huyền bí, nơi ranh giới của thực tại bị xóa nhòa bởi những truyền thuyết cổ xưa và các sinh vật thần thoại.' },
    'magic': { icon: '✨', desc: 'Khám phá sức mạnh của những câu thần chú và thế giới phép thuật kỳ diệu.' },
    'science-fiction': { icon: '🚀', desc: 'Khám phá những chân trời công nghệ tương lai, nơi khoa học viễn tưởng dẫn lối nhân loại đến các vì sao và những chiều không gian vô tận.' },
    'science': { icon: '🔬', desc: 'Mở rộng tri thức với những ý tưởng đột phá và những giới hạn mới của khoa học.' },
    'romance': { icon: '🌹', desc: 'Lạc vào những câu chuyện tình yêu đầy thăng trầm, nơi trái tim rung động qua từng trang sách và cảm xúc đọng lại mãi mãi.' },
    'love': { icon: '💌', desc: 'Những cung bậc cảm xúc ngọt ngào và cay đắng của tình yêu đôi lứa.' },
    'mystery': { icon: '🕵️‍♂️', desc: 'Theo chân những manh mối bí ẩn, giải mã các vụ án hóc búa và đối mặt với những sự thật bị chôn vùi trong bóng tối.' },
    'thriller': { icon: '🔪', desc: 'Trải nghiệm cảm giác hồi hộp đến nghẹt thở với những âm mưu xảo quyệt và những ngã rẽ không thể lường trước.' },
    'horror': { icon: '🕸️', desc: 'Đối mặt với những nỗi sợ hãi sâu thẳm nhất và những thế lực đen tối đang rình rập.' },
    'classics': { icon: '🏛️', desc: 'Thưởng thức những tác phẩm kinh điển vượt thời gian, nền tảng của văn học nhân loại mang theo những giá trị tư tưởng sâu sắc.' },
    'history': { icon: '📜', desc: 'Quay ngược dòng thời gian, sống lại những thời khắc hào hùng và bi tráng nhất trong lịch sử nhân loại.' },
    'adventure': { icon: '🗺️', desc: 'Sẵn sàng cho những chuyến phiêu lưu kỳ thú, vượt qua muôn vàn thử thách để tìm kiếm những vùng đất mới.' },
    'biography': { icon: '🖋️', desc: 'Lắng nghe những cuộc đời phi thường và những câu chuyện truyền cảm hứng từ những nhân vật lịch sử.' }
  };

  const getCustomData = (g: string) => {
    const key = Object.keys(customGenreData).find(k => g.toLowerCase().includes(k));
    return key ? customGenreData[key] : { icon: '📚', desc: info?.description || 'Khám phá bộ sưu tập những tựa sách xuất sắc nhất, được chọn lọc kỹ lưỡng dành riêng cho bạn.' };
  };

  const currentData = getCustomData(genre);
  const displayIcon = currentData.icon;
  const displayDescription = currentData.desc;

  const getGenreVibe = (genreName: string) => {
    const g = genreName.toLowerCase();
    const baseSize = 'clamp(2.5rem, 5vw, 4rem)';

    if (g.includes('fantasy') || g.includes('magic')) {
      return {
        className: "tracking-wide",
        style: { fontFamily: '"Georgia", "Times New Roman", serif', fontStyle: 'italic', fontSize: baseSize }
      };
    }
    if (g.includes('science-fiction') || g.includes('science')) {
      return {
        className: "tracking-[0.15em] uppercase",
        style: { fontFamily: '"Courier New", Courier, monospace', fontWeight: 800, fontSize: 'clamp(2rem, 4vw, 3.5rem)' }
      };
    }
    if (g.includes('romance') || g.includes('love')) {
      return {
        className: "tracking-normal",
        style: { fontFamily: '"Playfair Display", "Georgia", serif', fontSize: baseSize }
      };
    }
    if (g.includes('mystery') || g.includes('thriller')) {
      return {
        className: "tracking-[0.2em] uppercase",
        style: { fontFamily: 'Impact, "Arial Black", sans-serif', fontSize: 'clamp(2.5rem, 5vw, 3.8rem)', letterSpacing: '4px' }
      };
    }
    
    return {
      className: "tracking-tight",
      style: { fontFamily: 'var(--font-serif), serif', fontSize: baseSize }
    };
  };

  const genreVibe = getGenreVibe(genre);

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14]">

      {/* ── Genre Hero Header ── */}
      <div className="relative min-h-[35vh] lg:min-h-[45vh] flex items-center overflow-hidden py-12">
        <div className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-[#F8F7F4] to-gray-50 dark:from-[#0D0C14] dark:to-gray-900/20">
          <div className="absolute top-0 right-0 w-[50vw] h-[50vw] opacity-20 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3" style={{ background: accentColor }} />
          <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] opacity-15 blur-[80px] rounded-full -translate-x-1/3 translate-y-1/3" style={{ background: accentColor }} />
          
          <div className="absolute top-1/2 left-[70%] -translate-x-1/2 -translate-y-1/2 text-[35vw] opacity-[0.04] dark:opacity-[0.06] blur-[2px] rotate-[-15deg] select-none">
            {displayIcon}
          </div>
          
          <motion.div 
            animate={{ y: [0, -20, 0], rotate: [0, 10, 0] }} 
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-12 left-[15%] text-5xl opacity-10 blur-[1px] select-none"
          >
            {displayIcon}
          </motion.div>
          <motion.div 
            animate={{ y: [0, 20, 0], rotate: [0, -10, 0] }} 
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            className="absolute bottom-20 right-[25%] text-7xl opacity-[0.08] blur-[3px] select-none"
          >
            {displayIcon}
          </motion.div>
        </div>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full z-10 pt-10">
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center lg:items-start text-center lg:text-left">
            
            <div className="flex-1 space-y-4 flex flex-col items-center lg:items-start max-w-3xl">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className={`text-gray-900 dark:text-white drop-shadow-sm ${genreVibe.className}`}
                style={{ fontWeight: 800, lineHeight: 1.15, ...genreVibe.style }}
              >
                {genre} <span className="inline-block text-[0.85em] drop-shadow-md ml-1">{displayIcon}</span>
              </motion.h1>

              {isFirstPage && (
                <motion.p
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.15 }}
                  className="text-gray-600 dark:text-gray-300 text-base md:text-lg"
                  style={{ fontWeight: 400, lineHeight: 1.6, maxWidth: '90%' }}
                >
                  {displayDescription}
                </motion.p>
              )}
            </div>

            {isFirstPage && featuredBooks.length > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="hidden lg:flex items-center gap-4 shrink-0"
              >
                {featuredBooks.map((book, i) => (
                  <motion.div
                    key={book.id}
                    whileHover={{ y: -12, scale: 1.02 }}
                    onClick={() => onOpenBook(book)}
                    className="cursor-pointer group relative z-20"
                    style={{
                      width: i === 1 ? '130px' : '100px',
                      transform: i === 0 ? 'translateY(16px)' : i === 2 ? 'translateY(-16px)' : undefined,
                      zIndex: i === 1 ? 30 : 20
                    }}
                  >
                    <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white/40 dark:border-white/10 backdrop-blur-sm" style={{ aspectRatio: '2/3' }}>
                      <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* ── Subgenre Tags ── */}
      {info && (
        <div className="sticky top-20 z-30 bg-[#F8F7F4]/90 dark:bg-[#0D0C14]/90 backdrop-blur-xl border-b border-t border-gray-200/50 dark:border-white/10">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-2">
            <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <Filter className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-400 text-xs shrink-0 mr-1">Phụ thể loại:</span>
              <button
                onClick={() => setSelectedSubgenre(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedSubgenre === null ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900' : 'bg-white/70 dark:bg-white/8 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/12'}`}
              >
                Tất cả
              </button>
              {info.subgenres.map(sg => (
                <button
                  key={sg}
                  onClick={() => setSelectedSubgenre(selectedSubgenre === sg ? null : sg)}
                  className={`relative shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all overflow-hidden border ${selectedSubgenre === sg ? 'text-white border-transparent shadow-md' : 'bg-white/70 dark:bg-white/8 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/12'}`}
                  style={selectedSubgenre === sg ? { background: accentColor } : undefined}
                >
                  {sg}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="space-y-14 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : libraryBooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-500 py-20">
            <span className="text-6xl mb-4">🔍</span>
            <p>Không tìm thấy cuốn sách nào phù hợp.</p>
          </div>
        ) : (
          <>
            {isFirstPage && (
              <>
                {trendingInGenre.length > 0 && (
                  <BookShelf title={`Trending trong ${selectedSubgenre || genre}`} subtitle="Được tương tác nhiều nhất tuần này" emoji="🔥" books={trendingInGenre} onOpenBook={onOpenBook} accentColor={accentColor} />
                )}
                {editorChoice.length > 0 && (
                  <BookShelf title={`Editor's Choice`} subtitle="Chọn lọc kỹ càng" emoji="✨" books={editorChoice} onOpenBook={onOpenBook} accentColor={accentColor} />
                )}
                {/* ĐÃ XÓA KỆ SÁCH MỚI */}
              </>
            )}

            {/* ── Discovery Grid ── */}
            <motion.section
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/30 flex items-center justify-center shadow-sm">
                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h2 className="text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 700 }}>
                      Thư viện {selectedSubgenre || genre}
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">Trang {page} / {totalPages}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-10">
                {libraryBooks.map((book) => (
                  <div key={book.id} className="flex justify-center">
                    <BookCard book={book} onOpen={onOpenBook} size="md" /> 
                  </div>
                ))}
              </div>

              {/* ── THANH CHUYỂN TRANG ── */}
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
                              page === i + 1 ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/20'
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
            </motion.section>

            {/* AI Recommendation */}
            {isFirstPage && (
              <motion.section
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-12"
              >
                <div className="relative overflow-hidden rounded-3xl p-8 sm:p-10 border shadow-sm" style={{ background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)`, borderColor: `${accentColor}25` }}>
                  <div className="relative flex flex-col lg:flex-row gap-8 items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
                        <span className="font-semibold text-sm uppercase tracking-wide" style={{ color: accentColor }}>Gợi ý AI</span>
                      </div>
                      <h3 className="text-gray-900 dark:text-white font-bold mb-3" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem' }}>
                        Khám phá thêm
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-5">
                        Mở rộng thế giới đọc sách của bạn với các thể loại liên quan.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {GENRES.filter(g => g !== genre).slice(0, 4).map(g => (
                          <button key={g} onClick={() => navigate(`/genre/${g}`)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-white/10 hover:shadow-md transition-all">
                            Khám phá {g} <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NotFound({ navigate, message = 'Không tìm thấy thể loại này' }: { navigate: (p: string) => void; message?: string }) {
  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pt-24 flex items-center justify-center">
      <div className="text-center">
        <span className="text-5xl mb-4 block">📚</span>
        <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">{message}</p>
        <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:opacity-90 transition-all shadow-lg">
          Về trang chủ
        </button>
      </div>
    </div>
  );
}