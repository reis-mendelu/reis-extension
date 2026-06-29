import { Clock, BookOpen, Briefcase } from 'lucide-react';
import type { SearchResult } from './types';

interface SearchResultItemProps {
  result: SearchResult;
  isRecent: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function SearchResultItem({ result, isRecent, isSelected, onMouseEnter, onMouseDown }: SearchResultItemProps) {
  const getIcon = () => {
    if (isRecent) return <Clock className="w-4 h-4 text-base-content/40" />;
    if (result.type === 'person') {
      const bg = result.personType === 'student' ? 'bg-info/20' : result.personType === 'teacher' ? 'bg-secondary/20' : 'bg-base-200';
      const color = result.personType === 'student' ? 'text-info' : result.personType === 'teacher' ? 'text-secondary' : 'text-base-content/60';
      return (
        <div className={`w-6 h-6 rounded-full ${bg} flex items-center justify-center`}>
          <Briefcase className={`w-3.5 h-3.5 ${color}`} />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
        <BookOpen className="w-3.5 h-3.5 text-primary" />
      </div>
    );
  };

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      className={`w-full px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors text-left ${isSelected ? 'bg-primary/10' : 'hover:bg-base-200'}`}
    >
      <div className="flex-shrink-0">{getIcon()}</div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm text-base-content truncate">{result.title}</span>
          {!isRecent && (
            <>
              <span className="text-base-content/40 flex-shrink-0">•</span>
              <span className="text-xs text-base-content/50 flex-shrink-0">{result.detail}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
