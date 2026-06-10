import { useState } from 'react';
import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router';
import { User, Lock, Eye, EyeOff, BookOpen, Chrome, Facebook, Apple } from 'lucide-react';
import { userService } from '../../services/userService';

export function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ user_name: '', password: '', remember: false });
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await userService.login({ user_name: formData.user_name, password: formData.password });
      navigate('/profile');
    } catch (error: any) {
      console.error('Login failed:', error);
      setErrorMsg(error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background floating shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            rotate: [0, 5, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] left-[5%] w-96 h-96 bg-gradient-to-br from-indigo-200/30 to-violet-200/20 dark:from-indigo-800/20 dark:to-violet-800/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, 40, 0],
            x: [0, -30, 0],
            rotate: [0, -8, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-[15%] right-[8%] w-80 h-80 bg-gradient-to-br from-rose-200/25 to-orange-200/15 dark:from-rose-800/15 dark:to-orange-800/10 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [0, -20, 0],
            x: [0, 15, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[50%] right-[20%] w-64 h-64 bg-gradient-to-br from-emerald-200/20 to-teal-200/15 dark:from-emerald-800/10 dark:to-teal-800/10 rounded-full blur-3xl"
        />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative w-full max-w-md">

        {/* Card */}
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
              Chào mừng trở lại
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Đăng nhập để tiếp tục hành trình đọc sách của bạn
            </p>
          </div>

          {/* Social Login */}
          <div className="space-y-3 mb-6">
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
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white dark:bg-white/8 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/12 rounded-2xl font-medium text-sm hover:bg-gray-50 dark:hover:bg-white/12 hover:border-gray-300 dark:hover:border-white/20 transition-all active:scale-98 group">
                  <div className={`w-5 h-5 rounded-lg bg-gradient-to-br ${provider.gradient} flex items-center justify-center shrink-0`}>
                    <Icon className="w-3 h-3 text-white" />
                  </div>
                  Tiếp tục với {provider.label}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-white dark:bg-[#16152B] text-gray-400">hoặc đăng nhập với tài khoản</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {errorMsg && (
              <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800/30">
                {errorMsg}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                Tên đăng nhập
              </label>
              <div className={`relative transition-all ${focusedField === 'user_name' ? 'scale-[1.01]' : ''}`}>
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={formData.user_name}
                  onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                  onFocus={() => setFocusedField('user_name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Nhập tên đăng nhập"
                  className={`w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all ${focusedField === 'user_name'
                    ? 'border-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-100/50 dark:ring-indigo-900/30 bg-white dark:bg-white/8'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                  }`}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">
                Mật khẩu
              </label>
              <div className={`relative transition-all ${focusedField === 'password' ? 'scale-[1.01]' : ''}`}>
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="••••••••"
                  className={`w-full pl-11 pr-11 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all ${focusedField === 'password'
                    ? 'border-indigo-500 dark:border-indigo-500 ring-4 ring-indigo-100/50 dark:ring-indigo-900/30 bg-white dark:bg-white/8'
                    : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={formData.remember}
                  onChange={(e) => setFormData({ ...formData, remember: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 dark:border-white/20 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
                  Ghi nhớ đăng nhập
                </span>
              </label>
              <Link to="/forgot-password" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors">
                Quên mật khẩu?
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:opacity-95 active:scale-98 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
              {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>

          </form>

          {/* Sign up link */}
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-semibold transition-colors">
              Đăng ký ngay
            </Link>
          </p>

        </div>

        {/* Decorative element */}
        <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-violet-500/20 dark:from-indigo-500/10 dark:to-violet-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -top-4 -left-4 w-32 h-32 bg-gradient-to-br from-rose-500/15 to-orange-500/15 dark:from-rose-500/10 dark:to-orange-500/10 rounded-full blur-2xl pointer-events-none" />

      </motion.div>

    </div>
  );
}
