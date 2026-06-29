import { Link, useLocation } from "react-router-dom";
import { getBreadcrumbs } from "../../lib/breadcrumbs";

function ChevronSeparator() {
  return (
    <svg
      className="app-breadcrumbs__sep"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AppBreadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = getBreadcrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="app-breadcrumbs">
      <ol className="app-breadcrumbs__list">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={`${crumb.label}-${index}`} className="app-breadcrumbs__item">
              {index > 0 ? <ChevronSeparator /> : null}
              {isLast || !crumb.to ? (
                <span
                  className="app-breadcrumbs__current"
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="app-breadcrumbs__link">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
