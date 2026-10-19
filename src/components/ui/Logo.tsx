import { CalendarCheck } from 'lucide-react';

export default function Logo({ size = 'md', showText = true }: { size?: 'sm' | 'md' | 'lg'; showText?: boolean }) {
  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg';

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <div className="absolute inset-0 bg-primary-500 blur-lg opacity-30 rounded-lg" />
        <div className="relative flex items-center justify-center w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl shadow-md">
          <CalendarCheck size={iconSize} className="text-white" />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-display font-bold ${textSize} text-slate-900 dark:text-white`}>
            DayPerDay
          </span>
          <span className="text-[10px] font-medium text-primary-600 dark:text-primary-400 tracking-wider uppercase">
            AI
          </span>
        </div>
      )}
    </div>
  );
}
