import { Link, useLocation } from "react-router-dom";
import { WalletButton } from "../WalletButton";
import { PortalTabBar, type PortalTab } from "../ui/PortalTabBar";

const PATIENT_TABS: PortalTab[] = [
  { to: "/patient/identity", label: "Identity" },
  { to: "/patient/inbox", label: "Inbox" },
  { to: "/patient/submit", label: "Submit", matchPrefix: true },
  { to: "/patient/passport", label: "Passport", matchPrefix: true },
  { to: "/patient/history", label: "History" },
];

const PROVIDER_TABS: PortalTab[] = [
  { to: "/provider/create", label: "Create claim" },
  { to: "/provider/register", label: "Credential" },
  { to: "/provider/history", label: "History" },
];

function portalFromPath(pathname: string): "patient" | "provider" | null {
  if (pathname.startsWith("/patient")) return "patient";
  if (pathname.startsWith("/provider")) return "provider";
  return null;
}

export function AppNavbar() {
  const { pathname } = useLocation();
  const portal = portalFromPath(pathname);
  const isLanding = pathname === "/";

  return (
    <header className="shrink-0 bg-transparent pt-4 md:pt-6">
      <div className="flex h-[72px] w-full items-center justify-between bg-transparent px-[7.5%] transition-all duration-300">
        <div className="flex min-w-0 items-center gap-6 md:gap-8 lg:gap-10">
          {!isLanding ? (
            <Link
              to="/"
              className="flex-shrink-0 transition-spring hover:scale-105"
              aria-label="ZKlaim home"
            >
              <img
                src="/logo.png"
                alt="ZKlaim"
                className="h-9 w-auto md:h-10"
              />
            </Link>
          ) : null}

          {portal === "patient" ? (
            <PortalTabBar tabs={PATIENT_TABS} ariaLabel="Patient portal" />
          ) : null}
          {portal === "provider" ? (
            <PortalTabBar tabs={PROVIDER_TABS} ariaLabel="Provider portal" />
          ) : null}
        </div>

        <WalletButton />
      </div>
    </header>
  );
}
