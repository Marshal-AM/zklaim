interface PageGridProps {
  children: React.ReactNode;
  className?: string;
}

/** Two-column page layout — matches CredFlow `xl:grid-cols-[1.05fr_1fr]`. */
export function PageGrid({ children, className = "" }: PageGridProps) {
  return (
    <div
      className={`grid gap-6 lg:grid-cols-2 lg:items-start xl:grid-cols-[1.05fr_1fr] ${className}`}
    >
      {children}
    </div>
  );
}

interface PageColumnProps {
  children: React.ReactNode;
  className?: string;
  sticky?: boolean;
}

export function PageColumn({
  children,
  className = "",
  sticky = false,
}: PageColumnProps) {
  return (
    <div
      className={`space-y-6 ${sticky ? "lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)] lg:overflow-y-auto" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/** Full-width page wrapper — no inner max-width cap. */
export function PageContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`w-full space-y-6 ${className}`}>{children}</section>;
}
