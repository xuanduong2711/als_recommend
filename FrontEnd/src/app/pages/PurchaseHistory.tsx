import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useOutletContext } from 'react-router';
import {
  ArrowLeft, Calendar, Filter, Download, Check, BookOpen, TrendingUp, DollarSign, Package, Search, Loader2
} from 'lucide-react';
import { useBooks } from '../hooks/useBooks';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import type { Book } from '../data/books';
import type { OutletContextType } from '../components/RootLayout';
import { userService } from '../../services/userService';
import { mapToBook } from '../../services/bookService';

type PurchaseStatus = 'completed' | 'pending' | 'failed';
type FilterType = 'all' | 'completed' | 'pending';

interface Purchase {
  id: string | number;
  bookId: string | number;
  book?: Book;
  date: string;
  amount: number;
  status: PurchaseStatus;
  paymentMethod: string;
  transactionId: string;
}

export function PurchaseHistory() {
  const navigate = useNavigate();
  const { onOpenBook } = useOutletContext<OutletContextType>();
  const { books } = useBooks();
  
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const userId = userService.getCurrentUserId();
        if (!userId) {
          navigate('/login');
          return;
        }
        
        // 1. KẾT NỐI API THỰC TẾ
        const purchasedEntities = await userService.getPurchasedBooks(userId);
        
        if (purchasedEntities && purchasedEntities.length > 0) {
          // Map dữ liệu
          const apiPurchases = purchasedEntities.map((bEntity: any, i: number) => {
            // Lấy object book từ bên trong bEntity do API lồng data (nested object)
            const bookData = bEntity.book;
            
            // Map dữ liệu sách thông qua object bookData vừa bóc ra
            const b = bookData ? mapToBook(bookData) : undefined;
            
            // Ưu tiên lấy purchase_price và purchase_date từ bảng UserBooks (nếu backend có)
            // Nếu không có, fallback về giá gốc của sách (bookData.price) và ngày hiện tại
            const purchasePrice = bEntity.purchase_price ?? bookData?.price ?? 0;
            const purchaseDate = bEntity.purchase_date ?? bEntity.created_at ?? new Date().toISOString();
            
            return {
              id: bEntity.id || `PUR-${i}`,
              bookId: bEntity.book_id, // Lấy book_id từ entity trung gian
              book: b,
              date: purchaseDate,
              amount: purchasePrice,
              status: 'completed' as PurchaseStatus, 
              paymentMethod: 'Ví hệ thống',
              transactionId: bEntity.transaction_id || `TXN-${Math.floor(100000 + Math.random() * 900000)}`
            };
          });
          
          // Lọc bỏ những record bị lỗi không chứa thông tin sách
          const validPurchases = apiPurchases.filter((p: any) => p.book !== undefined);

          // Sắp xếp ngày mua mới nhất lên đầu
          validPurchases.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          
          setPurchases(validPurchases);
        }
      } catch (e) {
        console.error("Lỗi khi tải lịch sử mua hàng:", e);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPurchases();
  }, [navigate]);

  // Lọc dữ liệu kết hợp Status và Tìm kiếm bằng title
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const matchStatus = filter === 'all' || p.status === filter;
      const matchSearch = p.book?.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.transactionId.toLowerCase().includes(searchTerm.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [purchases, filter, searchTerm]);

  // 2. TÍNH TOÁN STATS ĐỘNG TỪ DỮ LIỆU THỰC
  const totalSpent = purchases.reduce((sum, p) => sum + p.amount, 0);
  const totalBooks = purchases.length;
  
  const genreStats = purchases.reduce((acc, p) => {
    const book = p.book || books.find(b => String(b.id) === String(p.bookId));
    if (book && book.genres && book.genres.length > 0) {
      const firstGenre = book.genres[0];
      acc[firstGenre] = (acc[firstGenre] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  const topGenre = Object.entries(genreStats).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa rõ';

  // Tính số ngày kể từ lần mua gần nhất
  const getDaysSinceLastPurchase = () => {
    if (purchases.length === 0) return 'Chưa mua';
    const latestDate = new Date(Math.max(...purchases.map(p => new Date(p.date).getTime())));
    const diffTime = Math.abs(new Date().getTime() - latestDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? 'Hôm nay' : `${diffDays} ngày trước`;
  };

  const statusColors: Record<PurchaseStatus, { bg: string; text: string; label: string }> = {
    completed: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Hoàn thành' },
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Đang xử lý' },
    failed: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-400', label: 'Thất bại' },
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pt-16">

      {/* Header */}
      <div className="bg-white/80 dark:bg-[#16152B]/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/8">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Quay lại</span>
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900 dark:text-white font-bold" style={{ fontSize: '1.8rem' }}>
                Lịch sử mua hàng
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Quản lý và xem lại các giao dịch của bạn
              </p>
            </div>
            <button className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#16152B] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/12 rounded-2xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/8 transition-all">
              <Download className="w-4 h-4" /> Xuất hóa đơn
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Package, label: 'Tổng sách đã mua', value: totalBooks, unit: 'cuốn', bg: 'from-indigo-500 to-violet-600', shadow: 'shadow-indigo-200 dark:shadow-indigo-900/30' },
            { icon: DollarSign, label: 'Tổng chi tiêu', value: totalSpent > 0 ? `${(totalSpent / 1000).toLocaleString('vi-VN')}k` : '0', unit: 'VNĐ', bg: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-200 dark:shadow-emerald-900/30' },
            { icon: TrendingUp, label: 'Thể loại yêu thích', value: topGenre, unit: '', bg: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-200 dark:shadow-rose-900/30' },
            { icon: Calendar, label: 'Lần mua gần nhất', value: getDaysSinceLastPurchase(), unit: '', bg: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-200 dark:shadow-amber-900/30' },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 shadow-sm">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.bg} flex items-center justify-center mb-4 shadow-lg ${stat.shadow}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-gray-900 dark:text-white font-bold mb-1 flex items-baseline gap-1" style={{ fontSize: '1.5rem' }}>
                  {stat.value}
                  {stat.unit && <span className="text-gray-400 text-sm font-medium">{stat.unit}</span>}
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{stat.label}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Filters & Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">

          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto hide-scrollbar">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex gap-2">
              {[
                { id: 'all' as const, label: 'Tất cả', count: purchases.length },
                { id: 'completed' as const, label: 'Hoàn thành', count: purchases.filter(p => p.status === 'completed').length },
                { id: 'pending' as const, label: 'Đang xử lý', count: purchases.filter(p => p.status === 'pending').length },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center whitespace-nowrap gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${filter === f.id
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200/60 dark:shadow-indigo-900/20'
                    : 'bg-white dark:bg-[#16152B] text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-white/8 hover:border-indigo-200 dark:hover:border-indigo-700/50'
                  }`}>
                  {f.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${filter === f.id ? 'bg-white/30' : 'bg-gray-100 dark:bg-white/10'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Tìm tên sách, mã giao dịch..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-[#16152B] border border-gray-100 dark:border-white/8 rounded-xl text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

        </motion.div>

        {/* Loading / Purchase List / Empty State */}
        {loading ? (
           <div className="flex flex-col items-center justify-center py-20">
             <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
             <p className="text-gray-500 text-sm">Đang tải lịch sử giao dịch...</p>
           </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="space-y-4">

            <AnimatePresence>
              {filteredPurchases.map((purchase, i) => {
                const book = purchase.book || books.find(b => String(b.id) === String(purchase.bookId));
                if (!book) return null;

                const statusStyle = statusColors[purchase.status];
                
                // Format ngày mua kèm theo giờ phút cho chính xác
                const dateObj = new Date(purchase.date);
                const purchaseDate = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const purchaseTime = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

                return (
                  <motion.div
                    key={purchase.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 shadow-sm hover:shadow-md transition-all group">

                    <div className="flex flex-col sm:flex-row gap-5">

                      {/* Book Cover */}
                      <div
                        onClick={() => {                          
                          onOpenBook(book);
                        }}
                        className="shrink-0 w-20 sm:w-24 cursor-pointer">
                        <div className="relative rounded-2xl overflow-hidden shadow-md group-hover:shadow-lg transition-shadow" style={{ aspectRatio: '2/3' }}>
                          <ImageWithFallback src={book.cover} alt={book.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400" />
                          <motion.div
                            className="absolute inset-0 rounded-2xl pointer-events-none"
                            initial={false}
                            whileHover={{ boxShadow: `0 0 18px 2px ${book.accentColor}50` }}
                          />
                        </div>
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <h3
                              onClick={() => {
                                onOpenBook(book);
                              }}
                              className="text-gray-900 dark:text-white font-bold text-base mb-1 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              {book.title}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{book.author}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                                {purchase.status === 'completed' && <Check className="w-3 h-3" />}
                                {statusStyle.label}
                              </span>
                              <span className="text-gray-400 text-xs">·</span>
                              <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {purchaseTime} - {purchaseDate}
                              </span>
                            </div>
                          </div>

                          {/* Price */}
                          <div className="text-left sm:text-right shrink-0 mt-2 sm:mt-0">
                            <div className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                              {purchase.amount.toLocaleString('vi-VN')}₫
                            </div>
                            {book.originalPrice && book.originalPrice > purchase.amount && (
                              <div className="text-gray-400 line-through text-xs">
                                {book.originalPrice.toLocaleString('vi-VN')}₫
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Transaction Info */}
                        <div className="flex flex-wrap items-center gap-4 pt-3 mt-auto border-t border-gray-100 dark:border-white/8">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">Phương thức:</span>
                            <span className="text-gray-700 dark:text-gray-300 font-medium">{purchase.paymentMethod}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-gray-400">Mã GD:</span>
                            <span className="text-gray-700 dark:text-gray-300 font-mono font-medium">{purchase.transactionId}</span>
                          </div>
                          <button
                            onClick={() => {
                              navigate(`/book/${book.id}`);
                            }}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 transition-all shadow-sm">
                            <BookOpen className="w-3 h-3" /> Đọc ngay
                          </button>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Empty State */}
            {!loading && filteredPurchases.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-12 text-center shadow-sm">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/8 dark:to-white/5 flex items-center justify-center mx-auto mb-4">
                  <Package className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-2">Chưa có giao dịch nào</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
                  {searchTerm ? 'Không tìm thấy kết quả phù hợp với từ khóa của bạn' : 'Bạn chưa mua sách nào với bộ lọc này'}
                </p>
                <button
                  onClick={() => {
                    if (searchTerm) setSearchTerm('');
                    else navigate('/');
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold hover:opacity-95 transition-all shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/30">
                  {searchTerm ? 'Xóa bộ lọc' : 'Khám phá sách'}
                </button>
              </motion.div>
            )}

          </motion.div>
        )}

      </div>

    </div>
  );
}