interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="error-card px-4 py-3 text-sm text-destructive">{message}</div>
  );
}
