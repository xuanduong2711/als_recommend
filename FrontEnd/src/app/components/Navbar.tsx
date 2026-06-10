import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import {
  Search, BookOpen, Wallet, Sun, Moon, Menu, X,
  ChevronDown, Bell, Flame, User, Settings, ShoppingBag, LogOut
} from 'lucide-react';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { userService } from '../../services/userService';

interface NavbarProps {
  isDark: boolean;
  onToggleDark: () => void;
  onSearch: (q: string) => void;
  onOpenBook: (id: number) => void;
}

const navLinks = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Thể loại', href: '/genre/Fantasy', hasDropdown: true },
  { label: 'Xu hướng', href: '/trending' },
];

const genres = ['Fantasy', 'Science-Fiction', 'Romance', 'Mystery', 'Classics', 'Biography', 'Magic', 'Adventure', 'Thriller', 'Horror'];

export function Navbar({ isDark, onToggleDark, onSearch }: NavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { scrollDir, scrollY } = useScrollDirection();
  const isLoggedIn = userService.isLoggedIn();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [genreOpen, setGenreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  
  // Thêm state lưu tên người dùng
  const [userFullName, setUserFullName] = useState<string>('');

  useEffect(() => {
    if (isLoggedIn) {
      const fetchUserData = async () => {
        try {
          const userId = userService.getCurrentUserId();
          if (userId) {
            const apiUser = await userService.getUserById(userId);
            if (apiUser) {
              if (apiUser.current_balance !== undefined) {
                setBalance(apiUser.current_balance);
              }
              // Ưu tiên lấy full_name, nếu không có thì lấy user_name
              setUserFullName(apiUser.full_name || apiUser.user_name || '');
            }
          }
        } catch (e) {
          console.error('Failed to fetch user data in Navbar', e);
        }
      };
      fetchUserData();
    }
  }, [isLoggedIn, location.pathname]);

  const isHidden = scrollDir === 'down' && scrollY > 80;
  const isScrolled = scrollY > 20;

  // HÀM CHUYỂN HƯỚNG TÌM KIẾM CHUYÊN SÂU
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  // HÀM RESET DỮ LIỆU KHI VỀ TRANG CHỦ
  const handleGoHome = () => {
    setSearchVal('');
    onSearch('');
  };

  // HÀM LẤY CHỮ CÁI ĐẦU TÊN NGƯỜI DÙNG
  const getInitials = (name: string) => {
    if (!name) return 'U'; // Trả về U (User) nếu chưa có tên
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  return (
    <motion.header
      animate={{ y: isHidden ? '-100%' : 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/90 dark:bg-[#0D0C14]/90 backdrop-blur-xl shadow-sm border-b border-gray-100/80 dark:border-white/5'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-24 gap-6">

          {/* Logo */}
          <NavLink to="/" onClick={handleGoHome} className="flex items-center gap-3 shrink-0 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 group-hover:scale-105 transition-transform">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-[26px] text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>
              InkShelf
            </span>
          </NavLink>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              link.hasDropdown ? (
                <div key={link.label} className="relative">
                  <button
                    onMouseEnter={() => setGenreOpen(true)}
                    onMouseLeave={() => setGenreOpen(false)}
                    className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-[17px] text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-all"
                  >
                    {link.label}
                    <ChevronDown className={`w-5 h-5 transition-transform ${genreOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {genreOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        onMouseEnter={() => setGenreOpen(true)}
                        onMouseLeave={() => setGenreOpen(false)}
                        className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-[#1A1A2E] rounded-2xl shadow-xl border border-gray-100 dark:border-white/8 overflow-hidden p-1.5"
                      >
                        {genres.map(g => (
                          <NavLink key={g} to={`/genre/${g}`} className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/8 rounded-lg transition-colors">
                            {g}
                          </NavLink>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <NavLink
                  key={link.label}
                  to={link.href}
                  onClick={link.href === '/' ? handleGoHome : undefined}
                  className="px-4 py-2 rounded-lg text-base text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-all"
                >
                  {link.label}
                </NavLink>
              )
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <AnimatePresence mode="wait">
              {searchOpen ? (
                <motion.div
                  key="search-open"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                  className="overflow-hidden"
                >
                  <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 bg-gray-100 dark:bg-white/10 rounded-xl px-3 py-2">
                    <Search className="w-4 h-4 text-gray-400 shrink-0" />
                    <input
                      autoFocus
                      value={searchVal}
                      onChange={e => { setSearchVal(e.target.value); onSearch(e.target.value); }}
                      placeholder="Tìm sách..."
                      className="bg-transparent text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none w-full"
                    />
                    {searchVal && (
                      <button type="button" onClick={() => { setSearchVal(''); onSearch(''); }} className="shrink-0 mr-1">
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                    <button type="submit" className="shrink-0 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                      <Search className="w-3 h-3" />
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.button
                  key="search-closed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setSearchOpen(true)}
                  className="w-[44px] h-[44px] flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
                >
                  <Search className="w-5 h-5" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Dark mode */}
            <button
              onClick={onToggleDark}
              className="w-[44px] h-[44px] flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {isLoggedIn ? (
              <>
                <button className="hidden sm:flex w-[44px] h-[44px] items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-[#0D0C14]"></span>
                </button>

                <button className="hidden sm:flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm hover:bg-emerald-100 dark:hover:bg-emerald-500/25 transition-colors">
                  <Wallet className="w-4 h-4" />
                  <span className="font-medium">{balance !== null ? `${balance.toLocaleString('vi-VN')}₫` : '...'}</span>
                </button>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-xl text-xs">
                  <Flame className="w-4 h-4" />
                  <span className="font-semibold">12</span>
                </div>

                <div className="relative">
                  <button
                    onMouseEnter={() => setUserMenuOpen(true)}
                    onMouseLeave={() => setUserMenuOpen(false)}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shrink-0 ring-[2px] ring-white dark:ring-gray-900 hover:scale-105 transition-transform hover:ring-indigo-300 dark:hover:ring-indigo-600"
                  >
                    {/* Hiển thị chữ cái đầu tên người dùng thay vì 'MA' */}
                    {getInitials(userFullName)}
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        onMouseEnter={() => setUserMenuOpen(true)}
                        onMouseLeave={() => setUserMenuOpen(false)}
                        className="absolute top-full right-0 mt-2 w-44 bg-white dark:bg-[#1A1A2E] rounded-2xl shadow-xl border border-gray-100 dark:border-white/8 overflow-hidden p-1"
                      >
                        <NavLink to="/profile" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/8 rounded-xl transition-colors">
                          <User className="w-4 h-4" /> Trang cá nhân
                        </NavLink>
                        <NavLink to="/purchases" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/8 rounded-xl transition-colors">
                          <ShoppingBag className="w-4 h-4" /> Lịch sử mua hàng
                        </NavLink>
                        <NavLink to="/settings" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/8 rounded-xl transition-colors">
                          <Settings className="w-4 h-4" /> Cài đặt
                        </NavLink>
                        <div className="border-t border-gray-100 dark:border-white/8 my-1" />
                        <button
                          onClick={() => {
                            userService.logout();
                            window.location.href = '/login';
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Đăng xuất
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            ) : (
              <>
                <NavLink to="/login" className="hidden sm:flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  Đăng nhập
                </NavLink>
                <NavLink to="/register" className="hidden sm:flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-lg hover:opacity-90 transition-opacity shadow-md shadow-indigo-200 dark:shadow-indigo-900/40">
                  Đăng ký
                </NavLink>
              </>
            )}

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden w-[52px] h-[52px] flex items-center justify-center rounded-2xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors"
            >
              {mobileOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="lg:hidden bg-white/95 dark:bg-[#0D0C14]/95 backdrop-blur-xl border-t border-gray-100 dark:border-white/5 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-1">
              {navLinks.map(link => (
                <NavLink key={link.label} to={link.href}
                  onClick={() => {
                    if (link.href === '/') handleGoHome();
                    setMobileOpen(false);
                  }}
                  className="block px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors text-sm">
                  {link.label}
                </NavLink>
              ))}
              {isLoggedIn ? (
                <>
                  <NavLink to="/profile" className="flex items-center gap-2 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors text-sm">
                    <User className="w-4 h-4" /> Trang cá nhân
                  </NavLink>
                  <NavLink to="/purchases" className="flex items-center gap-2 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors text-sm">
                    <ShoppingBag className="w-4 h-4" /> Lịch sử mua hàng
                  </NavLink>
                  <NavLink to="/settings" className="flex items-center gap-2 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/8 transition-colors text-sm">
                    <Settings className="w-4 h-4" /> Cài đặt
                  </NavLink>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 rounded-xl text-sm">
                      <Wallet className="w-3.5 h-3.5" />
                      <span className="font-medium">{balance !== null ? `${balance.toLocaleString('vi-VN')}₫` : '...'}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-50 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 rounded-xl text-xs">
                      <Flame className="w-3.5 h-3.5" />
                      <span className="font-semibold">12 ngày</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      userService.logout();
                      window.location.href = '/login';
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors text-sm"
                  >
                    <LogOut className="w-4 h-4" /> Đăng xuất
                  </button>
                </>
              ) : (
                <div className="px-4 py-2 flex flex-col gap-2">
                  <NavLink to="/login" className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                    Đăng nhập
                  </NavLink>
                  <NavLink to="/register" className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl hover:opacity-90 transition-opacity">
                    Đăng ký
                  </NavLink>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}