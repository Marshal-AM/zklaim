interface SectionCardProps {
  title?: string;
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  label,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section className={`card-padded space-y-4 ${className}`}>
      {label ? <p className="section-label">{label}</p> : null}
      {title ? (
        <h3 className="text-lg font-[650] tracking-tight">{title}</h3>
      ) : null}
      {children}
    </section>
  );
}
