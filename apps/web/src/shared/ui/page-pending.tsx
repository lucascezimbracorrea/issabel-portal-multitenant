import { Skeleton } from '@/shared/ui/skeleton';

export function PagePending() {
  return (
    <div className="space-y-4 p-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
