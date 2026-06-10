import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useOutletContext, Link, useNavigate } from 'react-router';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar
} from 'recharts';
import {
  BookOpen, Flame, Star, ArrowRight, ChevronRight, Trophy,
  Heart, ShoppingBag, Settings, Bookmark, Target, TrendingUp,
  Calendar, Play, Home as HomeIcon, BarChart2
} from 'lucide-react';
import { useBooks } from '../hooks/useBooks';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import type { OutletContextType } from '../components/RootLayout';
import type { Book } from '../data/books';
import { userService } from '../../services/userService';
import { mapToBook } from '../../services/bookService';

// ─────────────────────────────────────────────────────────────
// STATIC MOCK DATA
// ─────────────────────────────────────────────────────────────

export type UserProfileType = {
  name: string;
  username: string;
  initials: string;
  quote: string;
  level: string;
  levelXP: number;
  levelMaxXP: number;
  booksRead: number;
  hoursRead: number;
  pagesRead: number;
  favoriteGenre: string;
  streak: number;
  memberType: string;
  current_balance?: number;
  favoriteBooks?: Book[];
  purchasedBooks?: Book[];
};

const defaultUserProfile: UserProfileType = {
  name: '',
  username: '',
  initials: 'MA',
  quote: '"Sách là cánh cửa mở ra vô số thế giới bạn chưa từng đặt chân đến."',
  level: 'Avid Reader',
  levelXP: 7840,
  levelMaxXP: 10000,
  booksRead: 47,
  hoursRead: 183,
  pagesRead: 18420,
  favoriteGenre: 'Fantasy',
  streak: 12,
  memberType: 'Premium',
};

// Đã bỏ 'owned' ra khỏi LibraryStatus
type LibraryStatus = 'reading' | 'completed';
type LibTab = 'all' | LibraryStatus;

const currentlyReadingData = [
  { bookId: 1, progress: 65, currentChapter: 'Chương 18: Bóng tối thức tỉnh', lastRead: '2 giờ trước', estimatedLeft: '2g 6m còn lại' },
  { bookId: 13, progress: 32, currentChapter: 'Chương 7: Hành lang vô tận', lastRead: 'Hôm qua', estimatedLeft: '3g 45m còn lại' },
];

const libraryBookIds = [1, 3, 4, 8, 12, 13];

const libraryStatuses: Record<number, LibraryStatus> = {
  1: 'reading', 13: 'reading',
  4: 'completed', 8: 'completed', 12: 'completed', 3: 'completed',
};

const userRatings: Record<number, number> = { 4: 5, 8: 5, 12: 5, 3: 4, 2: 4 };

const weeklyData = [
  { day: 'T2', hours: 1.5 }, { day: 'T3', hours: 2.3 }, { day: 'T4', hours: 0.8 },
  { day: 'T5', hours: 3.1 }, { day: 'T6', hours: 1.2 }, { day: 'T7', hours: 4.5 }, { day: 'CN', hours: 2.8 },
];

const monthlyData = [
  { month: 'T1', books: 3 }, { month: 'T2', books: 5 }, { month: 'T3', books: 2 },
  { month: 'T4', books: 7 }, { month: 'T5', books: 4 },
];

const achievementsData = [
  { id: 1, title: 'Bestseller Hunter', desc: 'Đọc 10 bestsellers', icon: '🏆', unlocked: true, color: 'from-amber-400 to-orange-500', shadow: 'shadow-amber-200 dark:shadow-amber-900/30' },
  { id: 2, title: 'Night Reader', desc: 'Đọc sau 11 giờ đêm', icon: '🌙', unlocked: true, color: 'from-indigo-400 to-violet-600', shadow: 'shadow-indigo-200 dark:shadow-indigo-900/30' },
  { id: 3, title: 'Fantasy Lover', desc: 'Đọc 15 sách Fantasy', icon: '🧙‍♂️', unlocked: true, color: 'from-violet-400 to-purple-600', shadow: 'shadow-violet-200 dark:shadow-violet-900/30' },
  { id: 4, title: '100h Reading', desc: 'Tổng 100 giờ đọc', icon: '⏱️', unlocked: true, color: 'from-emerald-400 to-teal-600', shadow: 'shadow-emerald-200 dark:shadow-emerald-900/30' },
  { id: 5, title: 'Genre Explorer', desc: '7 thể loại khám phá', icon: '🗺️', unlocked: true, color: 'from-rose-400 to-pink-600', shadow: 'shadow-rose-200 dark:shadow-rose-900/30' },
  { id: 6, title: 'Bookworm', desc: 'Đọc 50 cuốn (47/50)', icon: '🐛', unlocked: false, progress: 94, color: 'from-slate-300 to-slate-400', shadow: '' },
  { id: 7, title: 'Speed Reader', desc: '1 cuốn trong 24 giờ', icon: '⚡', unlocked: false, progress: 0, color: 'from-slate-300 to-slate-400', shadow: '' },
  { id: 8, title: 'Streak Master', desc: '30 ngày streak (12/30)', icon: '🔥', unlocked: false, progress: 40, color: 'from-slate-300 to-slate-400', shadow: '' },
];

const quotesData = [
  { id: 1, text: '"Trong bóng tối của vương quốc ma thuật, ánh sáng nhỏ bé nhất cũng đủ để soi đường cho những ai dũng cảm bước về phía trước."', book: 'The Shadow Realm', author: 'Elena Voss', bookId: 1, color: '#4F46E5' },
  { id: 2, text: '"Não bộ không phải cỗ máy cố định — nó là vũ trụ đang không ngừng tái tạo chính mình mỗi ngày."', book: 'Rewired Mind', author: 'Dr. Priya Sharma', bookId: 8, color: '#6366F1' },
  { id: 3, text: '"Từ nghèo đói đến đỉnh cao không phải câu chuyện về may mắn, mà là về việc không bao giờ bỏ cuộc dù chỉ một giây."', book: 'Against All Odds', author: 'Lin Mei Zhang', bookId: 12, color: '#DC2626' },
];

const readingGoals = {
  monthly: { target: 5, done: 4 },
  yearly: { target: 50, done: 47 },
  weekly: { target: 14, done: 10.2 },
  daily: { target: 50, done: 38 },
};

const moodData = [
  { day: 'T2', emoji: '⚡', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { day: 'T3', emoji: '🌿', bg: 'bg-green-100 dark:bg-green-900/30' },
  { day: 'T4', emoji: '🔮', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  { day: 'T5', emoji: '🗺️', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  { day: 'T6', emoji: '🌸', bg: 'bg-rose-100 dark:bg-rose-900/30' },
  { day: 'T7', emoji: '⚡', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  { day: 'CN', emoji: '🌿', bg: 'bg-green-100 dark:bg-green-900/30' },
];

const recommendedBookIds = [14, 6, 11, 9];

// Đã cập nhật lại Menu chuyển "Lịch sử mua" xuống dưới "Thống kê"
const navItems = [
  { id: 'overview', label: 'Tổng quan', icon: HomeIcon },
  { id: 'reading', label: 'Đang đọc', icon: Play },
  { id: 'library', label: 'Thư viện', icon: BookOpen },
  { id: 'achievements', label: 'Thành tựu', icon: Trophy },
  { id: 'wishlist', label: 'Sách yêu thích', icon: Heart, badge: 0 },
  { id: 'stats', label: 'Thống kê', icon: BarChart2 },
  { id: 'purchases', label: 'Lịch sử mua', icon: ShoppingBag },
  { id: 'settings', label: 'Cài đặt', icon: Settings },
];

function generateHeatmap(): number[][] {
  const rng = (seed: number) => {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  };
  const rand = rng(42);
  return Array.from({ length: 52 }, () =>
    Array.from({ length: 7 }, () => {
      const r = rand();
      if (r > 0.93) return 4;
      if (r > 0.84) return 3;
      if (r > 0.72) return 2;
      if (r > 0.55) return 1;
      return 0;
    })
  );
}

const heatmapData = generateHeatmap();

const heatmapColorClasses = [
  'bg-gray-100 dark:bg-white/5',
  'bg-indigo-100 dark:bg-indigo-900/50',
  'bg-indigo-200 dark:bg-indigo-700/70',
  'bg-indigo-400 dark:bg-indigo-500',
  'bg-indigo-600 dark:bg-indigo-400',
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function fadeIn(delay = 0) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  };
}

interface CircularProgressProps {
  value: number; max: number; size?: number;
  strokeWidth?: number; color?: string; bg?: string;
}
function CircularProgress({ value, max, size = 72, strokeWidth = 7, color = '#4F46E5', bg = '#E5E7EB' }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circ = radius * 2 * Math.PI;
  const offset = circ - Math.min(value / max, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} stroke={bg} strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={color} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

function SectionHeader({ title, subtitle, emoji, action, onAction }: {
  title: string; subtitle?: string; emoji?: string; action?: string; onAction?: () => void;
}) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <h2 className="text-gray-900 dark:text-white flex items-center gap-2"
          style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', fontWeight: 700 }}>
          {emoji && <span className="text-xl">{emoji}</span>}
          {title}
        </h2>
        {subtitle && <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction}
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors font-medium">
          {action} <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
function ProfileSidebar({ active, onNavigate, user }: { active: string; onNavigate: (id: string) => void; user: UserProfileType }) {
  const mockUser = user;
  const xpPct = (mockUser.levelXP / mockUser.levelMaxXP) * 100;
  return (
    <div className="bg-white/80 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 shadow-sm">
      {/* Avatar + user info */}
      <div className="text-center mb-5">
        <div className="relative inline-block mb-3">
          <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold mx-auto shadow-lg shadow-indigo-200/70 dark:shadow-indigo-900/40">
            {mockUser.initials}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white dark:border-[#16152B]" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center text-[10px] shadow-sm">✨</div>
        </div>
        <h3 className="text-gray-900 dark:text-white font-bold text-sm">{mockUser.name}</h3>
        <p className="text-gray-400 text-[11px] mt-0.5">{mockUser.username}</p>

        {/* Level */}
        <div className="inline-flex items-center gap-1 mt-2 px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/60 dark:to-violet-950/60 text-indigo-600 dark:text-indigo-400 rounded-full text-[11px] border border-indigo-100 dark:border-indigo-800/40">
          <span>📚</span><span className="font-semibold">{mockUser.level}</span>
        </div>

        {/* XP Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
            <span>{mockUser.levelXP.toLocaleString()} XP</span>
            <span>{mockUser.levelMaxXP.toLocaleString()} XP</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${xpPct}%` }}
              transition={{ duration: 1.4, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
            />
          </div>
        </div>

        {/* Streak */}
        <div className="flex items-center justify-center gap-1.5 mt-3 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
          <Flame className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-orange-600 dark:text-orange-400 text-[11px] font-bold">{mockUser.streak} ngày streak liên tiếp 🔥</span>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-white/8 mb-3" />

      {/* Nav */}
      <nav className="space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-xs transition-all group ${isActive
                ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200/60 dark:shadow-indigo-900/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/8 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                <span className="font-medium">{item.label}</span>
              </div>
              {item.id === 'wishlist' && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'}`}>
                  {mockUser.favoriteBooks?.length || 0}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 dark:border-white/8 mt-3 mb-3" />

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Sách', value: String(mockUser.booksRead) },
          { label: 'Giờ', value: String(mockUser.hoursRead) },
          { label: 'Streak', value: `${mockUser.streak}🔥` },
        ].map(s => (
          <div key={s.label} className="text-center p-2 bg-gray-50 dark:bg-white/5 rounded-2xl">
            <div className="text-gray-900 dark:text-white font-bold text-sm">{s.value}</div>
            <div className="text-gray-400 text-[9px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <Link to="/"
        className="flex items-center justify-center gap-1.5 mt-4 w-full py-2 rounded-xl text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/8 hover:text-gray-700 dark:hover:text-white transition-all">
        ← Trang chủ
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO BANNER
// ─────────────────────────────────────────────────────────────
function ProfileHero({ onOpenBook, user }: { onOpenBook: (b: Book) => void; user: UserProfileType }) {
  const mockUser = user;
  return (
    <motion.div {...fadeIn(0)} id="overview"
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50 via-violet-50/60 to-purple-50/40 dark:from-indigo-950/30 dark:via-violet-950/20 dark:to-purple-950/10 border border-indigo-100/60 dark:border-indigo-800/20 p-6 sm:p-8">

      {/* Background blobs */}
      <div className="absolute -top-10 -right-10 w-80 h-80 bg-violet-200/25 dark:bg-violet-800/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-56 h-56 bg-indigo-200/20 dark:bg-indigo-800/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-rose-100/20 dark:bg-rose-900/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold shadow-2xl shadow-indigo-300/40 dark:shadow-indigo-900/40"
            style={{ fontSize: '2rem' }}>
            {mockUser.initials}
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center shadow-md text-base">✨</div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-gray-900 dark:text-white"
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.3rem, 2.5vw, 1.7rem)', fontWeight: 700 }}>
              {mockUser.name}
            </h1>
            <span className="px-2.5 py-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[10px] font-bold rounded-full shadow-md">
              {mockUser.memberType}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-xs mb-2">{mockUser.username} · Tham gia từ Tháng 3, 2024</p>
          <p className="text-gray-600 dark:text-gray-300 text-sm italic mb-4 max-w-lg leading-relaxed">{mockUser.quote}</p>

          {/* Chips */}
          <div className="flex flex-wrap gap-2">
            {[
              { icon: '📚', value: `${mockUser.purchasedBooks?.length || mockUser.booksRead} sách`, sub: 'đã mua' },
              { icon: '⏱️', value: `${mockUser.hoursRead}h`, sub: 'đọc sách' },
              { icon: '📄', value: `${(mockUser.pagesRead / 1000).toFixed(1)}k`, sub: 'trang' },
              { icon: '🎭', value: mockUser.favoriteGenre, sub: 'yêu thích' },
              { icon: '🔥', value: `${mockUser.streak} ngày`, sub: 'streak' },
            ].map(c => (
              <div key={c.sub}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/70 dark:bg-white/8 backdrop-blur-sm rounded-2xl border border-white/70 dark:border-white/12 text-xs">
                <span>{c.icon}</span>
                <span className="text-gray-900 dark:text-white font-semibold">{c.value}</span>
                <span className="text-gray-400">{c.sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Đã gỡ bỏ div chứa 2 nút Chỉnh sửa và Chia sẻ theo yêu cầu */}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONTINUE READING
// ─────────────────────────────────────────────────────────────
function ContinueReadingSection({ onOpenBook }: { onOpenBook: (b: Book) => void }) {
  const { books } = useBooks();
  return (
    <motion.div {...fadeIn(0.08)} id="reading">
      <SectionHeader title="Tiếp tục đọc" emoji="📖" subtitle="Hành trình đang dang dở của bạn" action="Xem tất cả" />
      <div className="space-y-3">
        {currentlyReadingData.map((item) => {
          const book = books.find(b => b.id === item.bookId);
          if (!book) return null;
          return (
            <motion.div key={item.bookId}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={() => onOpenBook(book)}
              className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-4 flex gap-4 cursor-pointer group hover:shadow-lg hover:shadow-gray-100/60 dark:hover:shadow-black/20 transition-all">

              {/* Cover */}
              <div className="relative shrink-0 w-16 rounded-xl overflow-hidden shadow-sm" style={{ aspectRatio: '2/3' }}>
                <ImageWithFallback src={book.cover} alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <h4 className="text-gray-900 dark:text-white font-semibold text-sm line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {book.title}
                    </h4>
                    <p className="text-gray-400 text-xs">{book.author}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 pt-0.5">{item.lastRead}</span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs mb-2.5 line-clamp-1">{item.currentChapter}</p>

                {/* Progress */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-gray-500 dark:text-gray-400 font-medium">{item.progress}% hoàn thành</span>
                    <span className="text-gray-400">{item.estimatedLeft}</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      transition={{ duration: 1.2, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(90deg, ${book.accentColor}, ${book.accentColor}bb)` }}
                    />
                  </div>
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onOpenBook(book); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-sm shadow-indigo-200 dark:shadow-indigo-900/30">
                  <Play className="w-3 h-3 fill-white" /> Tiếp tục đọc
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// LIBRARY
// ─────────────────────────────────────────────────────────────
function LibrarySection({ onOpenBook, user }: { onOpenBook: (b: Book) => void; user: UserProfileType }) {
  const mockUser = user;
  const [tab, setTab] = useState<LibTab>('all');

  // Ưu tiên dữ liệu thật trả về từ API (user.purchasedBooks)
  const purchasedBooks = mockUser.purchasedBooks || []; 
  const purchasedIds = purchasedBooks.map(b => b.id);

  const tabs: { id: LibTab; label: string; count: number }[] = [
    { id: 'all', label: 'Tất cả', count: purchasedIds.length },
    { id: 'reading', label: 'Đang đọc', count: 2 },
    { id: 'completed', label: 'Đã xong', count: 4 },
    // Đã xóa nút Sở hữu
  ];

  // Lọc list sách dựa trên API
  const displayBooks = purchasedBooks.filter(b => {
    // Ép kiểu Number để trị lỗi TS indexing
    const bookIdNum = Number(b.id);
    return tab === 'all' ? true : libraryStatuses[bookIdNum] === tab;
  });

  const statusDot: Record<LibraryStatus, string> = {
    reading: 'bg-indigo-500',
    completed: 'bg-emerald-500',
    // Đã xóa 'owned'
  };

  return (
    <motion.div {...fadeIn(0.12)} id="library">
      <SectionHeader title="Thư viện của tôi" emoji="📚" subtitle={`${purchasedIds.length} cuốn trong bộ sưu tập`} action="Khám phá thêm" />

      {/* Tabs */}
      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-none pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${tab === t.id
              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200/60 dark:shadow-indigo-900/20'
              : 'bg-white dark:bg-[#16152B] text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-white/8 hover:border-indigo-200 dark:hover:border-indigo-700/50 hover:text-indigo-600 dark:hover:text-indigo-400'
            }`}>
            {t.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${tab === t.id ? 'bg-white/30 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <AnimatePresence mode="wait">
          {displayBooks.map((book, i) => {
            // Sửa lỗi index implicitly has 'any' type bằng cách ép kiểu Book ID sang number
            const status = libraryStatuses[Number(book.id)] as LibraryStatus | undefined;
            const rating = userRatings[Number(book.id)];

            return (
              <motion.div key={`${tab}-${book.id}`}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.22, delay: i * 0.04 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="cursor-pointer group"
                onClick={() => onOpenBook(book)}>

                <div className="relative rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow" style={{ aspectRatio: '2/3' }}>
                  <ImageWithFallback src={book.cover} alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-400" />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-gray-800 shadow">Chi tiết</div>
                  </div>

                  {/* Status dot */}
                  {status && (
                    <div className={`absolute top-2 left-2 w-2.5 h-2.5 rounded-full ${statusDot[status]} ring-2 ring-white shadow-sm`} />
                  )}

                  {/* Completed bookmark */}
                  {status === 'completed' && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center">
                      <Bookmark className="w-2.5 h-2.5 text-white fill-white" />
                    </div>
                  )}

                  {/* Glow on hover */}
                  <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    initial={false}
                    whileHover={{ boxShadow: `0 0 18px 2px ${book.accentColor}50` }}
                  />
                </div>

                <div className="mt-2 px-0.5">
                  <p className="text-gray-900 dark:text-white text-[11px] font-semibold line-clamp-2 leading-tight">{book.title}</p>
                  {rating && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} className={`w-2.5 h-2.5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-700'}`} />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// WISHLIST
// ─────────────────────────────────────────────────────────────
function WishlistSection({ onOpenBook, user }: { onOpenBook: (b: Book) => void; user: UserProfileType }) {
  const mockUser = user;
  const favoriteBooks = mockUser.favoriteBooks || [];

  if (favoriteBooks.length === 0) return null;

  return (
    <motion.div {...fadeIn(0.13)} id="wishlist">
      <SectionHeader title="Sách yêu thích" emoji="❤️" subtitle={`${favoriteBooks.length} cuốn đang mong chờ`} action="Xem tất cả" />

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <AnimatePresence mode="wait">
          {favoriteBooks.map((book, i) => (
            <motion.div key={book.id}
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.22, delay: i * 0.04 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="cursor-pointer group"
              onClick={() => onOpenBook(book)}>

              <div className="relative rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-shadow" style={{ aspectRatio: '2/3' }}>
                <ImageWithFallback src={book.cover} alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-400" />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 text-[11px] font-semibold text-gray-800 shadow">Chi tiết</div>
                </div>

                {/* Glow on hover */}
                <motion.div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  initial={false}
                  whileHover={{ boxShadow: `0 0 18px 2px ${book.accentColor}50` }}
                />
              </div>

              <div className="mt-2 px-0.5">
                <p className="text-gray-900 dark:text-white text-[11px] font-semibold line-clamp-2 leading-tight">{book.title}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{book.rating}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────
function StatsSection({ user }: { user: UserProfileType }) {
  const mockUser = user;
  const totalHours = weeklyData.reduce((s, d) => s + d.hours, 0);

  const statCards = [
    { label: 'Sách đã đọc', value: mockUser.booksRead, unit: 'cuốn', icon: '📚', bg: 'from-indigo-50 to-violet-50 dark:from-indigo-950/40 dark:to-violet-950/30', text: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Tổng trang', value: mockUser.pagesRead.toLocaleString(), unit: 'trang', icon: '📄', bg: 'from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30', text: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Giờ đọc sách', value: mockUser.hoursRead, unit: 'giờ', icon: '⏱️', bg: 'from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30', text: 'text-amber-600 dark:text-amber-400' },
    { label: 'Streak hiện tại', value: mockUser.streak, unit: 'ngày', icon: '🔥', bg: 'from-rose-50 to-pink-50 dark:from-rose-950/40 dark:to-pink-950/30', text: 'text-rose-600 dark:text-rose-400' },
  ];

  return (
    <motion.div {...fadeIn(0.1)} id="stats">
      <SectionHeader title="Thống kê đọc sách" emoji="📊" subtitle="Những con số phản ánh hành trình của bạn" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {statCards.map((c, i) => (
          <motion.div key={c.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.07 }}
            className={`bg-gradient-to-br ${c.bg} rounded-3xl p-4 border border-white/80 dark:border-white/8`}>
            <div className="text-2xl mb-2">{c.icon}</div>
            <div className={`font-bold ${c.text} mb-0.5`} style={{ fontSize: '1.5rem' }}>{c.value}</div>
            <div className="text-[11px] text-gray-400">{c.unit}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{c.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        {/* Weekly Area Chart */}
        <div className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gray-900 dark:text-white font-semibold text-sm">Giờ đọc tuần này</p>
              <p className="text-gray-400 text-xs">{totalHours.toFixed(1)}h tổng cộng</p>
            </div>
            <div className="flex items-center gap-1 text-emerald-500 text-xs font-semibold">
              <TrendingUp className="w-3.5 h-3.5" /> +12%
            </div>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={weeklyData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
              <defs>
                <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4F46E5" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #E5E7EB', borderRadius: '14px', fontSize: '11px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                formatter={(v: number) => [`${v}h`, 'Giờ đọc']}
                labelStyle={{ color: '#6B7280', marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="hours" stroke="#4F46E5" strokeWidth={2} fill="url(#hoursGrad)"
                dot={{ fill: '#4F46E5', r: 3, strokeWidth: 0 }} activeDot={{ r: 4, fill: '#4F46E5' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Bar Chart */}
        <div className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-gray-900 dark:text-white font-semibold text-sm">Sách đọc theo tháng</p>
              <p className="text-gray-400 text-xs">2025 — 21 cuốn tổng</p>
            </div>
            <div className="flex items-center gap-1 text-indigo-500 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" /> 2025
            </div>
          </div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={monthlyData} margin={{ top: 2, right: 2, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #E5E7EB', borderRadius: '14px', fontSize: '11px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                formatter={(v: number) => [`${v} cuốn`, 'Đã đọc']}
                labelStyle={{ color: '#6B7280', marginBottom: 4 }}
              />
              <Bar dataKey="books" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-gray-900 dark:text-white font-semibold text-sm">Reading Heatmap 2025</p>
            <p className="text-gray-400 text-xs">Mỗi ô = 1 ngày đọc sách</p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <span>Ít</span>
            {heatmapColorClasses.map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span>Nhiều</span>
          </div>
        </div>
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-0.5 min-w-max">
            {heatmapData.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((level, di) => (
                  <div
                    key={di}
                    className={`w-3 h-3 rounded-sm ${heatmapColorClasses[level]} hover:ring-1 hover:ring-indigo-400 hover:scale-110 transition-transform cursor-pointer`}
                    title={level > 0 ? `${level * 25} phút đọc` : 'Không đọc'}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────
function AchievementsSection() {
  const unlocked = achievementsData.filter(a => a.unlocked).length;
  return (
    <motion.div {...fadeIn(0.1)} id="achievements">
      <SectionHeader title="Thành tựu" emoji="🏆" subtitle={`${unlocked}/${achievementsData.length} đã mở khóa`} action="Xem tất cả" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {achievementsData.map((a, i) => (
          <motion.div key={a.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
            whileHover={a.unlocked ? { y: -5, scale: 1.03 } : {}}
            className={`relative rounded-3xl p-4 text-center border transition-all overflow-hidden ${a.unlocked
              ? 'bg-white dark:bg-[#16152B] border-gray-100/80 dark:border-white/8 hover:shadow-lg cursor-pointer'
              : 'bg-gray-50/80 dark:bg-white/3 border-gray-100/60 dark:border-white/5 opacity-55'
            }`}>

            {/* Subtle gradient overlay for unlocked */}
            {a.unlocked && (
              <div className={`absolute inset-0 bg-gradient-to-br ${a.color} opacity-[0.07] pointer-events-none`} />
            )}

            {/* Icon */}
            <div className={`relative w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl ${a.unlocked
              ? `bg-gradient-to-br ${a.color} shadow-lg ${a.shadow}`
              : 'bg-gray-200/80 dark:bg-white/8'
            }`}>
              <span className="relative z-10">{a.icon}</span>
              {a.unlocked && (
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${a.color} opacity-30 blur-md scale-125`} />
              )}
            </div>

            <p className="text-gray-900 dark:text-white font-semibold text-xs leading-tight mb-1">{a.title}</p>
            <p className="text-gray-400 text-[10px] leading-tight">{a.desc}</p>

            {!a.unlocked && a.progress !== undefined && a.progress > 0 && (
              <div className="mt-2.5">
                <div className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-400 dark:bg-white/30 rounded-full transition-all" style={{ width: `${a.progress}%` }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{a.progress}%</p>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUOTES
// ─────────────────────────────────────────────────────────────
function QuotesSection({ onOpenBook }: { onOpenBook: (b: Book) => void }) {
  const { books } = useBooks();
  return (
    <motion.div {...fadeIn(0.1)}>
      <SectionHeader title="Trích dẫn đã đánh dấu" emoji="✍️" subtitle="Những câu chữ đã chạm đến bạn" />
      <div className="space-y-3">
        {quotesData.map((q, i) => {
          const book = books.find(b => b.id === q.bookId);
          return (
            <motion.div key={q.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              whileHover={{ x: 3 }}
              onClick={() => book && onOpenBook(book)}
              className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 flex gap-4 cursor-pointer group hover:shadow-md transition-all">

              <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: q.color }} />

              <div className="flex-1 min-w-0">
                <p className="text-gray-700 dark:text-gray-200 text-sm italic leading-relaxed mb-3">{q.text}</p>
                <div className="flex items-center gap-3">
                  {book && (
                    <div className="w-6 h-8 rounded overflow-hidden shrink-0 shadow-sm">
                      <ImageWithFallback src={book.cover} alt={book.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{q.book}</p>
                    <p className="text-[10px] text-gray-400">{q.author}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// RIGHT PANEL
// ─────────────────────────────────────────────────────────────
function RightPanel({ onOpenBook, user }: { onOpenBook: (b: Book) => void; user: UserProfileType }) {
  const mockUser = user;
  const { books } = useBooks();
  const recommended = recommendedBookIds.map(id => books.find(b => b.id === id)).filter((b): b is Book => Boolean(b));

  return (
    <div className="space-y-4">

      {/* Reading Goals */}
      <motion.div {...fadeIn(0.15)} className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-gray-900 dark:text-white font-semibold text-sm">Mục tiêu đọc sách</h3>
        </div>

        {/* Circular progress pairs */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Tháng này', done: readingGoals.monthly.done, max: readingGoals.monthly.target, color: '#4F46E5' },
            { label: 'Năm nay', done: readingGoals.yearly.done, max: readingGoals.yearly.target, color: '#7C3AED' },
          ].map(g => (
            <div key={g.label} className="text-center">
              <div className="relative inline-block">
                <CircularProgress value={g.done} max={g.max} size={70} strokeWidth={7} color={g.color} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div>
                    <div className="text-gray-900 dark:text-white font-bold leading-none" style={{ fontSize: '1.1rem' }}>{g.done}</div>
                    <div className="text-gray-400 leading-none" style={{ fontSize: '9px' }}>/{g.max}</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{g.label}</p>
            </div>
          ))}
        </div>

        {/* Linear goals */}
        <div className="space-y-3">
          {[
            { label: 'Giờ đọc / tuần', done: readingGoals.weekly.done, max: readingGoals.weekly.target, unit: 'h', color: '#F59E0B' },
            { label: 'Trang / ngày', done: readingGoals.daily.done, max: readingGoals.daily.target, unit: 'tr', color: '#10B981' },
          ].map(g => (
            <div key={g.label}>
              <div className="flex justify-between text-[11px] mb-1.5">
                <span className="text-gray-600 dark:text-gray-400">{g.label}</span>
                <span className="text-gray-900 dark:text-white font-semibold">{g.done}/{g.max}{g.unit}</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(g.done / g.max, 1) * 100}%` }}
                  transition={{ duration: 1.2, delay: 0.6 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: g.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Mood Tracker */}
      <motion.div {...fadeIn(0.22)} className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm">🎭</span>
          <h3 className="text-gray-900 dark:text-white font-semibold text-sm">Mood tuần này</h3>
        </div>
        <div className="flex gap-1">
          {moodData.map((m, i) => (
            <div key={m.day} className="flex-1 text-center">
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.06 + 0.3, type: 'spring', stiffness: 320, damping: 20 }}
                className={`aspect-square rounded-xl flex items-center justify-center text-sm ${m.bg} hover:scale-110 transition-transform cursor-default`}>
                {m.emoji}
              </motion.div>
              <p className="text-[9px] text-gray-400 mt-1">{m.day}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* For You */}
      <motion.div {...fadeIn(0.3)} className="bg-white dark:bg-[#16152B] rounded-3xl border border-gray-100/80 dark:border-white/8 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">✨</span>
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">Dành cho bạn</h3>
          </div>
          <button className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Xem thêm</button>
        </div>
        <div className="space-y-3">
          {recommended.map((book, i) => (
            <motion.div key={book.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 + 0.4 }}
              whileHover={{ x: 2 }}
              onClick={() => onOpenBook(book)}
              className="flex gap-3 cursor-pointer group">
              <div className="w-10 shrink-0 rounded-xl overflow-hidden shadow-sm" style={{ aspectRatio: '2/3' }}>
                <ImageWithFallback src={book.cover} alt={book.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </div>
              <div className="flex-1 min-w-0 py-0.5">
                <p className="text-gray-900 dark:text-white text-[11px] font-semibold line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{book.title}</p>
                <p className="text-gray-400 text-[10px] truncate">{book.author}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{book.rating}</span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold ml-auto">
                    {book.price.toLocaleString('vi-VN')}₫
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Reading Streak Widget */}
      <motion.div {...fadeIn(0.38)} className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 to-rose-500 p-5 shadow-lg shadow-orange-200/50 dark:shadow-orange-900/30">
        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-5 h-5 text-white" />
            <span className="text-white font-semibold text-sm">Streak hiện tại</span>
          </div>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-white font-black" style={{ fontSize: '2.5rem', lineHeight: 1 }}>{mockUser.streak}</span>
            <span className="text-orange-100 text-sm font-medium">ngày</span>
          </div>
          <p className="text-orange-100 text-xs">Hãy tiếp tục! Còn 18 ngày để đạt thành tựu 🔥</p>
          <div className="flex gap-1 mt-3">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i}
                className={`flex-1 h-1.5 rounded-full ${i < (mockUser.streak % 7) || mockUser.streak >= 7 && i < 7 ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN PROFILE PAGE
// ─────────────────────────────────────────────────────────────
export function Profile() {
  const navigate = useNavigate();
  const { onOpenBook } = useOutletContext<OutletContextType>();
  const [activeNav, setActiveNav] = useState('overview');
  const [userProfile, setUserProfile] = useState<UserProfileType>(defaultUserProfile);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = userService.getCurrentUserId();
        if (!userId) {
          navigate('/login');
          return;
        }

        // Gọi đồng thời 3 API cùng lúc bằng Promise.all để tối ưu tốc độ tải trang
        // Dùng .catch() cho từng Promise để nếu 1 API lỗi (VD: wishlist trống) thì web không bị sập
        const [apiUser, purchasedEntities, wishlistEntities] = await Promise.all([
          userService.getUserById(userId).catch(e => { console.error('Lỗi lấy User:', e); return null; }),
          userService.getPurchasedBooks(userId).catch(e => { console.error('Lỗi lấy Purchased Books:', e); return null; }),
          userService.getWishlist().catch(e => { console.error('Lỗi lấy Wishlist:', e); return null; })
        ]);

        setUserProfile(prev => {
          let updated = { ...prev };

          // 1. Cập nhật thông tin cơ bản của User
          if (apiUser) {
            if (apiUser.full_name) {
              updated.name = apiUser.full_name;
              const names = apiUser.full_name.trim().split(' ');
              if (names.length >= 2) {
                updated.initials = (names[0][0] + names[names.length - 1][0]).toUpperCase();
              } else if (names.length === 1 && names[0].length >= 2) {
                updated.initials = names[0].substring(0, 2).toUpperCase();
              } else if (names.length === 1 && names[0].length === 1) {
                updated.initials = names[0].toUpperCase();
              }
            }
            if (apiUser.user_name) {
              updated.username = '@' + apiUser.user_name;
            }
            if (apiUser.current_balance !== undefined) {
              updated.current_balance = apiUser.current_balance;
            }
          }

          // 2. Cập nhật Thư viện (Sách đã mua)
          if (purchasedEntities && Array.isArray(purchasedEntities)) {
            updated.purchasedBooks = purchasedEntities.map((item: any) => {
              // Trích xuất lõi book và dùng hàm mapToBook bạn đã viết sẵn
              const b = item.book ? item.book : item;
              return mapToBook(b); 
            });
            updated.booksRead = purchasedEntities.length;
          }

          // 3. Cập nhật Sách yêu thích (Wishlist)
          if (wishlistEntities && Array.isArray(wishlistEntities)) {
            updated.favoriteBooks = wishlistEntities.map((item: any) => {
              const b = item.book ? item.book : item;
              return mapToBook(b);
            });
          }

          return updated;
        });
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();
  }, [navigate]);

  const scrollToSection = (id: string) => {
    setActiveNav(id);
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleNavigate = (id: string) => {
    if (id === 'purchases') {
      navigate('/purchases');
    } else if (id === 'settings') {
      navigate('/settings'); 
    } else {
      scrollToSection(id);
    }
  };

  const sectionsRef = useRef<string[]>(['overview', 'reading', 'library', 'achievements', 'wishlist', 'stats']);
  useEffect(() => {
    const handler = () => {
      for (const id of sectionsRef.current) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= 160 && rect.bottom > 100) {
          setActiveNav(id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <div className="bg-[#F8F7F4] dark:bg-[#0D0C14] min-h-screen pt-16">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6 items-start">

          <aside className="hidden lg:block w-60 xl:w-64 shrink-0 sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-none">
            <ProfileSidebar active={activeNav} onNavigate={handleNavigate} user={userProfile} />
          </aside>

          <main className="flex-1 min-w-0 space-y-8 pb-16">
            <ProfileHero onOpenBook={onOpenBook} user={userProfile} />
            <ContinueReadingSection onOpenBook={onOpenBook} />
            <LibrarySection onOpenBook={onOpenBook} user={userProfile} />
            <AchievementsSection />
            <WishlistSection onOpenBook={onOpenBook} user={userProfile} />
            <StatsSection user={userProfile} />
            <QuotesSection onOpenBook={onOpenBook} />
          </main>

          <aside className="hidden xl:block w-68 shrink-0 sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-none" style={{ width: '272px' }}>
            <RightPanel onOpenBook={onOpenBook} user={userProfile} />
          </aside>
        </div>
      </div>
    </div>
  );
}