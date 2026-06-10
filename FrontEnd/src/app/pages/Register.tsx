import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { Mail, Lock, User as UserIcon, Eye, EyeOff, BookOpen, Chrome, Facebook, Apple, Check, Loader2 } from 'lucide-react';
import { userService } from '../../services/userService';
import { GENRES } from '../data/books';

export function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    gender: '' as 'Man' | 'Woman' | 'Other' | '',
    favoriteGenres: [] as string[],
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // STATE MỚI: Quản lý lỗi từng ô
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setFieldErrors({});

    // Validate nhanh ở Front-end
    if (step === 1) {
      if (!formData.gender) {
        setFieldErrors(prev => ({ ...prev, gender: 'Vui lòng chọn giới tính' }));
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setFieldErrors(prev => ({ ...prev, confirmPassword: 'Mật khẩu xác nhận không khớp' }));
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setIsLoading(true);
      try {
        const payload = {
          user_name: formData.username,
          full_name: formData.fullName,
          email: formData.email,
          password: formData.password,
          sex: formData.gender || 'Other' // Đã sửa lại để luôn gửi chữ hoa: 'Man', 'Woman', 'Other'
        };
        
        // 1. Call Register API
        await userService.register(payload as any);
        
        // 2. Auto Login after register to get Token
        await userService.login({ user_name: formData.username, password: formData.password });
        
        navigate('/profile');
      } catch (error: any) {
        console.error('Registration failed:', error);
        const responseData = error.response?.data;

        // XỬ LÝ LỖI TRẢ VỀ TỪ BACKEND
        if (responseData?.errors) {
          const beErrors = responseData.errors;
          const newErrors: Record<string, string> = {};

          // Ánh xạ tên trường từ Backend sang Frontend
          if (beErrors.user_name) newErrors.username = beErrors.user_name[0];
          if (beErrors.email) newErrors.email = beErrors.email[0];
          if (beErrors.full_name) newErrors.fullName = beErrors.full_name[0];
          if (beErrors.password) newErrors.password = beErrors.password[0];
          if (beErrors.sex) newErrors.gender = beErrors.sex[0];

          setFieldErrors(newErrors);
          setErrorMsg('Vui lòng kiểm tra lại các thông tin bị lỗi.');
        } else {
          setErrorMsg(responseData?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
        }
        
        setStep(1); // Quay lại bước 1 để hiển thị ô bị lỗi
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleGenre = (genre: string) => {
    setFormData(prev => ({
      ...prev,
      favoriteGenres: prev.favoriteGenres.includes(genre)
        ? prev.favoriteGenres.filter(g => g !== genre)
        : [...prev.favoriteGenres, genre]
    }));
  };

  const genreColors: Record<string, string> = {
    Fantasy: 'from-violet-500 to-purple-600',
    'Science-Fiction': 'from-cyan-500 to-blue-600',
    Romance: 'from-rose-500 to-pink-600',
    'Self-Help': 'from-emerald-500 to-teal-600',
    Mystery: 'from-slate-500 to-gray-600',
    Biography: 'from-red-500 to-rose-600',
    Philosophy: 'from-yellow-500 to-amber-600',
  };

  // Hàm hỗ trợ xóa lỗi khi người dùng bắt đầu gõ lại
  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ y: [0, -30, 0], x: [0, 20, 0], rotate: [0, 5, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] left-[5%] w-96 h-96 bg-gradient-to-br from-indigo-200/30 to-violet-200/20 dark:from-indigo-800/20 dark:to-violet-800/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, 40, 0], x: [0, -30, 0], rotate: [0, -8, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[15%] right-[8%] w-80 h-80 bg-gradient-to-br from-rose-200/25 to-orange-200/15 dark:from-rose-800/15 dark:to-orange-800/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [0, -20, 0], x: [0, 15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[50%] right-[20%] w-64 h-64 bg-gradient-to-br from-emerald-200/20 to-teal-200/15 dark:from-emerald-800/10 dark:to-teal-800/10 rounded-full blur-3xl"
        />
      </div>

      {/* Register Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-lg">

        <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-2xl rounded-3xl border border-gray-100/80 dark:border-white/8 shadow-2xl shadow-gray-200/40 dark:shadow-black/40 p-8 sm:p-10">

          {/* Logo + Title */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700 }}>
                InkShelf
              </span>
            </Link>
            <h1 className="text-gray-900 dark:text-white font-bold mb-2" style={{ fontSize: '1.6rem' }}>
              Tạo tài khoản mới
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {step === 1 ? 'Bắt đầu hành trình đọc sách của bạn' : 'Tùy chỉnh trải nghiệm đọc sách'}
            </p>

            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`h-1.5 w-12 rounded-full transition-all ${step >= 1 ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-gray-200 dark:bg-white/10'}`} />
              <div className={`h-1.5 w-12 rounded-full transition-all ${step >= 2 ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-gray-200 dark:bg-white/10'}`} />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <AnimatePresence mode="wait">

              {/* Step 1: Basic Info */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4">

                  {errorMsg && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800/30">
                      {errorMsg}
                    </div>
                  )}

                  {/* Social Signup */}
                  <div className="space-y-2">
                    {[
                      { icon: Chrome, label: 'Google', gradient: 'from-red-500 to-yellow-500' },
                      { icon: Facebook, label: 'Facebook', gradient: 'from-blue-600 to-blue-700' },
                      { icon: Apple, label: 'Apple', gradient: 'from-gray-800 to-gray-900' },
                    ].map((provider) => {
                      const Icon = provider.icon;
                      return (
                        <button
                          key={provider.label}
                          type="button"
                          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white dark:bg-white/8 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/12 rounded-2xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/12 hover:border-gray-300 dark:hover:border-white/20 transition-all active:scale-98">
                          <div className={`w-5 h-5 rounded-lg bg-gradient-to-br ${provider.gradient} flex items-center justify-center shrink-0`}>
                            <Icon className="w-3 h-3 text-white" />
                          </div>
                          Đăng ký với {provider.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="px-3 bg-white dark:bg-[#16152B] text-gray-400">hoặc đăng ký với email</span>
                    </div>
                  </div>

                  {/* Full Name */}
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Họ và tên</label>
                    <div className={`relative transition-all ${focusedField === 'fullName' ? 'scale-[1.01]' : ''}`}>
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => {
                          setFormData({ ...formData, fullName: e.target.value });
                          clearFieldError('fullName');
                        }}
                        onFocus={() => setFocusedField('fullName')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="Nguyễn Văn A"
                        className={`w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all ${
                          fieldErrors.fullName 
                            ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                            : focusedField === 'fullName'
                              ? 'border-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-100/50 dark:ring-indigo-900/30 bg-white dark:bg-white/8'
                              : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                        }`}
                        required
                      />
                    </div>
                    {fieldErrors.fullName && <p className="text-rose-500 text-xs mt-1.5 font-medium">{fieldErrors.fullName}</p>}
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Tên người dùng</label>
                    <div className={`relative transition-all ${focusedField === 'username' ? 'scale-[1.01]' : ''}`}>
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => {
                          setFormData({ ...formData, username: e.target.value });
                          clearFieldError('username');
                        }}
                        onFocus={() => setFocusedField('username')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="booklover123"
                        className={`w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all ${
                          fieldErrors.username 
                            ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                            : focusedField === 'username'
                              ? 'border-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-100/50 dark:ring-indigo-900/30 bg-white dark:bg-white/8'
                              : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                        }`}
                        required
                      />
                    </div>
                    {fieldErrors.username && <p className="text-rose-500 text-xs mt-1.5 font-medium">{fieldErrors.username}</p>}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Email</label>
                    <div className={`relative transition-all ${focusedField === 'email' ? 'scale-[1.01]' : ''}`}>
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => {
                          setFormData({ ...formData, email: e.target.value });
                          clearFieldError('email');
                        }}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="you@example.com"
                        className={`w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all ${
                          fieldErrors.email 
                            ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                            : focusedField === 'email'
                              ? 'border-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-100/50 dark:ring-indigo-900/30 bg-white dark:bg-white/8'
                              : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                        }`}
                        required
                      />
                    </div>
                    {fieldErrors.email && <p className="text-rose-500 text-xs mt-1.5 font-medium">{fieldErrors.email}</p>}
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Giới tính</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { value: 'Man', label: 'Nam', emoji: '👨' },
                        { value: 'Woman', label: 'Nữ', emoji: '👩' },
                        { value: 'Other', label: 'Khác', emoji: '🧑' },
                      ].map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, gender: option.value as any });
                            clearFieldError('gender');
                          }}
                          className={`px-3 py-2.5 rounded-2xl font-medium text-sm border transition-all ${formData.gender === option.value
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md'
                            : fieldErrors.gender
                              ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-900/10'
                              : 'bg-white dark:bg-white/8 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/12 hover:border-gray-300 dark:hover:border-white/20'
                          }`}>
                          <span className="mr-1.5">{option.emoji}</span>
                          {option.label}
                        </button>
                      ))}
                    </div>
                    {fieldErrors.gender && <p className="text-rose-500 text-xs mt-1.5 font-medium">{fieldErrors.gender}</p>}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Mật khẩu</label>
                    <div className={`relative transition-all ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => {
                          setFormData({ ...formData, password: e.target.value });
                          clearFieldError('password');
                        }}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="••••••••"
                        // Thêm [&::-ms-reveal]:hidden để ẩn icon mắt mặc định
                        className={`w-full pl-11 pr-11 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all [&::-ms-reveal]:hidden ${
                          fieldErrors.password 
                            ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                            : focusedField === 'password'
                              ? 'border-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-100/50 dark:ring-indigo-900/30 bg-white dark:bg-white/8'
                              : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                        }`}
                        required
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="text-rose-500 text-xs mt-1.5 font-medium">{fieldErrors.password}</p>}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Xác nhận mật khẩu</label>
                    <div className={`relative transition-all ${focusedField === 'confirm' ? 'scale-[1.01]' : ''}`}>
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={(e) => {
                          setFormData({ ...formData, confirmPassword: e.target.value });
                          clearFieldError('confirmPassword');
                        }}
                        onFocus={() => setFocusedField('confirm')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="••••••••"
                        className={`w-full pl-11 pr-11 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all [&::-ms-reveal]:hidden ${
                          fieldErrors.confirmPassword 
                            ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                            : focusedField === 'confirm'
                              ? 'border-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-100/50 dark:ring-indigo-900/30 bg-white dark:bg-white/8'
                              : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                        }`}
                        required
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword && <p className="text-rose-500 text-xs mt-1.5 font-medium">{fieldErrors.confirmPassword}</p>}
                  </div>

                  <button type="submit"
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:opacity-95 active:scale-98 transition-all mt-2">
                    Tiếp tục
                  </button>
                </motion.div>
              )}

              {/* Step 2: Preferences */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5">

                  <div>
                    <h3 className="text-gray-900 dark:text-white font-semibold mb-2">Thể loại yêu thích (tùy chọn)</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                      Chọn những thể loại bạn thích để nhận gợi ý sách phù hợp
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {GENRES.map(genre => {
                        const isSelected = formData.favoriteGenres.includes(genre);
                        const gradient = genreColors[genre] || 'from-gray-500 to-gray-600';
                        return (
                          <motion.button
                            key={genre}
                            type="button"
                            onClick={() => toggleGenre(genre)}
                            whileTap={{ scale: 0.95 }}
                            className={`relative px-4 py-2.5 rounded-2xl font-medium text-sm border transition-all ${isSelected
                              ? `bg-gradient-to-r ${gradient} text-white border-transparent shadow-md`
                              : 'bg-white dark:bg-white/8 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/12 hover:border-gray-300 dark:hover:border-white/20'
                            }`}>
                            {genre}
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(1)}
                      className="flex-1 py-3.5 bg-white dark:bg-white/8 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/12 rounded-2xl font-semibold hover:bg-gray-50 dark:hover:bg-white/12 transition-all">
                      Quay lại
                    </button>
                    <button type="submit" disabled={isLoading}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:opacity-95 active:scale-98 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                      {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
                      {isLoading ? 'Đang xử lý...' : 'Hoàn tất'}
                    </button>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </form>

          {/* Login link */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Đã có tài khoản?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors">
              Đăng nhập
            </Link>
          </p>

        </div>

        {/* Decorative elements */}
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-gradient-to-br from-rose-500/15 to-orange-500/15 dark:from-rose-500/10 dark:to-orange-500/10 rounded-full blur-2xl pointer-events-none" />

      </motion.div>

    </div>
  );
}