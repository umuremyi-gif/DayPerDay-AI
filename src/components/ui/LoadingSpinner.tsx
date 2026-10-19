import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 'md', text, fullScreen }: { size?: 'sm' | 'md' | 'lg'; text?: string; fullScreen?: boolean }) {
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 32 : 24;
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? 'min-h-screen' : 'py-8'}`}>
      <Loader2 size={iconSize} className="animate-spin text-primary-500" />
      {text && <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>}
    </div>
  );
}
