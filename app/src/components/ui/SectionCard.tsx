interface SectionCardProps {
  title?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
  /** Constrain card width to match centered step forms */
  size?: "full" | "md" | "lg" | "fit";
}

const sizeClass = {
  full: "min-w-0 w-full max-w-full",
  md: "mx-auto w-full min-w-0 max-w-md",
  lg: "mx-auto w-full min-w-0 max-w-lg",
  fit: "form-card--fit",
} as const;

export function SectionCard({
  title,
  label,
  children,
  className = "",
  size = "full",
}: SectionCardProps) {
  return (
    <section
      className={`card-padded space-y-4 ${sizeClass[size]} ${className}`}
    >
      {label ? <p className="section-label">{label}</p> : null}
      {title ? (
        <h3 className="text-lg font-[650] tracking-tight">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}
