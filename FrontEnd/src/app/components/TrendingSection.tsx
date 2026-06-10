import { motion } from 'motion/react';
import { TrendingUp, Star, ShoppingCart, Flame } from 'lucide-react';
import { NavLink } from 'react-router';
import { badgeColors, genreColors } from '../data/books';
import type { Book } from '../data/books';
import { useBookCollections } from '../hooks/useBooks';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface TrendingSectionProps {
  onOpenBook: (book: Book) => void;
}

const rankColors = [
  'from-amber-400 to-orange-500',
  'from-slate-300 to-slate-400',
  'from-amber-600 to-amber-700',
  'from-indigo-400 to-indigo-500',
  'from-rose-400 to-rose-500',
  'from-emerald-400 to-emerald-500',
];

export function TrendingSection({ onOpenBook }: TrendingSectionProps) {
  const { trendingBooks } = useBookCollections();
  const formatPrice = (p: number) => p.toLocaleString('vi-VN') + '₫';

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-200 dark:shadow-orange-900/30">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2
              className="text-gray-900 dark:text-white"
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.1rem, 2vw, 1.4rem)', fontWeight: 700 }}
            >
              Hot nhất mọi thời đại
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Được nhiều lượt tương tác nhất</p>
          </div>
        </div>
        <NavLink to="/trending" className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors">
          <TrendingUp className="w-4 h-4" />
          Xem toàn bộ
        </NavLink>
      </div>

      {/* Two layout: top 3 + bottom 3 */}
      <div className="space-y-4">

        {/* Top 3 - bigger cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {trendingBooks.slice(0, 3).map((book, idx) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              whileHover={{ y: -6 }}
              onClick={() => onOpenBook(book)}
              className="relative bg-white dark:bg-[#16152B] rounded-3xl overflow-hidden cursor-pointer group shadow-sm hover:shadow-xl transition-all duration-300"
            >
              <div className="flex gap-4 p-4">
                {/* Rank */}
                <div className={`shrink-0 w-8 h-8 rounded-2xl bg-gradient-to-br ${rankColors[idx]} flex items-center justify-center text-white font-black text-sm shadow-md`}>
                  {idx + 1}
                </div>

                {/* Cover */}
                <div className="shrink-0 w-16 rounded-xl overflow-hidden shadow-md" style={{ aspectRatio: '2/3' }}>
                  <ImageWithFallback
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
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
                      <h3 className="text-gray-900 dark:text-white font-bold text-sm leading-tight line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" style={{ fontFamily: 'var(--font-serif)' }}>
                        {book.title}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{book.author}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 mt-2">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{book.rating}</span>
                    <span className="text-xs text-gray-400">({book.ratingCount.toLocaleString()})</span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-gray-900 dark:text-white font-bold text-sm">{formatPrice(book.price)}</span>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={e => { e.stopPropagation(); onOpenBook(book); }}
                      className="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-500/30 transition-colors"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* Popularity bar */}
              <div className="h-1 bg-gray-100 dark:bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${book.popularity}%` }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                  className={`h-full bg-gradient-to-r ${rankColors[idx]} rounded-full`}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom 3 - compact list rows */}
        <div className="bg-white dark:bg-[#16152B] rounded-3xl overflow-hidden shadow-sm">
          {trendingBooks.slice(3, 6).map((book, idx) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              onClick={() => onOpenBook(book)}
              className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group ${idx < 2 ? 'border-b border-gray-100 dark:border-white/5' : ''}`}
            >
              <div className={`shrink-0 w-7 h-7 rounded-xl bg-gradient-to-br ${rankColors[3 + idx]} flex items-center justify-center text-white font-black text-xs`}>
                {4 + idx}
              </div>
              <div className="shrink-0 w-10 rounded-lg overflow-hidden shadow-sm" style={{ aspectRatio: '2/3' }}>
                <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-gray-900 dark:text-white font-semibold text-sm truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {book.title}
                </h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs">{book.author}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-gray-900 dark:text-white font-bold text-sm">{formatPrice(book.price)}</p>
                <div className="flex items-center gap-0.5 justify-end">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">{book.rating}</span>
                </div>
              </div>
              <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold hidden sm:block ${genreColors[book.genres?.[0]?.toLowerCase() || ''] || 'bg-gray-100 text-gray-600'}`}>
                {book.genres?.[0]}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}