import { NavLink } from "react-router-dom";

export interface PortalTab {
  to: string;
  label: string;
  /** Match pathname prefix (e.g. submit + submit/:id). */
  matchPrefix?: boolean;
}

interface PortalTabBarProps {
  tabs: PortalTab[];
  ariaLabel: string;
}

export function PortalTabBar({ tabs, ariaLabel }: PortalTabBarProps) {
  return (
    <nav className="tab-pill-bar w-fit" aria-label={ariaLabel}>
      {tabs.map(({ to, label, matchPrefix }) => (
        <NavLink
          key={to}
          to={to}
          end={!matchPrefix}
          className={({ isActive }) =>
            `tab-pill-btn ${isActive ? "active" : ""}`
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
