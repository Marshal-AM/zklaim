interface FormFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, hint, children, className = "" }: FormFieldProps) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="section-label">{label}</span>
      {children}
      {hint ? (
        <span className="block text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
}
