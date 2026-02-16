import { User, Loader2 } from 'lucide-react';

interface ClassmatesListSkeletonProps {
    message?: string;
}

/**
 * ClassmatesSkeleton - Loading skeleton for classmates list
 */
export function ClassmatesListSkeleton({ message }: ClassmatesListSkeletonProps = {}) {
    return (
        <div className="flex-1 overflow-y-auto p-4">
            {/* Progress message */}
            {message && (
                <div className="flex items-center gap-2 text-xs text-base-content/70 font-medium mb-4 px-3 py-2 bg-base-200/50 rounded-lg animate-in fade-in slide-in-from-top-1">
                    <Loader2 size={12} className="text-primary animate-spin" />
                    <span>{message}</span>
                </div>
            )}
            
            <div className="grid grid-cols-1 gap-3">
                {[...Array(8)].map((_, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-base-200 bg-base-100 animate-pulse">
                        <div className="flex items-center gap-4">
                            {/* Avatar skeleton */}
                            <div className="avatar">
                                <div className="w-12 h-12 rounded-full ring-1 ring-base-200 ring-offset-base-100 ring-offset-2 bg-base-300 flex items-center justify-center">
                                    <User size={20} className="text-base-content/20" />
                                </div>
                            </div>

                            {/* Info skeleton */}
                            <div className="flex flex-col gap-2">
                                <div className="h-4 bg-base-300 rounded w-32"></div>
                                <div className="h-3 bg-base-300 rounded w-24"></div>
                            </div>
                        </div>

                        {/* Action skeleton */}
                        <div className="w-10 h-10 rounded-full bg-base-300"></div>
                    </div>
                ))}
            </div>
        </div>
    );
}
