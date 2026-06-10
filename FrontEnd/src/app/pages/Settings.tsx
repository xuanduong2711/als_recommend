import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  User, Lock, CreditCard, Globe, ArrowLeft, Upload, Shield,
  Trash2, Check, Plus, Loader2, Eye, EyeOff
} from 'lucide-react';
import { userService } from '../../services/userService';

type SettingTab = 'profile' | 'password' | 'payment' | 'language';

export function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingTab>('profile');
  
  // STATE THÔNG TIN NGƯỜI DÙNG
  const [profileData, setProfileData] = useState({
    user_name: '',
    full_name: '',
    email: '',
    sex: 'Woman' as 'Man' | 'Woman' | 'Other',
    bio: 'Yêu sách, yêu đời, yêu những câu chuyện đưa ta đến vô số thế giới.',
    favoriteGenres: ['Fantasy', 'Science-Fiction', 'Romance'],
  });

  const [passwordData, setPasswordData] = useState({ current: '', new: '', confirm: '' });
  
  // STATE TRẠNG THÁI LOADING, LỖI & THÀNH CÔNG
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  
  // Thêm trạng thái thông báo thành công
  const [profileSuccess, setProfileSuccess] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');

  // STATE ẨN HIỆN MẬT KHẨU
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // MOCK DATA CHO CÁC TAB KHÁC
  const [savedCards, setSavedCards] = useState([
    { id: 1, brand: 'Visa', last4: '4242', expiry: '12/25', isDefault: true },
    { id: 2, brand: 'Mastercard', last4: '5555', expiry: '08/26', isDefault: false },
  ]);
  const [language, setLanguage] = useState('vi');

  const tabs = [
    { id: 'profile' as const, label: 'Hồ sơ', icon: User },
    { id: 'password' as const, label: 'Mật khẩu', icon: Lock },
    { id: 'payment' as const, label: 'Thanh toán', icon: CreditCard },
    { id: 'language' as const, label: 'Ngôn ngữ', icon: Globe },
  ];

  const allGenres = ['Fantasy', 'Science-Fiction', 'Romance', 'Self-Help', 'Mystery', 'Biography', 'Philosophy'];

  // FETCH DỮ LIỆU USER KHI MỞ TRANG
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = userService.getCurrentUserId();
        if (!userId) {
          navigate('/login');
          return;
        }
        const user = await userService.getUserById(userId);
        if (user) {
          setProfileData(prev => ({
            ...prev,
            user_name: user.user_name || '',
            full_name: user.full_name || '',
            email: user.email || '',
            sex: (user.sex as 'Man' | 'Woman' | 'Other') || 'Woman'
          }));
        }
      } catch (error) {
        console.error("Lỗi khi tải thông tin người dùng:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [navigate]);

  // HANDLER: LƯU HỒ SƠ
  const handleSaveProfile = async () => {
    const errors: Record<string, string> = {};
    if (!profileData.user_name.trim()) errors.user_name = "Tên người dùng không được để trống";
    if (!profileData.email.trim()) errors.email = "Email không được để trống";
    if (!profileData.full_name.trim()) errors.full_name = "Họ và tên không được để trống";

    if (Object.keys(errors).length > 0) {
      setProfileErrors(errors);
      setProfileSuccess(''); // Xóa thông báo thành công cũ nếu xuất hiện lỗi mới
      return;
    }

    setProfileErrors({});
    setProfileSuccess('');
    const userId = userService.getCurrentUserId();
    if (!userId) return;

    setIsSavingProfile(true);
    try {
      await userService.updateUser(userId, {
        user_name: profileData.user_name,
        email: profileData.email,
        full_name: profileData.full_name,
        sex: profileData.sex
      });
      setProfileSuccess('Cập nhật thông tin hồ sơ thành công!');
    } catch (error: any) {
      console.error(error);
      setProfileErrors({ api: error.response?.data?.message || 'Lỗi khi cập nhật hồ sơ từ máy chủ!' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  // HANDLER: ĐỔI MẬT KHẨU
  const handleSavePassword = async () => {
    const errors: Record<string, string> = {};
    if (!passwordData.current) errors.current = "Vui lòng nhập mật khẩu hiện tại";
    if (!passwordData.new) errors.new = "Vui lòng nhập mật khẩu mới";
    if (!passwordData.confirm) errors.confirm = "Vui lòng xác nhận mật khẩu mới";
    else if (passwordData.new !== passwordData.confirm) errors.confirm = "Mật khẩu xác nhận không khớp";

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      setPasswordSuccess(''); // Xóa thông báo thành công cũ nếu xuất hiện lỗi mới
      return;
    }

    setPasswordErrors({});
    setPasswordSuccess('');
    const userId = userService.getCurrentUserId();
    if (!userId) return;

    setIsSavingPassword(true);
    try {
      await userService.changePassword(userId, {
        CurrentPassword: passwordData.current,
        NewPassword: passwordData.new
      });
      setPasswordSuccess('Thay đổi mật khẩu tài khoản thành công!');
      setPasswordData({ current: '', new: '', confirm: '' }); // Reset form nhập liệu
      setShowCurrent(false); setShowNew(false); setShowConfirm(false);
    } catch (error: any) {
      console.error(error);
      setPasswordErrors({ api: error.response?.data?.message || 'Lỗi đổi mật khẩu! Kiểm tra lại mật khẩu hiện tại.' });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const toggleGenre = (genre: string) => {
    setProfileData(prev => ({
      ...prev,
      favoriteGenres: prev.favoriteGenres.includes(genre)
        ? prev.favoriteGenres.filter(g => g !== genre)
        : [...prev.favoriteGenres, genre]
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pt-24 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] pt-16">

      {/* Header */}
      <div className="bg-white/80 dark:bg-[#16152B]/80 backdrop-blur-xl border-b border-gray-100 dark:border-white/8">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4 group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">Quay lại</span>
          </button>
          <h1 className="text-gray-900 dark:text-white font-bold" style={{ fontSize: '1.8rem' }}>
            Cài đặt
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Quản lý tài khoản và tùy chỉnh trải nghiệm của bạn
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* Sidebar */}
          <aside className="lg:w-64 shrink-0">
            <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-2 shadow-sm sticky top-24">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        // Reset trạng thái thông báo cũ khi chuyển đổi tab qua lại
                        setProfileSuccess('');
                        setPasswordSuccess('');
                        setProfileErrors({});
                        setPasswordErrors({});
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all ${isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200/60 dark:shadow-indigo-900/30'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/8 hover:text-gray-900 dark:hover:text-white'
                      }`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6">

                {/* Avatar Upload */}
                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Ảnh đại diện</h3>
                  <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-2xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center shadow-inner overflow-hidden">
                      <User className="w-16 h-16 text-gray-400 dark:text-gray-500 mt-4" />
                    </div>
                    <div className="flex-1">
                      <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-white/10 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/15 rounded-2xl font-medium text-sm transition-all shadow-sm">
                        <Upload className="w-4 h-4" /> Tải ảnh mới
                      </button>
                      <p className="text-gray-400 text-xs mt-2">JPG, PNG hoặc GIF. Tối đa 5MB.</p>
                    </div>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Thông tin cơ bản</h3>
                  <div className="space-y-4">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Tên người dùng (Username)</label>
                        <input
                          type="text"
                          value={profileData.user_name}
                          onChange={(e) => {
                            setProfileData({ ...profileData, user_name: e.target.value });
                            if (profileErrors.user_name) setProfileErrors({ ...profileErrors, user_name: '' });
                          }}
                          className={`w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white outline-none transition-all ${
                            profileErrors.user_name 
                              ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                              : 'border-gray-200 dark:border-white/10 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30'
                          }`}
                        />
                        {profileErrors.user_name && <p className="text-rose-500 text-xs mt-1.5 font-medium">{profileErrors.user_name}</p>}
                      </div>
                      <div>
                        <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Địa chỉ Email</label>
                        <input
                          type="email"
                          value={profileData.email}
                          onChange={(e) => {
                            setProfileData({ ...profileData, email: e.target.value });
                            if (profileErrors.email) setProfileErrors({ ...profileErrors, email: '' });
                          }}
                          className={`w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white outline-none transition-all ${
                            profileErrors.email 
                              ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                              : 'border-gray-200 dark:border-white/10 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30'
                          }`}
                        />
                        {profileErrors.email && <p className="text-rose-500 text-xs mt-1.5 font-medium">{profileErrors.email}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Họ và tên (Full Name)</label>
                      <input
                        type="text"
                        value={profileData.full_name}
                        onChange={(e) => {
                          setProfileData({ ...profileData, full_name: e.target.value });
                          if (profileErrors.full_name) setProfileErrors({ ...profileErrors, full_name: '' });
                        }}
                        className={`w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white outline-none transition-all ${
                          profileErrors.full_name 
                            ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                            : 'border-gray-200 dark:border-white/10 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30'
                        }`}
                      />
                      {profileErrors.full_name && <p className="text-rose-500 text-xs mt-1.5 font-medium">{profileErrors.full_name}</p>}
                    </div>

                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Giới tính</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { value: 'Man', label: 'Nam', emoji: '👨' },
                          { value: 'Woman', label: 'Nữ', emoji: '👩' },
                          { value: 'Other', label: 'Khác', emoji: '🧑' },
                        ].map(option => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setProfileData({ ...profileData, sex: option.value as 'Man' | 'Woman' | 'Other' })}
                            className={`px-4 py-3 rounded-2xl font-medium text-sm border transition-all ${profileData.sex === option.value
                              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md'
                              : 'bg-white dark:bg-white/8 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/12 hover:border-gray-300 dark:hover:border-white/20'
                            }`}>
                            <span className="mr-1.5">{option.emoji}</span>
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Giới thiệu bản thân (Chưa áp dụng)</label>
                      <textarea
                        value={profileData.bio}
                        onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Favorite Genres */}
                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Thể loại yêu thích (Chưa áp dụng)</h3>
                  <div className="flex flex-wrap gap-2">
                    {allGenres.map(genre => {
                      const isSelected = profileData.favoriteGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          type="button"
                          onClick={() => toggleGenre(genre)}
                          className={`px-4 py-2.5 rounded-2xl font-medium text-sm border transition-all ${isSelected
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md'
                            : 'bg-white dark:bg-white/8 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-white/12 hover:border-gray-300 dark:hover:border-white/20'
                          }`}>
                          {genre}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* BANNER THÀNH CÔNG HỒ SƠ */}
                {profileSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    {profileSuccess}
                  </motion.div>
                )}

                {/* BANNER LỖI HỒ SƠ */}
                {profileErrors.api && (
                  <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400 text-sm font-medium">
                    {profileErrors.api}
                  </div>
                )}

                {/* Save Button */}
                <button 
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="w-full py-3.5 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:opacity-95 transition-all">
                  {isSavingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Lưu thay đổi'}
                </button>

              </motion.div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6">

                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Đổi mật khẩu</h3>
                  <div className="space-y-4">
                    
                    {/* Input Current Password */}
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Mật khẩu hiện tại</label>
                      <div className="relative">
                        <input
                          type={showCurrent ? "text" : "password"}
                          value={passwordData.current}
                          onChange={(e) => {
                            setPasswordData({ ...passwordData, current: e.target.value });
                            if (passwordErrors.current) setPasswordErrors({ ...passwordErrors, current: '' });
                          }}
                          placeholder="••••••••"
                          className={`w-full px-4 py-3 pr-10 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden ${
                            passwordErrors.current 
                              ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                              : 'border-gray-200 dark:border-white/10 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30'
                          }`}
                        />
                        <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {passwordErrors.current && <p className="text-rose-500 text-xs mt-1.5 font-medium">{passwordErrors.current}</p>}
                    </div>

                    {/* Input New Password */}
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Mật khẩu mới</label>
                      <div className="relative">
                        <input
                          type={showNew ? "text" : "password"}
                          value={passwordData.new}
                          onChange={(e) => {
                            setPasswordData({ ...passwordData, new: e.target.value });
                            if (passwordErrors.new) setPasswordErrors({ ...passwordErrors, new: '' });
                          }}
                          placeholder="••••••••"
                          className={`w-full px-4 py-3 pr-10 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden ${
                            passwordErrors.new 
                              ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                              : 'border-gray-200 dark:border-white/10 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30'
                          }`}
                        />
                        <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {passwordErrors.new && <p className="text-rose-500 text-xs mt-1.5 font-medium">{passwordErrors.new}</p>}
                    </div>

                    {/* Input Confirm Password */}
                    <div>
                      <label className="block text-gray-700 dark:text-gray-300 text-sm font-medium mb-2">Xác nhận mật khẩu mới</label>
                      <div className="relative">
                        <input
                          type={showConfirm ? "text" : "password"}
                          value={passwordData.confirm}
                          onChange={(e) => {
                            setPasswordData({ ...passwordData, confirm: e.target.value });
                            if (passwordErrors.confirm) setPasswordErrors({ ...passwordErrors, confirm: '' });
                          }}
                          placeholder="••••••••"
                          className={`w-full px-4 py-3 pr-10 bg-gray-50 dark:bg-white/5 border rounded-2xl text-gray-900 dark:text-white placeholder:text-gray-400 outline-none transition-all [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden ${
                            passwordErrors.confirm 
                              ? 'border-rose-500 focus:ring-4 focus:ring-rose-100/50 dark:focus:ring-rose-900/30' 
                              : 'border-gray-200 dark:border-white/10 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30'
                          }`}
                        />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                          {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {passwordErrors.confirm && <p className="text-rose-500 text-xs mt-1.5 font-medium">{passwordErrors.confirm}</p>}
                    </div>

                  </div>

                  {/* BANNER THÀNH CÔNG MẬT KHẨU */}
                  {passwordSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-4 py-3 mt-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 text-sm font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      {passwordSuccess}
                    </motion.div>
                  )}

                  {/* BANNER LỖI MẬT KHẨU */}
                  {passwordErrors.api && (
                    <div className="px-4 py-3 mt-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400 text-sm font-medium">
                      {passwordErrors.api}
                    </div>
                  )}

                  <button 
                    onClick={handleSavePassword}
                    disabled={isSavingPassword}
                    className="w-full py-3.5 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-semibold shadow-lg shadow-indigo-200/60 dark:shadow-indigo-900/30 hover:opacity-95 transition-all mt-6">
                    {isSavingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cập nhật mật khẩu'}
                  </button>
                </div>

                {/* Security Status */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 rounded-3xl border border-emerald-100 dark:border-emerald-800/30 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30">
                      <Shield className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-emerald-900 dark:text-emerald-300 font-bold mb-1">Bảo mật tốt</h4>
                      <p className="text-emerald-700 dark:text-emerald-400 text-sm">
                        Tài khoản của bạn được bảo vệ với mật khẩu mạnh và xác thực hai yếu tố.
                      </p>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* Payment Tab */}
            {activeTab === 'payment' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6">

                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-gray-900 dark:text-white font-semibold">Thẻ đã lưu</h3>
                    <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-medium text-sm hover:opacity-95 transition-all shadow-md">
                      <Plus className="w-4 h-4" /> Thêm thẻ
                    </button>
                  </div>

                  <div className="space-y-3">
                    {savedCards.map((card) => (
                      <div key={card.id}
                        className="flex items-center gap-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-white/5 dark:to-white/3 rounded-2xl border border-gray-200/80 dark:border-white/10">
                        <div className={`w-12 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-md ${card.brand === 'Visa' ? 'bg-gradient-to-br from-blue-600 to-blue-700' : 'bg-gradient-to-br from-orange-600 to-red-600'
                          }`}>
                          {card.brand}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-white font-semibold text-sm">•••• {card.last4}</p>
                          <p className="text-gray-400 text-xs">Hết hạn {card.expiry}</p>
                        </div>
                        {card.isDefault && (
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" /> Mặc định
                          </span>
                        )}
                        <button className="p-2 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment History Preview */}
                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Lịch sử thanh toán gần đây</h3>
                  <div className="space-y-3">
                    {[
                      { id: 1, book: 'The Shadow Realm', amount: 45000, date: '10/05/2026' },
                      { id: 2, book: 'Rewired Mind', amount: 55000, date: '08/05/2026' },
                      { id: 3, book: 'Beneath the Olive Tree', amount: 29000, date: '05/05/2026' },
                    ].map(tx => (
                      <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-white/8 last:border-0">
                        <div>
                          <p className="text-gray-900 dark:text-white font-medium text-sm">{tx.book}</p>
                          <p className="text-gray-400 text-xs">{tx.date}</p>
                        </div>
                        <p className="text-indigo-600 dark:text-indigo-400 font-bold text-sm">{tx.amount.toLocaleString('vi-VN')}₫</p>
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-2.5 mt-4 bg-gray-50 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-2xl font-medium text-sm hover:bg-gray-100 dark:hover:bg-white/8 transition-colors">
                    Xem tất cả
                  </button>
                </div>

              </motion.div>
            )}

            {/* Language Tab */}
            {activeTab === 'language' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6">

                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Ngôn ngữ hiển thị</h3>
                  <div className="space-y-3">
                    {[
                      { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
                      { code: 'en', label: 'English', flag: '🇺🇸' },
                      { code: 'ja', label: '日本語', flag: '🇯🇵' },
                      { code: 'ko', label: '한국어', flag: '🇰🇷' },
                    ].map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => setLanguage(lang.code)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${language === lang.code
                          ? 'bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 border-indigo-200 dark:border-indigo-800/50'
                          : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/15'
                        }`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{lang.flag}</span>
                          <span className={`font-medium ${language === lang.code ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                            {lang.label}
                          </span>
                        </div>
                        {language === lang.code && (
                          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white/90 dark:bg-[#16152B]/90 backdrop-blur-xl rounded-3xl border border-gray-100/80 dark:border-white/8 p-6 shadow-sm">
                  <h3 className="text-gray-900 dark:text-white font-semibold mb-4">Múi giờ</h3>
                  <select className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl text-gray-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 dark:focus:ring-indigo-900/30 transition-all">
                    <option className="dark:bg-[#16152B] dark:text-white" value="Asia/Ho_Chi_Minh">(GMT+7) Hồ Chí Minh</option>
                    <option className="dark:bg-[#16152B] dark:text-white" value="Asia/Bangkok">(GMT+7) Bangkok</option>
                    <option className="dark:bg-[#16152B] dark:text-white" value="Asia/Tokyo">(GMT+9) Tokyo</option>
                    <option className="dark:bg-[#16152B] dark:text-white" value="America/New_York">(GMT-5) New York</option>
                  </select>
                </div>

              </motion.div>
            )}

          </main>

        </div>
      </div>

    </div>
  );
}