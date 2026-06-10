import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Star, BookOpen, ShoppingCart, Play } from 'lucide-react';
import { badgeColors, genreColors } from '../data/books';
import type { Book } from '../data/books';
import { useBookCollections } from '../hooks/useBooks';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface HeroCarouselProps {
  onOpenBook: (book: Book) => void;
}

export function HeroCarousel({ onOpenBook }: HeroCarouselProps) {
  const { heroBooks } = useBookCollections();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  const next = useCallback(() => {
    setDirection('next');
    setCurrent(c => (c + 1) % heroBooks.length);
  }, [heroBooks.length]);

  const prev = useCallback(() => {
    setDirection('prev');
    setCurrent(c => (c - 1 + heroBooks.length) % heroBooks.length);
  }, [heroBooks.length]);

  useEffect(() => {
    const id = setInterval(next, 5500);
    return () => clearInterval(id);
  }, [next]);

  if (!heroBooks || heroBooks.length === 0) return null;

  const book = heroBooks[current];

  if (!book) return null;

  const variants = {
    enter: (dir: 'next' | 'prev') => ({ x: dir === 'next' ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: 'next' | 'prev') => ({ x: dir === 'next' ? -60 : 60, opacity: 0 }),
  };

  const formatPrice = (p: number) => p.toLocaleString('vi-VN') + '₫';

  return (
    <section className="relative min-h-[88vh] flex items-center overflow-hidden bg-[#F8F7F4] dark:bg-[#0D0C14]">

      <AnimatePresence mode="wait">
        <motion.div
          key={book.id + '-bg'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          className="absolute inset-0 z-0"
        >
          <div
            className="absolute inset-0 opacity-20 dark:opacity-30"
            style={{ background: `radial-gradient(ellipse 70% 60% at 65% 50%, ${book.accentColor || '#4F46E5'}40, transparent)` }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#F8F7F4] via-[#F8F7F4]/80 to-transparent dark:from-[#0D0C14] dark:via-[#0D0C14]/70 dark:to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full opacity-20"
            style={{
              width: Math.random() * 120 + 40,
              height: Math.random() * 120 + 40,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              background: book.accentColor || '#4F46E5',
              filter: 'blur(40px)',
            }}
            animate={{ y: [0, -30, 0], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 5 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 w-full pt-20 pb-12">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={book.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center gap-2">
                {/* <div className="flex gap-2">
                  {book.genres?.slice(0, 3).map((g, idx) => (
                    <span key={idx} className={`px-3 py-1 rounded-full text-xs font-semibold ${genreColors[g.toLowerCase()] || 'bg-gray-100 text-gray-700'}`}>
                      {g}
                    </span>
                  ))}
                </div> */}
                {book.badges && book.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {book.badges.map((badgeName, index) => (
                      <span 
                        key={index} 
                        className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          badgeColors[badgeName] || 'bg-gray-200 text-gray-800' // Fallback nếu màu chưa có
                        }`}
                      >
                        {badgeName}
                      </span>
                    ))}
                  </div>
                )}
                <span className="text-sm text-gray-500 dark:text-gray-400">{book.releaseYear}</span>
              </div>

              <div>
                <h1
                  className="text-gray-900 dark:text-white mb-3 leading-tight cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenBook(book); }}
                  style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3.5rem)', fontWeight: 700, lineHeight: 1.15 }}
                >
                  {book.title}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-base">
                  bởi <span className="text-gray-700 dark:text-gray-300 font-medium">{book.author}</span>
                  &ensp;·&ensp; {book.pages} trang &ensp;·&ensp; {book.readTime}
                </p>
              </div>

              <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed max-w-lg">
                {book.longDescription}
              </p>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 ${i < Math.floor(book.rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  ))}
                </div>
                <span className="text-gray-700 dark:text-gray-300 font-semibold">{book.rating}</span>
                <span className="text-gray-400 text-sm">({book.ratingCount.toLocaleString()} đánh giá)</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{formatPrice(book.price)}</span>
                  {book.originalPrice && (
                    <span className="text-lg text-gray-400 line-through">{formatPrice(book.originalPrice)}</span>
                  )}
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenBook(book); }}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 transition-all"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Mua ngay
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenBook(book); }}
                    className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/15 rounded-2xl font-semibold hover:bg-gray-50 dark:hover:bg-white/15 transition-all"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Đọc thử
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="relative flex justify-center items-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={book.id + '-cover'}
                custom={direction}
                initial={{ opacity: 0, x: 80, rotateY: 25 }}
                animate={{ opacity: 1, x: 0, rotateY: 0 }}
                exit={{ opacity: 0, x: -80, rotateY: -25 }}
                transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
                className="relative cursor-pointer"
                style={{ perspective: '1200px' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenBook(book); }}
              >
                <div
                  className="absolute inset-0 rounded-3xl opacity-50 blur-2xl scale-90 translate-y-4 pointer-events-none"
                  style={{ background: book.accentColor }}
                />

                <motion.div
                  whileHover={{ rotateY: -5, rotateX: 3, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="relative w-56 sm:w-72 rounded-3xl overflow-hidden shadow-2xl"
                  style={{ aspectRatio: '2/3' }}
                >
                  <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="absolute -bottom-4 -left-8 bg-white dark:bg-[#1A1A2E] rounded-2xl p-3 shadow-xl border border-gray-100 dark:border-white/8 flex items-center gap-3 pointer-events-none"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                    <BookOpen className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Đang đọc</p>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">2,341 người</p>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center justify-between mt-12">
          <div className="flex items-center gap-3">
            {heroBooks.map((_, i) => (
              <button
                key={i}
                onClick={() => { setDirection(i > current ? 'next' : 'prev'); setCurrent(i); }}
                className={`transition-all duration-300 rounded-full ${i === current ? 'w-8 h-2.5 bg-indigo-600' : 'w-2.5 h-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prev} className="w-10 h-10 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors shadow-sm">
              <ChevronLeft className="w-4.5 h-4.5" />
            </button>
            <button onClick={next} className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
              <ChevronRight className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}