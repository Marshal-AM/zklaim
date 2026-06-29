interface StepFormLayoutProps {
  children: React.ReactNode;
  /** md ≈ 28rem fields; lg ≈ 32rem for wider grids */
  size?: "md" | "lg";
  className?: string;
  /** Parent already constrains width (e.g. narrow SectionCard) */
  fitParent?: boolean;
}

const widthClass = {
  md: "max-w-md",
  lg: "max-w-lg",
} as const;

export function StepFormLayout({
  children,
  size = "md",
  className = "",
  fitParent = false,
}: StepFormLayoutProps) {
  const layoutClass = fitParent
    ? "w-full min-w-0 max-w-full"
    : `mx-auto w-full min-w-0 ${widthClass[size]}`;

  return <div className={`${layoutClass} ${className}`}>{children}</div>;
}
