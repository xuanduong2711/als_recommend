import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate, useOutletContext } from 'react-router';
import {
  Star, ShoppingCart, BookOpen, Heart, Share2, ArrowLeft, ChevronRight, ChevronLeft,
  Clock, Tag, Award, MessageSquare, Play, Globe, MoreHorizontal,
  Layers, Calendar, TrendingUp, Sparkles, Eye, Loader2, Send, ChevronDown, ChevronUp // Đã thêm ChevronDown, ChevronUp
} from 'lucide-react';
import { genreColors, badgeColors, genreInfo } from '../data/books';
import { bookService } from '../../services/bookService';
import { userService } from '../../services/userService';
import { reviewService, ReviewData } from '../../services/reviewService';
import { ratingService } from '../../services/ratingService';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { BookCard } from '../components/BookCard';
import type { Book } from '../data/books';
import type { OutletContextType } from '../components/RootLayout';

const INITIAL_REVIEW_COUNT = 5;
const LOAD_MORE_COUNT = INITIAL_REVIEW_COUNT * 2; 

export function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { onOpenBook } = useOutletContext<OutletContextType>();
  
  // STATE SÁCH
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  
  // STATE DANH SÁCH ĐỀ XUẤT
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);

  // STATE USER & ACTIONS
  const currentUserId = userService.getCurrentUserId();
  const [liked, setLiked] = useState(false);
  const [purchased, setPurchased] = useState(false);
  const [isAlreadyPurchased, setIsAlreadyPurchased] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  // STATE REVIEWS & RATING
  const [bookReviews, setBookReviews] = useState<ReviewData[]>([]);
  const [visibleReviewCount, setVisibleReviewCount] = useState(INITIAL_REVIEW_COUNT);
  const [loadingReviews, setLoadingReviews] = useState(false);
  
  // STATE NHẬP LIỆU & MENU
  const [newReviewText, setNewReviewText] = useState('');
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [showFullPreview, setShowFullPreview] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // SỰ KIỆN: Lắng nghe click ra ngoài để đóng Menu Dropdown
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    if (activeDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdownId]);

  // 1. GỌI API LẤY CHI TIẾT SÁCH 
  const fetchBookDetail = async (isRefetch = false) => {
    if (!id) return;
    if (!isRefetch) setLoading(true);
    try {
      const response = await bookService.getBookById(id); 
      if (response) {
        const normalizedBook = { ...response, id: (response as any).book_id || response.id } as Book;
        setBook(normalizedBook);
      } else {
        if (!isRefetch) setBook(null);
      }
    } catch (error) {
      console.error("Lỗi tải chi tiết sách:", error);
      if (!isRefetch) setBook(null);
    } finally {
      if (!isRefetch) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookDetail();
  }, [id]);

  // 2. GỌI API LẤY SÁCH ĐỀ XUẤT
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!book?.id) return;
      setLoadingRecommendations(true);
      try {
        const res = await bookService.getRecommendations();
        setRecommendedBooks(res.filter(b => String(b.id) !== String(book.id)));
      } catch (error) {
        console.error("Lỗi tải sách đề xuất:", error);
      } finally {
        setLoadingRecommendations(false);
      }
    };
    fetchRecommendations();
  }, [book?.id]);

  // 3. KIỂM TRA TRẠNG THÁI USER (Mua, Wishlist & Rating cũ)
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!book?.id) return;
      setIsAlreadyPurchased(false);
      setLiked(false);
      setPurchased(false);
      setNewRating(0); 

      if (!currentUserId) return; 

      try {
        const [purchasedList, wishlist, userRating] = await Promise.all([
          userService.getPurchasedBooks(currentUserId),
          userService.getWishlist(),
          ratingService.getRatingsByBook(String(book.id)).catch(() => null)
        ]);

        const hasPurchased = purchasedList?.some(b => String(b.book_id) === String(book.id));
        if (hasPurchased) setIsAlreadyPurchased(true);

        const hasLiked = wishlist?.some(b => String(b.book_id) === String(book.id));
        if (hasLiked) setLiked(true);

        if (userRating) {
          const ratingValue = typeof userRating === 'number' ? userRating : (userRating.rating || userRating.Rating);
          if (ratingValue) setNewRating(ratingValue);
        }
      } catch (error) {
        console.error("Lỗi kiểm tra trạng thái user:", error);
      }
    };

    checkUserStatus();
  }, [id, book?.id, currentUserId]);

  // 4. GỌI API LẤY REVIEWS
  useEffect(() => {
    const fetchReviews = async () => {
      if (!book?.id) return;
      setLoadingReviews(true);
      try {
        const data = await reviewService.getReviewsByBook(String(book.id));
        const sortedReviews = (data || []).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setBookReviews(sortedReviews);
        setVisibleReviewCount(INITIAL_REVIEW_COUNT); 
      } catch (error) {
        console.error("Lỗi lấy đánh giá:", error);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [book?.id]);

  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // ─── HANDLERS BẤM NÚT ───

  const handleBuy = async () => {
    if (isBuying || purchased || isAlreadyPurchased || !book) return;
    if (!userService.isLoggedIn()) {
      navigate('/login');
      return;
    }
    setIsBuying(true);
    try {
      await userService.purchaseBook(String(book.id));
      setPurchased(true);
      setIsAlreadyPurchased(true); 
    } catch (error: any) {
      alert(error.response?.data?.message || "Mua sách thất bại. Vui lòng thử lại.");
    } finally {
      setIsBuying(false);
    }
  };

  const handleToggleWishlist = async () => {
    if (isLiking || !book) return;
    if (!userService.isLoggedIn()) {
      navigate('/login');
      return;
    }
    setIsLiking(true);
    try {
      if (liked) {
        await userService.removeFavorite(String(book.id)); 
        setLiked(false);
      } else {
        await userService.addFavorite(String(book.id)); 
        setLiked(true);
      }
    } catch (error) {
      alert("Không thể cập nhật danh sách yêu thích.");
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitRating = async (star: number) => {
    if (!book) return;
    setIsSubmittingRating(true);
    setNewRating(star);
    try {
      await ratingService.addRating({ book_id: String(book.id), Rating: star });
      fetchBookDetail(true); 
    } catch (error) {
      setNewRating(0); 
      alert("Lỗi khi gửi điểm đánh giá.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleDeleteRating = async () => {
    if (!book || !currentUserId) return;
    setIsSubmittingRating(true);
    try {
      await ratingService.deleteRating(String(book.id), currentUserId);
      setNewRating(0); 
      fetchBookDetail(true); 
    } catch (error) {
      alert("Lỗi khi xóa điểm đánh giá.");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!newReviewText.trim() || !book) return;
    setIsSubmittingReview(true);
    
    try {
      const addedReview = await reviewService.addReview({
        book_id: String(book.id),
        Review: newReviewText
      });

      const optimisticReview = {
        id: (addedReview as any)?.id || Date.now().toString(),
        user_id: currentUserId,
        book_id: String(book.id),
        review: newReviewText, 
        time: (addedReview as any)?.time || new Date().toISOString(),
        user_name: 'Bạn', 
        is_purchased: isAlreadyPurchased 
      };

      setBookReviews(prev => [optimisticReview as any, ...prev]);
      setNewReviewText(''); 
    } catch (error: any) {
      alert(error.response?.data?.message || "Không thể gửi bình luận.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const confirmDeleteReview = async () => {
    if (!deleteConfirmId) return;
    try {
      await reviewService.deleteReview(deleteConfirmId);
      setBookReviews(prev => prev.filter(r => r.id !== deleteConfirmId)); 
    } catch (error) {
      alert("Không thể xóa bình luận.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pt-24 flex items-center justify-center">
        <div className="flex flex-col items-center">
           <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
           <p className="text-gray-500 dark:text-gray-400">Đang tải thông tin sách...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pt-24 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 text-lg mb-4">Không tìm thấy sách này</p>
          <button onClick={() => navigate('/')} className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium hover:opacity-90 transition-all">
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  const bookPrice = book.price || 0;
  const bookOriginalPrice = book.originalPrice || 0;
  const discount = bookOriginalPrice ? Math.round((1 - bookPrice / bookOriginalPrice) * 100) : 0;
  const bookGenres = book.genres || [];
  const genreData = genreInfo[bookGenres[0]?.toLowerCase() || ''];

  const ratingBreakdown = book.ratingBreakdown ? [
    { stars: 5, pct: book.ratingCount > 0 ? Math.round((book.ratingBreakdown[5] / book.ratingCount) * 100) : 0 },
    { stars: 4, pct: book.ratingCount > 0 ? Math.round((book.ratingBreakdown[4] / book.ratingCount) * 100) : 0 },
    { stars: 3, pct: book.ratingCount > 0 ? Math.round((book.ratingBreakdown[3] / book.ratingCount) * 100) : 0 },
    { stars: 2, pct: book.ratingCount > 0 ? Math.round((book.ratingBreakdown[2] / book.ratingCount) * 100) : 0 },
    { stars: 1, pct: book.ratingCount > 0 ? Math.round((book.ratingBreakdown[1] / book.ratingCount) * 100) : 0 },
  ] : [
    { stars: 5, pct: 68 }, { stars: 4, pct: 20 }, { stars: 3, pct: 8 }, { stars: 2, pct: 2 }, { stars: 1, pct: 2 },
  ];

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pb-20 relative">

      {/* POPUP XÓA BÌNH LUẬN */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#16152B] p-6 rounded-3xl max-w-sm w-full relative z-10 shadow-2xl border border-gray-100 dark:border-white/10"
            >
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Xóa bình luận</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 leading-relaxed">
                Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)} 
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  Hủy
                </button>
                <button 
                  onClick={confirmDeleteReview} 
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors shadow-sm"
                >
                  Xóa bỏ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Cinematic Hero ── */}
      <div ref={heroRef} className="relative min-h-[90vh] flex items-end overflow-hidden">
        <div className="absolute inset-0" style={{ transform: `translateY(${scrollY * 0.25}px)` }}>
          <img src={book.cover} alt="" className="w-full h-full object-cover scale-125" style={{ filter: 'blur(70px)', opacity: 0.6 }} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#F8F7F4]/40 dark:from-[#0D0C14]/40 via-[#F8F7F4]/50 dark:via-[#0D0C14]/60 to-[#F8F7F4] dark:to-[#0D0C14]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#F8F7F4]/20 dark:from-[#0D0C14]/20 to-transparent" />
        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(ellipse at 55% 35%, ${book.accentColor || '#4F46E5'}90, transparent 65%)` }} />

        <div className="absolute top-20 left-0 right-0 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors group z-20 relative"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Quay lại</span>
          </motion.button>
        </div>

        <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-16 pt-8 w-full z-10">
          <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-end">

            {/* Cover Column */}
            <motion.div initial={{ opacity: 0, y: 40, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative lg:w-72 xl:w-80 shrink-0 self-end">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl" style={{ aspectRatio: '2/3', filter: `drop-shadow(0 25px 50px ${book.accentColor || '#4F46E5'}60)` }}>
                <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 rounded-3xl ring-1 ring-white/20 pointer-events-none" />

                {book.badges && book.badges.length > 0 && (
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                    {book.badges.map((badgeName, index) => (
                      <span key={index} className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${badgeColors[badgeName] || 'bg-gray-800 text-white'}`}>
                        {badgeName}
                      </span>
                    ))}
                  </div>
                )}
                {book.status && (
                  <div className={`absolute bottom-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${book.status === 'complete' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
                    {book.status === 'complete' ? '✓ Hoàn thành' : '📖 Đang ra'}
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'Trang', value: `${book.pages || 0}` },
                  { label: 'Chương', value: `${book.chapters ?? Math.round((book.pages || 0) / 18)}` },
                  { label: 'Thời gian', value: book.readTime || 'N/A' },
                ].map(s => (
                  <div key={s.label} className="bg-white/70 dark:bg-white/8 backdrop-blur-sm rounded-2xl px-3 py-2.5 text-center border border-gray-100/80 dark:border-white/8">
                    <p className="text-gray-900 dark:text-white font-bold text-sm">{s.value}</p>
                    <p className="text-gray-400 text-[10px]">{s.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Info Column */}
            <div className="flex-1 min-w-0 space-y-5 pb-2">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="flex flex-wrap gap-2">
                <div className="flex gap-2">
                  {bookGenres.slice(0, 3).map((g, idx) => (
                    <span key={idx} className={`px-3 py-1 rounded-full text-xs font-semibold ${genreColors[g.toLowerCase()] || 'bg-gray-100 text-gray-700'}`}>
                      {idx === 0 && genreData?.emoji ? `${genreData.emoji} ` : ''}{g}
                    </span>
                  ))}
                </div>
                {book.language && (
                  <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-gray-100/80 dark:bg-white/8 text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-white/8">
                    <Globe className="w-3 h-3" /> {book.language}
                  </span>
                )}
              </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} className="text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                {book.title}
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="text-gray-500 dark:text-gray-400 text-lg">
                bởi <span className="text-gray-700 dark:text-gray-300 font-semibold">{book.author}</span>
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-5 h-5 ${s <= Math.round(book.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                  ))}
                  <span className="text-gray-900 dark:text-white font-bold text-lg ml-1">{book.rating || 'N/A'}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-sm">({(book.ratingCount || 0).toLocaleString()} đánh giá)</span>
                </div>
              </motion.div>

              <motion.p initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl text-[1.05rem]">
                {book.description}
              </motion.p>

              {bookOriginalPrice > 0 && discount > 0 && !isAlreadyPurchased && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, delay: 0.35 }} className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-gradient-to-r from-rose-50 to-orange-50 dark:from-rose-950/40 dark:to-orange-950/20 rounded-2xl border border-rose-100 dark:border-rose-800/30">
                  <Tag className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">Giảm {discount}% · Tiết kiệm {(bookOriginalPrice - bookPrice).toLocaleString('vi-VN')}₫</span>
                </motion.div>
              )}

              {/* BẢNG ĐIỀU KHIỂN & NÚT BẤM */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.4 }} className="flex flex-wrap items-center gap-4 pt-2">
                <div className="flex items-baseline gap-2">
                  {isAlreadyPurchased ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-black text-3xl">Sách của bạn</span>
                  ) : (
                    <>
                      <span className="text-3xl font-black text-gray-900 dark:text-white">{bookPrice.toLocaleString('vi-VN')}₫</span>
                      {bookOriginalPrice > 0 && <span className="text-gray-400 line-through text-lg">{bookOriginalPrice.toLocaleString('vi-VN')}₫</span>}
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleBuy}
                    disabled={isBuying || isAlreadyPurchased}
                    className={`flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold shadow-lg transition-all text-sm ${
                      isAlreadyPurchased 
                        ? 'bg-emerald-500 text-white shadow-emerald-200/60 cursor-default' 
                        : isBuying 
                          ? 'bg-indigo-400 text-white cursor-wait' 
                          : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-indigo-200/60 dark:shadow-indigo-900/40 hover:from-indigo-500 hover:to-violet-500'
                    }`}
                  >
                    {isBuying ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                    {isAlreadyPurchased ? '✓ Đã mua' : 'Mua ngay'}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-semibold transition-all text-sm ${
                      isAlreadyPurchased 
                        ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30' 
                        : 'bg-white/80 dark:bg-white/10 backdrop-blur-sm text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                    }`}
                  >
                    <Play className={`w-4 h-4 ${isAlreadyPurchased ? 'fill-current' : ''}`} /> 
                    {isAlreadyPurchased ? 'Đọc ngay' : 'Đọc thử'}
                  </motion.button>

                  {!isAlreadyPurchased && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleToggleWishlist}
                      disabled={isLiking}
                      className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-semibold transition-all text-sm ${
                        liked
                          ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                          : 'bg-white/80 dark:bg-white/10 backdrop-blur-sm text-gray-600 dark:text-gray-400 border border-gray-200/80 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                      }`}
                    >
                      {isLiking ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500 text-rose-500' : ''}`} />
                      )}
                      {liked ? 'Đã thích' : 'Yêu thích'}
                    </motion.button>
                  )}
                  <motion.button whileTap={{ scale: 0.97 }} className="w-12 h-12 bg-white/80 dark:bg-white/10 backdrop-blur-sm text-gray-600 dark:text-gray-400 border border-gray-200/80 dark:border-white/10 rounded-2xl flex items-center justify-center hover:border-gray-300 dark:hover:border-white/15 transition-all">
                    <Share2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

          {/* Left Sidebar */}
          <div className="lg:w-72 xl:w-80 shrink-0">
            <div className="sticky top-24 space-y-4">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white/80 dark:bg-[#16152B]/60 backdrop-blur-sm rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 space-y-3">
                <h3 className="text-gray-900 dark:text-white font-bold text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" /> Thông tin sách
                </h3>
                {[
                  { label: 'Tác giả', value: book.author },
                  { label: 'Thể loại', value: bookGenres, isTags: true }, // Cờ nhận biết dòng Thể loại
                  { label: 'Ngôn ngữ', value: book.language ?? 'Tiếng Việt' },
                  { label: 'Số trang', value: `${book.pages || 0} trang` },
                  { label: 'Số chương', value: `${book.chapters ?? Math.round((book.pages || 0) / 18)} chương` },
                  { label: 'Thời gian đọc', value: book.readTime || 'N/A' },
                  { label: 'Năm xuất bản', value: String(book.releaseYear || 'N/A') },
                  { label: 'Trạng thái', value: book.status === 'complete' ? 'Hoàn thành' : 'Đang ra' },
                ].map(item => (
                  <div 
                    key={item.label} 
                    className={`flex justify-between py-2 border-b border-gray-100/80 dark:border-white/5 last:border-0 ${item.isTags ? 'items-start flex-col gap-2.5 sm:flex-row' : 'items-center'}`}
                  >
                    <span className="text-gray-400 text-xs shrink-0">{item.label}</span>
                    {item.isTags ? (
                      <BookTagsDisplay tags={item.value as string[]} />
                    ) : (
                      <span className="text-gray-900 dark:text-white text-xs font-semibold max-w-[60%] text-right">{item.value as string}</span>
                    )}
                  </div>
                ))}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="bg-white/80 dark:bg-[#16152B]/60 backdrop-blur-sm rounded-3xl border border-gray-100/80 dark:border-white/8 p-5">
                <h3 className="text-gray-900 dark:text-white font-bold text-sm mb-3 flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-500" /> Về tác giả
                </h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {book.author ? book.author.split(' ').map(w => w[0]).join('').slice(0, 2) : 'A'}
                  </div>
                  <div>
                    <p className="text-gray-900 dark:text-white font-semibold text-sm">{book.author}</p>
                    <p className="text-gray-400 text-xs">Tác giả nổi tiếng</p>
                  </div>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed">
                  {book.author} là tác giả được yêu thích trong thể loại {bookGenres[0]}, với văn phong độc đáo. Cuốn sách "{book.title}" là một trong những tác phẩm tiêu biểu nhất.
                </p>
              </motion.div>
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 min-w-0 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="bg-white/80 dark:bg-[#16152B]/60 backdrop-blur-sm rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 sm:p-8">
              <h2 className="text-gray-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Giới thiệu
              </h2>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4 text-[0.95rem] whitespace-pre-line">{book.longDescription}</p>
            </motion.div>

            {book.previewText && (
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} className="bg-white/80 dark:bg-[#16152B]/60 backdrop-blur-sm rounded-3xl border border-gray-100/80 dark:border-white/8 overflow-hidden">
                <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-gray-100/80 dark:border-white/8 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 dark:from-indigo-900/40 dark:to-violet-900/40 flex items-center justify-center">
                      <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-gray-900 dark:text-white font-bold text-base">Đọc thử</h2>
                      <p className="text-gray-400 text-xs">Chương mở đầu</p>
                    </div>
                  </div>
                </div>

                <div className="relative px-6 sm:px-8 pt-6">
                  <div className="prose max-w-none text-gray-700 dark:text-gray-300" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', lineHeight: 1.85 }}>
                    {book.previewText.split('\n\n').map((para, i) => <p key={i} className="mb-4 last:mb-0">{para}</p>)}
                  </div>
                  {!showFullPreview && <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-white dark:from-[#16152B] to-transparent pointer-events-none" />}
                </div>

                <div className="px-6 sm:px-8 py-6 text-center">
                  {!showFullPreview ? (
                    <div className="space-y-3">
                      {!isAlreadyPurchased && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm">Tiếp tục đọc với toàn bộ nội dung sách</p>
                      )}
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        {!isAlreadyPurchased && (
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleBuy} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-indigo-200/60 hover:opacity-90">
                            <ShoppingCart className="w-4 h-4" /> Mua để đọc tiếp · {bookPrice.toLocaleString('vi-VN')}₫
                          </motion.button>
                        )}
                        <button onClick={() => setShowFullPreview(true)} className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold text-sm hover:underline">
                          Xem thêm preview <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    !isAlreadyPurchased && (
                      <div className="space-y-3">
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleBuy} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold text-sm mx-auto shadow-lg shadow-indigo-200/60 hover:opacity-90">
                          <ShoppingCart className="w-4 h-4" /> Mua ngay · {bookPrice.toLocaleString('vi-VN')}₫
                        </motion.button>
                      </div>
                    )
                  )}
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} className="bg-white/80 dark:bg-[#16152B]/60 backdrop-blur-sm rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-gray-900 dark:text-white font-bold">Đánh giá từ độc giả</h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 mb-8 p-5 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-white/5 dark:to-white/3 rounded-2xl border border-gray-100/80 dark:border-white/8">
                <div className="text-center sm:shrink-0">
                  <div className="text-gray-900 dark:text-white mb-1" style={{ fontSize: '3.5rem', fontWeight: 900, fontFamily: 'var(--font-serif)', lineHeight: 1 }}>
                    {book.rating || 'N/A'}
                  </div>
                  <div className="flex justify-center gap-0.5 mb-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= Math.round(book.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600'}`} />
                    ))}
                  </div>
                  <p className="text-gray-400 text-xs">{(book.ratingCount || 0).toLocaleString()} đánh giá</p>
                </div>

                <div className="flex-1 space-y-2">
                  {ratingBreakdown.map(item => (
                    <div key={item.stars} className="flex items-center gap-3">
                      <div className="flex items-center gap-0.5 w-12 shrink-0 justify-end">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{item.stars}</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      </div>
                      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                        <motion.div initial={{ width: 0 }} whileInView={{ width: `${item.pct}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: (5 - item.stars) * 0.06, ease: 'easeOut' }} className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
                      </div>
                      <span className="text-xs text-gray-400 w-8 shrink-0">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {userService.isLoggedIn() && (
                <div className="flex flex-col gap-4 mb-8">
                  {/* BẢNG CHO ĐIỂM SAO */}
                  <div className="bg-white dark:bg-white/5 rounded-2xl p-5 border border-gray-200/60 dark:border-white/10 shadow-sm flex flex-col justify-center items-center text-center relative">
                    <div className="flex w-full justify-between items-start mb-2 px-2">
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">Cho điểm cuốn sách</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Nhấn vào ngôi sao để đánh giá</p>
                      </div>
                      {newRating > 0 && (
                        <button 
                          onClick={handleDeleteRating}
                          disabled={isSubmittingRating}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-200 text-gray-600 dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-300 font-medium flex items-center transition-colors"
                        >
                          {isSubmittingRating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Xóa đánh giá'}
                        </button>
                      )}
                    </div>
                    
                    <div className="flex gap-1.5" onMouseLeave={() => setHoverRating(0)}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button 
                          key={star} 
                          type="button"
                          onClick={() => handleSubmitRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          className="p-1 focus:outline-none transition-transform hover:scale-110"
                        >
                          <Star className={`w-8 h-8 ${(hoverRating || newRating) >= star ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-700'} transition-colors`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* BẢNG BÌNH LUẬN TEXT */}
                  <div className="bg-white dark:bg-white/5 rounded-2xl p-5 border border-gray-200/60 dark:border-white/10 shadow-sm flex flex-col">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Viết bình luận của bạn</h3>
                    <textarea 
                      value={newReviewText}
                      onChange={(e) => setNewReviewText(e.target.value)}
                      placeholder="Chia sẻ cảm nhận về cốt truyện, nhân vật..."
                      className="flex-1 min-h-[80px] w-full bg-gray-50 dark:bg-[#0D0C14] border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-colors resize-none mb-3"
                    />
                    <div className="flex justify-end mt-auto">
                      <button 
                        onClick={handleSubmitReview}
                        disabled={isSubmittingReview || !newReviewText.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                      >
                        {isSubmittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Gửi bình luận
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {loadingReviews ? (
                   <div className="flex justify-center py-6"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
                ) : bookReviews.length > 0 ? (
                  <AnimatePresence initial={false}>
                    {bookReviews.slice(0, visibleReviewCount).map((review) => {
                      const isMyReview = review.user_id === currentUserId;
                      const reviewerName = (review as any).full_name || (isMyReview ? "Bạn" : "Độc giả");
                      const reviewerAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(reviewerName)}&background=random&color=fff`;
                      const isReviewerPurchased = (review as any).is_purchased === true; 

                      return (
                        <motion.div 
                          key={review.id} 
                          initial={{ opacity: 0, height: 0, scale: 0.95 }}
                          animate={{ opacity: 1, height: 'auto', scale: 1 }}
                          exit={{ opacity: 0, height: 0, scale: 0.95, overflow: 'hidden' }}
                          transition={{ duration: 0.4, type: 'spring', bounce: 0.3 }}
                          className="bg-gray-50/80 dark:bg-white/5 rounded-2xl p-4 sm:p-5 border border-gray-100/80 dark:border-white/8 relative"
                        >
                          <div className="flex items-start gap-3 mb-2 pr-8">
                            <img src={reviewerAvatar} alt={reviewerName} className="w-10 h-10 rounded-full shadow-sm object-cover" />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                <p className="text-gray-900 dark:text-white font-semibold text-sm">{reviewerName}</p>
                                {isReviewerPurchased && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                                    ✓ Đã mua
                                  </span>
                                )}
                                <p className="text-gray-400 text-xs ml-auto shrink-0">{new Date(review.time).toLocaleDateString('vi-VN')}</p>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap ml-[52px]">
                            {review.review}
                          </p>

                          {/* Menu Dropdown (...) */}
                          <div className="absolute top-4 right-4">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(activeDropdownId === review.id ? null : review.id);
                              }}
                              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors z-50 relative"
                            >
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                            
                            <AnimatePresence>
                              {activeDropdownId === review.id && (
                                <motion.div 
                                  onClick={(e) => e.stopPropagation()} 
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.1 }}
                                  className="absolute right-0 top-10 mt-1 w-40 bg-white dark:bg-[#1A1930] shadow-xl rounded-xl border border-gray-100 dark:border-white/10 z-50 overflow-hidden"
                                >
                                  <button className="w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 text-sm text-gray-700 dark:text-gray-300 font-medium transition-colors">
                                    Báo cáo
                                  </button>
                                  {isMyReview && (
                                    <>
                                      <button className="w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 text-sm text-gray-700 dark:text-gray-300 font-medium transition-colors border-t border-gray-100 dark:border-white/5">
                                        Chỉnh sửa
                                      </button>
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setActiveDropdownId(null); 
                                          setDeleteConfirmId(review.id); 
                                        }}
                                        className="w-full text-left px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-white/5 text-sm text-gray-700 dark:text-gray-300 font-medium transition-colors border-t border-gray-100 dark:border-white/5"
                                      >
                                        Xóa bình luận
                                      </button>
                                    </>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <p className="text-center text-gray-500 text-sm py-6">Chưa có bình luận nào cho cuốn sách này.</p>
                )}
              </div>

              {bookReviews.length > visibleReviewCount && (
                <button 
                  onClick={() => setVisibleReviewCount(prev => prev + LOAD_MORE_COUNT)}
                  className="mt-5 w-full py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 text-gray-700 dark:text-gray-300 rounded-2xl font-medium text-sm transition-colors border border-gray-100/80 dark:border-white/8"
                >
                  Xem thêm đánh giá ({bookReviews.length - visibleReviewCount} còn lại)
                </button>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── BẠN CŨNG CÓ THỂ SẼ THÍCH (DẠNG BOOKSHELF) ── */}
      {recommendedBooks.length > 0 && !loadingRecommendations && (
        <RecommendationsShelf 
          books={recommendedBooks} 
          title="Bạn cũng có thể sẽ thích" 
          subtitle="Các tác phẩm nổi bật được chọn lọc" 
          emoji="✨" 
          onOpenBook={onOpenBook} 
        />
      )}

    </div>
  );
}

// ── COMPONENT HIỂN THỊ THỂ LOẠI (TAGS) ──
function BookTagsDisplay({ tags }: { tags: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate(); // Sử dụng hook điều hướng của react-router

  if (!tags || tags.length === 0) return <span className="text-gray-500 text-xs">Đang cập nhật</span>;

  // Bảng màu Pastel cho Light/Dark mode (Đã bổ sung thêm hiệu ứng màu khi hover)
  const TAG_COLORS = [
    'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/30',
    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20 hover:bg-purple-100 dark:hover:bg-purple-500/30',
    'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/30',
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/30',
    'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/30',
    'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 hover:bg-indigo-100 dark:hover:bg-indigo-500/30'
  ];

  // Hàm tạo mã màu cố định dựa trên tên tag
  const getTagColor = (tag: string) => {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
  };

  // Hàm xử lý khi người dùng ấn vào tag
  const handleTagClick = (tag: string) => {
    // Chuyển thành chữ thường và thay thế khoảng trắng bằng dấu gạch ngang (nếu có)
    // Ví dụ: "Science Fiction" -> "science-fiction", "anthropomorphism" -> "anthropomorphism"
    const formattedTag = tag.trim().toLowerCase().replace(/\s+/g, '-');
    navigate(`/genre/${formattedTag}`);
  };

  const VISIBLE_COUNT = 5; 
  const hiddenCount = tags.length - VISIBLE_COUNT;
  const visibleTags = isExpanded ? tags : tags.slice(0, VISIBLE_COUNT);

  return (
    <div className="flex flex-col sm:items-end w-full">
      <div className="flex flex-wrap gap-1.5 sm:justify-end">
        {visibleTags.map((tag, idx) => (
          <button
            key={idx}
            onClick={() => handleTagClick(tag)}
            title={`Xem thêm các sách thể loại ${tag}`}
            className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold whitespace-nowrap transition-all transform hover:scale-105 cursor-pointer shadow-sm ${getTagColor(tag)}`}
          >
            {tag}
          </button>
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 mt-1.5 transition-colors font-medium"
        >
          {isExpanded ? (
            <>Thu gọn <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>+ {hiddenCount} thể loại khác <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

// ── COMPONENT BOOKSHELF ĐỀ XUẤT ──
function RecommendationsShelf({ books, title, subtitle, emoji, onOpenBook }: { books: Book[], title: string, subtitle: string, emoji: string, onOpenBook: (b: Book) => void }) {
  const shelfRef = useRef<HTMLElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(6);

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

  const nextSlide = () => setCurrentIndex(p => Math.min(p + 1, Math.max(0, books.length - cardsToShow)));
  const prevSlide = () => setCurrentIndex(p => Math.max(p - 1, 0));
  const visibleBooks = books.slice(currentIndex, currentIndex + cardsToShow);

  return (
    <motion.section
      ref={shelfRef}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      className="relative min-h-[300px] mt-4"
    >
      <div className="flex items-center justify-between mb-5 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          {emoji && <span className="text-2xl">{emoji}</span>}
          <div>
            <h2 className="text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 700 }}>
              {title}
            </h2>
            {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={prevSlide} disabled={currentIndex === 0} className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors shadow-sm">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextSlide} disabled={currentIndex >= books.length - cardsToShow} className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors shadow-sm">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-4 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {visibleBooks.map((book, idx) => (
            <motion.div key={`${book.id}-${idx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
              <BookCard book={book} onOpen={() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                onOpenBook(book);
              }} />
            </motion.div>
          ))}
        </div>
      </div>

      <div className="h-px max-w-[1400px] mx-auto mt-2 px-4 sm:px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
      </div>
    </motion.section>
  );
}