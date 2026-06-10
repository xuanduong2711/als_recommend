import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Book } from '../data/books';
import { BookCard } from './BookCard';
import { Skeleton } from './ui/skeleton';
import { bookService } from '../../services/bookService';

interface BookShelfProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  genre?: string; 
  books?: Book[]; 
  onOpenBook: (book: Book) => void;
  accentColor?: string;
}

export function BookShelf({ title, subtitle, emoji, genre, books: propBooks, onOpenBook, accentColor = '#4F46E5' }: BookShelfProps) {
  const [fetchedBooks, setFetchedBooks] = useState<Book[]>([]);
  
  // Trạng thái loading nội bộ (chỉ bật khi bắt đầu gọi API)
  const [isFetching, setIsFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  
  const [startIndex, setStartIndex] = useState(0);
  const [cardsToShow, setCardsToShow] = useState(6);
  const [isVisible, setIsVisible] = useState(false);
  const shelfRef = useRef<HTMLDivElement>(null);

  const displayBooks = propBooks !== undefined ? propBooks : fetchedBooks;

  // Nếu cha không truyền sách xuống và chưa fetch xong -> Đang loading
  const isLoading = propBooks === undefined && (!hasFetched || isFetching);

  useEffect(() => {
    if (propBooks) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); 
        }
      },
      { rootMargin: '300px' } 
    );

    if (shelfRef.current) observer.observe(shelfRef.current);
    return () => observer.disconnect();
  }, [propBooks]); 

  useEffect(() => {
    if (!isVisible) return; 
    
    // NẾU ĐÃ CÓ SÁCH HOẶC KHÔNG CÓ GENRE -> KHÔNG GỌI API (Đúng ý bạn)
    if (propBooks !== undefined || !genre) {
      setHasFetched(true);
      return; 
    }

    let isMounted = true;
    const fetchShelfBooks = async () => {
      setIsFetching(true);
      try {
        const response = await bookService.getBooks({ Genre: genre, PageSize: 20 });
        if (isMounted) setFetchedBooks(response?.items || []);
      } catch (error) {
        console.error(`Lỗi tải kệ sách ${title}:`, error);
      } finally {
        if (isMounted) {
          setIsFetching(false);
          setHasFetched(true);
        }
      }
    };

    fetchShelfBooks();
    return () => { isMounted = false; };
  }, [isVisible, genre, propBooks]); 

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

  // Ẩn kệ sách nếu đã load xong mà API trả về mảng rỗng (Tránh để lại khoảng trống vô duyên)
  if (!isLoading && displayBooks.length === 0) return null;

  const nextSlide = () => setStartIndex((prev) => (prev + 1) % displayBooks.length);
  const prevSlide = () => setStartIndex((prev) => (prev - 1 + displayBooks.length) % displayBooks.length);

  const visibleBooks = [];
  if (displayBooks.length > 0) {
    for (let i = 0; i < Math.min(cardsToShow, displayBooks.length); i++) {
      visibleBooks.push(displayBooks[(startIndex + i) % displayBooks.length]);
    }
  }

  return (
    <motion.section
      ref={shelfRef}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
      className="relative min-h-[300px]"
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
          <button onClick={prevSlide} className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors shadow-sm">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextSlide} className="w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/15 transition-colors shadow-sm">
            <ChevronRight className="w-4 h-4" />
          </button>
          {genre && (
            <a href={`/genre/${genre}`} className="flex items-center gap-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors ml-1">
              Tất cả <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {isLoading
            ? [...Array(cardsToShow)].map((_, i) => (
                <div key={`skeleton-${i}`} className="w-full">
                  <Skeleton className="w-full rounded-2xl" style={{ aspectRatio: '2/3' }} />
                  <Skeleton className="h-3 mt-3 rounded w-3/4" />
                  <Skeleton className="h-3 mt-1.5 rounded w-1/2" />
                </div>
              ))
            : visibleBooks.map((book, idx) => (
                <motion.div key={`${book.id || idx}-${idx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                  <BookCard book={book} onOpen={onOpenBook} />
                </motion.div>
              ))
          }
        </div>
      </div>

      <div className="h-px max-w-[1400px] mx-auto mt-2 px-4 sm:px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent" />
      </div>
    </motion.section>
  );
}