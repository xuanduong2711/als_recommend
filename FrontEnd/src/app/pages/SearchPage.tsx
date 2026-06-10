import { useState, useEffect } from 'react';
import { useSearchParams, useOutletContext } from 'react-router';
import { SlidersHorizontal, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { bookService } from '../../services/bookService';
import { BookCard } from '../components/BookCard';
import type { OutletContextType } from '../components/RootLayout';
import type { Book } from '../data/books';

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { onOpenBook } = useOutletContext<OutletContextType>();

  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // State điều khiển sắp xếp (Khớp với logic Backend)
  const [activeSort, setActiveSort] = useState('newest');

  // ĐẶT LẠI TRANG VỀ 1 KHI NGƯỜI DÙNG TÌM TỪ KHÓA MỚI HOẶC ĐỔI KIỂU SẮP XẾP
  useEffect(() => {
    setPage(1);
  }, [query, activeSort]);

  // GỌI API CHUẨN XÁC: Giao việc tìm kiếm qua Elasticsearch (Python FastAPI)
  useEffect(() => {
    const fetchSearchResults = async () => {
      setLoading(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      try {
        const books = await bookService.searchBooks(query, 60);

        if (books && books.length > 0) {
          setResults(books);
          setTotalPages(1);
          setTotalCount(books.length);
        } else {
          setResults([]);
          setTotalPages(1);
          setTotalCount(0);
        }
      } catch (error) {
        console.error("Lỗi trang tìm kiếm:", error);
        setResults([]);
        setTotalPages(1);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    };

    // Debounce: Nếu người dùng đang gõ nhanh trên URL thì đợi 300ms mới gọi API
    const timeoutId = setTimeout(() => {
      fetchSearchResults();
    }, 300);

    return () => clearTimeout(timeoutId);

  }, [query]);

  return (
    <main className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pt-32 pb-16">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* HEADER */}
        <div className="mb-8 border-b border-gray-200 dark:border-white/10 pb-6">
          <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white">
            {query ? `Kết quả tìm kiếm cho: "${query}"` : 'Tất cả sách'}
          </h1>
          <p className="text-gray-500 mt-2">
            {totalCount > 0 ? `Tìm thấy ${totalCount} kết quả (Trang ${page}/${totalPages})` : `Trang ${page}`}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* BỘ LỌC (SIDEBAR) */}
          <aside className="w-full lg:w-64 shrink-0 space-y-8">
            <div className="bg-white dark:bg-[#1A1A2E] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-white/5 sticky top-28">
              <h3 className="font-bold flex items-center gap-2 text-gray-900 dark:text-white mb-4">
                <SlidersHorizontal className="w-4 h-4" /> Bộ lọc & Sắp xếp
              </h3>
              
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sắp xếp theo</label>
                <select 
                  value={activeSort}
                  onChange={(e) => setActiveSort(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-gray-50 dark:bg-[#2A2A40] border-transparent focus:ring-2 focus:ring-indigo-500 text-sm text-gray-700 dark:text-gray-200 outline-none"
                >
                  <option className="bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white" value="newest">Mới nhất (Năm xuất bản)</option>
                  <option className="bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white" value="popular">Nổi tiếng nhất (Nhiều đánh giá)</option>
                  <option className="bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white" value="top_rated">Đánh giá cao nhất (Nhiều 5 sao)</option>
                  <option className="bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white" value="price_asc">Giá: Thấp đến cao</option>
                  <option className="bg-white dark:bg-[#1A1A2E] text-gray-900 dark:text-white" value="price_desc">Giá: Cao đến thấp</option>
                </select>
              </div>
            </div>
          </aside>

          {/* KHU VỰC KẾT QUẢ & PHÂN TRANG */}
          <div className="flex-1 flex flex-col min-h-[500px]">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <span className="text-6xl mb-4">🔍</span>
                <p>Không tìm thấy cuốn sách nào phù hợp.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-5">
                  {results.map((book) => (
                    <BookCard key={book.id} book={book} onOpen={onOpenBook} size="sm" />
                  ))}
                </div>

                {/* THANH CHUYỂN TRANG (PAGINATION) */}
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
                                page === i + 1 
                                  ? 'bg-indigo-600 text-white' 
                                  : 'bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/20'
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

      </div>
    </main>
  );
}