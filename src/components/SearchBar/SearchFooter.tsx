import { ChevronUp, ChevronDown } from 'lucide-react';

export function SearchFooter() {
  return (
    <div className="border-t border-base-300 bg-base-200 px-4 py-2">
      <div className="flex items-center gap-3 text-xs text-base-content/50">
        <div className="flex items-center gap-1">
          <kbd className="w-5 h-5 border border-base-300 rounded flex items-center justify-center bg-base-100 text-[10px]"><ChevronUp className="w-3 h-3" /></kbd>
          <kbd className="w-5 h-5 border border-base-300 rounded flex items-center justify-center bg-base-100 text-[10px]"><ChevronDown className="w-3 h-3" /></kbd>
          <span className="ml-1">Vybrat</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="h-5 px-1.5 border border-base-300 rounded flex items-center justify-center bg-base-100 min-w-[20px] text-[10px]">↵</kbd>
          <span className="ml-1">Otevřít</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="h-5 px-1.5 border border-base-300 rounded flex items-center justify-center bg-base-100 text-[10px]">Esc</kbd>
          <span className="ml-1">Zavřít</span>
        </div>
      </div>
    </div>
  );
}
