import { useRouteError, useNavigate } from 'react-router';
import { Home, ArrowLeft } from 'lucide-react';

export function ErrorPage() {
  const error = useRouteError() as any;
  const navigate = useNavigate();

  // Kiểm tra xem có phải lỗi 404 (Không tìm thấy trang) hay không
  const is404 = error?.status === 404;

  return (
    <div className="min-h-screen bg-[#F8F7F4] dark:bg-[#0D0C14] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <span className="text-7xl block mb-6">{is404 ? '🛸' : '💥'}</span>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 font-serif">
          {is404 ? 'Ôi không! Lạc đường rồi' : 'Có lỗi xảy ra!'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {is404 
            ? 'Trang bạn đang tìm kiếm không tồn tại hoặc đã bị gỡ bỏ.' 
            : error?.statusText || error?.message || 'Hệ thống đang gặp chút trục trặc nhỏ. Vui lòng thử lại sau.'}
        </p>

        <div className="flex items-center justify-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-200/50 hover:opacity-90 transition-all"
          >
            <Home className="w-4 h-4" /> Về Trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}