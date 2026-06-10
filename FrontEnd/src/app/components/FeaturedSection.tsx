import { motion } from 'motion/react';
import { Star, ShoppingCart, Play, BookOpen } from 'lucide-react';
import { badgeColors, genreColors } from '../data/books';
import type { Book } from '../data/books';
import { useBookCollections } from '../hooks/useBooks';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface FeaturedSectionProps {
  onOpenBook: (book: Book) => void;
}

export function FeaturedSection({ onOpenBook }: FeaturedSectionProps) {
  const { featuredBook, mosaicBooks } = useBookCollections();
  const formatPrice = (p: number) => p.toLocaleString('vi-VN') + '₫';

  if (!featuredBook) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-2xl">✨</span>
        <div>
          <h2
            className="text-gray-900 dark:text-white"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 700 }}
          >
            Sách nổi bật trong tháng
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Được chọn lọc bởi đội ngũ biên tập</p>
        </div>
      </div>

      {/* Mosaic layout */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Large featured card */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          onClick={() => onOpenBook(featuredBook)}
          className="lg:col-span-3 relative rounded-3xl overflow-hidden cursor-pointer group"
          style={{ minHeight: 420 }}
        >
          {/* Background image */}
          <ImageWithFallback
            src={featuredBook.cover}
            alt={featuredBook.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <div
            className="absolute inset-0 opacity-40"
            style={{ background: `linear-gradient(135deg, ${featuredBook.accentColor}40 0%, transparent 60%)` }}
          />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <div className="flex gap-2">
                {/* <div className="flex gap-2">
                  {featuredBook.genres?.slice(0, 3).map((g, idx) => (
                    <span key={idx} className={`px-3 py-1 rounded-full text-xs font-semibold ${genreColors[g.toLowerCase()] || 'bg-white/20 text-white'}`}>
                      {g}
                    </span>
                  ))}
                </div> */}
                  {featuredBook.badges && featuredBook.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1">
                    {featuredBook.badges.map((badgeName, index) => (
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
              </div>
              <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span className="text-white text-xs font-semibold">{featuredBook.rating}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3
                  className="text-white mb-1"
                  style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 700, lineHeight: 1.2 }}
                >
                  {featuredBook.title}
                </h3>
                <p className="text-gray-300 text-sm">bởi {featuredBook.author}</p>
              </div>

              <p className="text-gray-300 text-sm leading-relaxed line-clamp-2 hidden sm:block">
                {featuredBook.longDescription}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-2xl font-bold">{formatPrice(featuredBook.price)}</span>
                  {featuredBook.originalPrice && (
                    <span className="text-gray-400 line-through text-sm">{formatPrice(featuredBook.originalPrice)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={e => { e.stopPropagation(); onOpenBook(featuredBook); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white/15 backdrop-blur-sm text-white border border-white/25 rounded-xl text-sm font-semibold hover:bg-white/25 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Đọc thử
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={e => { e.stopPropagation(); onOpenBook(featuredBook); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-white text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-100 transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Mua ngay
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Smaller mosaic cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          {mosaicBooks.map((book, idx) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.45 }}
              whileHover={{ scale: 1.03, y: -4 }}
              onClick={() => onOpenBook(book)}
              className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-md"
              style={{ minHeight: 190 }}
            >
              <ImageWithFallback
                src={book.cover}
                alt={book.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

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

              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-white text-xs font-bold leading-tight line-clamp-2" style={{ fontFamily: 'var(--font-serif)' }}>
                  {book.title}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-300 text-[10px]">{book.author}</span>
                  <span className="text-white text-xs font-bold">{formatPrice(book.price)}</span>
                </div>
              </div>

              {/* Hover overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center"
              >
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-4.5 h-4.5 text-indigo-700" />
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
