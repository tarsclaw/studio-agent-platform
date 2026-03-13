interface LoadingSkeletonProps {
  className?: string;
}

export function LoadingSkeleton({ className = '' }: LoadingSkeletonProps) {
  return <div className={`loading-skeleton rounded-xl ${className}`.trim()} />;
}
