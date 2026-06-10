import { useState } from 'react';
import { motion } from 'motion/react';
import { Star } from 'lucide-react';
import { Book, badgeColors } from '../data/books';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface BookCardProps {
  book: Book;
  onOpen: (book: Book) => void;
  size?: 'sm' | 'md' | 'lg';
}

export function BookCard({ book, onOpen, size = 'md' }: BookCardProps) {
  const [hovered, setHovered] = useState(false);

  const formatPrice = (p: number) => p.toLocaleString('vi-VN') + '₫';
  const widths = { sm: 'w-32', md: 'w-40 sm:w-44', lg: 'w-52 sm:w-60' };

  return (
    <motion.div
      className={`relative shrink-0 ${widths[size]} cursor-pointer group`}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      // Click vào bất kỳ đâu trên thẻ đều sẽ mở sách
      onClick={() => onOpen(book)}
    >
      <div className="relative rounded-2xl overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-300" style={{ aspectRatio: '2/3' }}>
        <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        
        {/* Hiệu ứng bóng đen mờ khi hover để làm nổi bật bìa */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Viền sáng màu (Accent color) khi hover */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={hovered ? { boxShadow: `0 0 24px 2px ${book.accentColor}60` } : { boxShadow: 'none' }}
          transition={{ duration: 0.3 }}
        />

        {/* HIỂN THỊ BADGES XẾP DỌC BÊN TRÁI CARD */}
        {book.badges && book.badges.length > 0 && (
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 pointer-events-none">
            {book.badges.map((badgeName, index) => (
              <span 
                key={index} 
                className={`w-fit px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                  badgeColors[badgeName] || 'bg-gray-800 text-white' 
                }`}
              >
                {badgeName}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 px-0.5">
        <h3 className="text-gray-900 dark:text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {book.title}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 truncate">{book.author}</p>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-gray-900 dark:text-white font-bold text-sm">{formatPrice(book.price)}</span>
            {book.originalPrice && <span className="text-gray-400 text-xs line-through">{formatPrice(book.originalPrice)}</span>}
          </div>
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{book.rating}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}