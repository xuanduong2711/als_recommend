import { motion } from 'motion/react';
import { Flame, Target, BookOpen, Trophy, Calendar } from 'lucide-react';
// THÊM DÒNG NÀY: Import userService để kiểm tra đăng nhập
import { userService } from '../../services/userService'; 

export function ReadingStreak() {
  // KIỂM TRA TRẠNG THÁI ĐĂNG NHẬP
  const isLoggedIn = userService.isLoggedIn();

  // NẾU CHƯA ĐĂNG NHẬP THÌ ẨN HOÀN TOÀN COMPONENT NÀY
  if (!isLoggedIn) return null;

  const streak = 12;
  const goal = 15;
  const booksRead = 4;
  const monthDays = 31;
  const readDays = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
  const today = 26; // Demo: May 26, showing 12-day streak (days 15-26)

  const stats = [
    { icon: Flame, label: 'Chuỗi hiện tại', value: `${streak} ngày`, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/15' },
    { icon: BookOpen, label: 'Sách đã đọc', value: `${booksRead} cuốn`, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/15' },
    { icon: Target, label: 'Mục tiêu tháng', value: `${booksRead}/${goal} ngày`, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/15' },
    { icon: Trophy, label: 'Huy chương', value: '3 cái', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/15' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8"
    >
      <div className="bg-white dark:bg-[#16152B] rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-white/5">
        <div className="grid lg:grid-cols-2 gap-8">

          {/* Left: streak visual */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md shadow-orange-200 dark:shadow-orange-900/30">
                <Flame className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3
                  className="text-gray-900 dark:text-white"
                  style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, fontSize: '1.15rem' }}
                >
                  Chuỗi đọc sách của bạn
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tháng 5 năm 2026</p>
              </div>
            </div>

            {/* Big streak number */}
            <div className="flex items-baseline gap-3 mb-5">
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="text-6xl font-black bg-gradient-to-br from-orange-400 to-rose-500 bg-clip-text text-transparent"
              >
                {streak}
              </motion.span>
              <span className="text-gray-500 dark:text-gray-400 text-lg">ngày liên tiếp 🔥</span>
            </div>

            {/* Calendar dots */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Các ngày đã đọc trong tháng
              </p>
              <div className="grid grid-cols-7 gap-1.5">
                {['T2','T3','T4','T5','T6','T7','CN'].map(d => (
                  <div key={d} className="text-center text-[10px] text-gray-400 font-medium pb-1">{d}</div>
                ))}
                {/* Empty cells for start of month (May 2026 starts on Friday) */}
                {[...Array(4)].map((_, i) => <div key={`e-${i}`} />)}
                {[...Array(monthDays)].map((_, i) => {
                  const day = i + 1;
                  const isRead = readDays.includes(day);
                  const isToday = day === today;
                  const isFuture = day > today;
                  return (
                    <motion.div
                      key={day}
                      initial={{ scale: 0, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.01 + 0.2, duration: 0.3 }}
                      className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-semibold transition-all ${
                        isFuture
                          ? 'bg-gray-50 dark:bg-white/5 text-gray-300 dark:text-gray-600'
                          : isRead
                          ? 'bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-white/8 text-gray-500 dark:text-gray-500'
                      } ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                    >
                      {day}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: stats */}
          <div className="space-y-4">
            <h4 className="text-gray-700 dark:text-gray-300 font-semibold text-sm mb-1">Thống kê của bạn</h4>

            {stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
                className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-white/5"
              >
                <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <p className="text-gray-900 dark:text-white font-bold text-base">{stat.value}</p>
                </div>
              </motion.div>
            ))}

            {/* Goal progress */}
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">Tiến độ mục tiêu</span>
                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-400">{Math.round((booksRead / goal) * 100)}%</span>
              </div>
              <div className="h-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(booksRead / goal) * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                />
              </div>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70 mt-1.5">
                Còn {goal - booksRead} ngày nữa để đạt mục tiêu!
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}