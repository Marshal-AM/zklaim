import type { ReactNode } from "react";

interface DetailListProps {
  children: ReactNode;
  className?: string;
}

export function DetailList({ children, className = "" }: DetailListProps) {
  return <dl className={`detail-list ${className}`}>{children}</dl>;
}

interface DetailRowProps {
  term: string;
  value: ReactNode;
  /** Use monospace + aggressive break for hashes and addresses */
  mono?: boolean;
}

export function DetailRow({ term, value, mono = false }: DetailRowProps) {
  return (
    <div className="detail-list__row">
      <dt className="detail-list__term">{term}</dt>
      <dd
        className={`detail-list__value ${mono ? "detail-list__value--mono" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
