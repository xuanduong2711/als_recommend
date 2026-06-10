import { useState, useEffect, useCallback } from 'react';
import { Outlet } from 'react-router';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { BookDetailModal } from './BookDetailModal';

// IMPORT SERVICE MỚI
import { trackingService } from '../../services/trackingService'; 

export interface OutletContextType {
  isDark: boolean;
  searchQuery: string;
  onOpenBook: (data: any) => void;
}

export function RootLayout() {
  const [isDark, setIsDark] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState<number | string | null>(null);
  
  const [selectedBookData, setSelectedBookData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const pref = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDark(pref);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const onOpenBook = useCallback((data: any) => {
    if (!data) return;
    
    const realId = data.id || data.book_id;
    if (realId) {
      setSelectedBookId(realId);
      setSelectedBookData(data);
      
      // THÊM: BẮN TRACKING KHI POPUP MỞ
      trackingService.logEvent(String(realId), 'popup_view');
      
    } else if (typeof data === 'string' || typeof data === 'number') {
      setSelectedBookId(data);
      setSelectedBookData(null);
      
      // THÊM: BẮN TRACKING KHI POPUP MỞ (Dành cho TH chỉ truyền ID)
      trackingService.logEvent(String(data), 'popup_view');
    }
  }, []);

  const ctx: OutletContextType = { isDark, searchQuery, onOpenBook };

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] transition-colors duration-300">
      <Navbar
        isDark={isDark}
        onToggleDark={() => setIsDark(d => !d)}
        onSearch={setSearchQuery}
        onOpenBook={onOpenBook}
      />
      <Outlet context={ctx} />
      <Footer />
      <BookDetailModal
        bookId={selectedBookId}
        bookData={selectedBookData}
        onClose={() => { setSelectedBookId(null); setSelectedBookData(null); }}
        onOpenBook={onOpenBook}
      />
    </div>
  );
}