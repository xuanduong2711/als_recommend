import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { MOODS } from '../data/books';
import type { Book } from '../data/books';
import { BookCard } from './BookCard';
import { useBooks } from '../hooks/useBooks';

interface MoodSectionProps {
  onOpenBook: (book: Book) => void;
}

export function MoodSection({ onOpenBook }: MoodSectionProps) {
  const { books } = useBooks();
  const [selectedMood, setSelectedMood] = useState(MOODS[0].id);

  // --- LOGIC CAROUSEL ---
  const [startIndex, setStartIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(5);

  // 1. Lọc sách (lấy tối đa 10 cuốn)
  const filteredBooks = books.filter(b => {
    if (!b.mood) return false;
    const moodString = (Array.isArray(b.mood) ? b.mood.join(' ') : String(b.mood)).toLowerCase();
    return moodString.includes(selectedMood.toLowerCase());
  }).slice(0, 10);

  // 2. Tính toán số thẻ hiển thị dựa trên kích thước màn hình
  useEffect(() => {
    const updateCardsToShow = () => {
      if (window.innerWidth >= 1280) setCardsToShow(5);      // xl
      else if (window.innerWidth >= 1024) setCardsToShow(4); // lg
      else if (window.innerWidth >= 768) setCardsToShow(3);  // md
      else setCardsToShow(2);                                // sm & mobile
    };
    updateCardsToShow();
    window.addEventListener('resize', updateCardsToShow);
    return () => window.removeEventListener('resize', updateCardsToShow);
  }, []);

  // 3. Reset carousel khi đổi Mood
  useEffect(() => {
    setStartIndex(0);
  }, [selectedMood]);

  // 4. Auto-play: Tự động trượt sau mỗi 4 giây
  useEffect(() => {
    // Không cần tự trượt nếu số sách lọc ra ít hơn hoặc bằng số slot hiển thị
    if (filteredBooks.length <= cardsToShow) return;

    const interval = setInterval(() => {
      setStartIndex((prev) => (prev + 1) % filteredBooks.length);
    }, 4000);

    // Dọn dẹp interval khi component unmount hoặc re-render
    return () => clearInterval(interval);
  }, [filteredBooks.length, cardsToShow, selectedMood, startIndex]);

  // 5. Hàm điều khiển thủ công
  const nextSlide = () => {
    if (filteredBooks.length > 0) {
      setStartIndex((prev) => (prev + 1) % filteredBooks.length);
    }
  };

  const prevSlide = () => {
    if (filteredBooks.length > 0) {
      setStartIndex((prev) => (prev - 1 + filteredBooks.length) % filteredBooks.length);
    }
  };

  // 6. Cắt mảng cửa sổ hiển thị
  const visibleBooks = [];
  if (filteredBooks.length > 0) {
    if (filteredBooks.length <= cardsToShow) {
      // Nếu ít sách hơn giới hạn, chỉ việc hiển thị hết, không lặp
      visibleBooks.push(...filteredBooks);
    } else {
      // Cắt mảng theo kiểu lặp vòng
      for (let i = 0; i < cardsToShow; i++) {
        visibleBooks.push(filteredBooks[(startIndex + i) % filteredBooks.length]);
      }
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="bg-gradient-to-br from-indigo-50 via-violet-50/50 to-purple-50 dark:from-indigo-950/30 dark:via-violet-950/20 dark:to-purple-950/30 rounded-3xl overflow-hidden mx-4 sm:mx-6 lg:mx-8 max-w-[calc(1400px-4rem)] xl:mx-auto relative"
    >
      <div className="px-6 sm:px-8 py-8">
        
        {/* Header với 2 Nút điều hướng */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-200 dark:shadow-violet-900/30">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2
                className="text-gray-900 dark:text-white"
                style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 700 }}
              >
                Hôm nay bạn muốn đọc gì?
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Chọn trạng thái — chúng tôi sẽ gợi ý cuốn sách phù hợp</p>
            </div>
          </div>

          {/* Mũi tên điều hướng (Chỉ hiện khi số sách > số slot đang hiện) */}
          {filteredBooks.length > cardsToShow && (
            <div className="flex items-center gap-2">
              <button
                onClick={prevSlide}
                className="w-9 h-9 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/20 hover:scale-105 transition-all shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextSlide}
                className="w-9 h-9 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/20 hover:scale-105 transition-all shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Mood selector */}
        <div className="flex flex-wrap gap-2.5 mt-5 mb-6">
          {MOODS.map((mood) => (
            <motion.button
              key={mood.id}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setSelectedMood(mood.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${
                selectedMood === mood.id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30'
                  : 'bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50'
              }`}
            >
              <span className="text-base leading-none">{mood.emoji}</span>
              <span>{mood.label}</span>
              {selectedMood === mood.id && (
                <motion.span
                  layoutId="mood-active"
                  className="w-1.5 h-1.5 rounded-full bg-white/70"
                />
              )}
            </motion.button>
          ))}
        </div>

        {/* Books Grid thay vì scroll ngang */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedMood}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {visibleBooks.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-2">
                {visibleBooks.map((book, idx) => (
                  <motion.div
                    key={`${book.id}-${idx}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <BookCard book={book} onOpen={onOpenBook} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-sm py-8 text-center">
                Chưa có sách cho tâm trạng này. Hãy thử tâm trạng khác!
              </p>
            )}
          </motion.div>
        </AnimatePresence>
        
      </div>
    </motion.section>
  );
}