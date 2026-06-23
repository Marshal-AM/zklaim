import { NavLink } from "react-router-dom";
import { WalletButton } from "../WalletButton";

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function StethoscopeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 2v2" />
      <path d="M5 2v2" />
      <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
      <path d="M8 15a6 6 0 0 0 12 0v-3" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: "/", label: "Patient", icon: UserIcon, end: true },
  { to: "/provider", label: "Provider", icon: StethoscopeIcon, end: false },
  { to: "/admin", label: "Admin", icon: ShieldIcon, end: false },
] as const;

export function AppNavbar() {
  return (
    <header className="shrink-0 bg-transparent pt-4 md:pt-6">
      <div className="flex h-[72px] w-full items-center justify-between bg-transparent px-[7.5%] transition-all duration-300">
        <div className="flex items-center gap-8 md:gap-10 lg:gap-12">
          <NavLink
            to="/"
            className="flex-shrink-0 transition-spring hover:scale-105"
            aria-label="ZKlaim home"
          >
            <img
              src="/logo.png"
              alt="ZKlaim"
              className="h-9 w-auto md:h-10"
            />
          </NavLink>

          <nav className="nav-pill" aria-label="Portal navigation">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                className={({ isActive }) =>
                  `nav-pill-btn ${isActive ? "active" : ""}`
                }
              >
                <Icon />
              </NavLink>
            ))}
          </nav>
        </div>

        <WalletButton />
      </div>
    </header>
  );
}
