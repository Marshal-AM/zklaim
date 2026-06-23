interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-8 shrink-0 animate-fade-in-up">
      <h1 className="page-title">{title}</h1>
      <p className="page-subtitle mt-1">{subtitle}</p>
    </div>
  );
}
