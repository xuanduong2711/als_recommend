import { BookOpen, Twitter, Facebook, Instagram, Youtube, Heart } from 'lucide-react';

export function Footer() {
  const links = {
    'Khám phá': ['Trang chủ', 'Thể loại', 'Xu hướng', 'Sách mới', 'Bestsellers'],
    'Hỗ trợ': ['Trung tâm hỗ trợ', 'Liên hệ', 'Câu hỏi thường gặp', 'Báo lỗi'],
    'Tài khoản': ['Đăng nhập', 'Đăng ký', 'Thư viện của tôi', 'Lịch sử mua', 'Cài đặt'],
    'Công ty': ['Về chúng tôi', 'Blog', 'Nghề nghiệp', 'Điều khoản', 'Quyền riêng tư'],
  };

  const socials = [
    { Icon: Twitter, href: '#' },
    { Icon: Facebook, href: '#' },
    { Icon: Instagram, href: '#' },
    { Icon: Youtube, href: '#' },
  ];

  return (
    <footer className="bg-gray-900 dark:bg-[#0A0917] text-gray-300 mt-20">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-white" />
              </div>
              <span className="text-white" style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.1rem' }}>
                InkShelf
              </span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              Nền tảng đọc sách trả phí theo từng cuốn — chất lượng, tiện lợi, và đầy cảm hứng.
            </p>
            <div className="flex items-center gap-3">
              {socials.map(({ Icon, href }) => (
                <a key={href} href={href} className="w-8 h-8 rounded-xl bg-gray-800 dark:bg-white/5 hover:bg-gray-700 dark:hover:bg-white/10 flex items-center justify-center transition-colors">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-white font-semibold text-sm mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item}>
                    <a href="#" className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600 flex items-center gap-1.5">
            © 2026 InkShelf. Được xây dựng với
            <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
            tại Việt Nam.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-600">
            <a href="#" className="hover:text-gray-400 transition-colors">Điều khoản dịch vụ</a>
            <span>·</span>
            <a href="#" className="hover:text-gray-400 transition-colors">Chính sách bảo mật</a>
            <span>·</span>
            <a href="#" className="hover:text-gray-400 transition-colors">Cookie</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
