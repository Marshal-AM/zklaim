import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { VerifierCheckPage } from "../../verifier/VerifierCheckPage";
import { AdminPage } from "../../admin/AdminPage";
import { PatientIdentityPage } from "../../patient/PatientIdentityPage";
import { PatientInboxPage } from "../../patient/PatientInboxPage";
import { PatientSubmitPage } from "../../patient/PatientSubmitPage";
import { PatientHistoryPage } from "../../patient/PatientHistoryPage";
import { PatientPassportPage } from "../../patient/PatientPassportPage";
import { PatientPassportHistoryPage } from "../../patient/PatientPassportHistoryPage";
import { PatientPassportSharePage } from "../../patient/PatientPassportSharePage";
import { ProviderCreatePage } from "../../provider/ProviderCreatePage";
import { ProviderRegisterPage } from "../../provider/ProviderRegisterPage";
import { ProviderHistoryPage } from "../../provider/ProviderHistoryPage";
import { HomePage } from "../../pages/HomePage";
import { WalletHydrator } from "../WalletHydrator";
import { PatientWalletHydrator } from "../PatientWalletHydrator";
import { ProviderWalletHydrator } from "../ProviderWalletHydrator";
import { PatientLayout } from "./PatientLayout";
import { ProviderLayout } from "./ProviderLayout";
import { AppNavbar } from "./AppNavbar";
import { AppBreadcrumbs } from "../ui/AppBreadcrumbs";

export function AppShell() {
  const { pathname } = useLocation();
  const isLanding = pathname === "/";

  return (
    <div className="flex min-h-screen min-w-0 flex-col overflow-x-clip bg-background">
      <WalletHydrator />
      <PatientWalletHydrator />
      <ProviderWalletHydrator />
      <AppNavbar />
      <main
        className={
          isLanding
            ? "flex flex-1 flex-col px-[var(--page-gutter)]"
            : "mx-auto flex w-full min-w-0 max-w-[var(--page-max)] flex-col overflow-x-clip px-[var(--page-gutter)] py-8"
        }
      >
        <div
          className={
            isLanding
              ? "flex w-full max-w-[var(--page-max)] flex-1 flex-col animate-fade-in-up stagger-2"
              : "w-full min-w-0 max-w-full overflow-x-clip animate-fade-in-up stagger-2"
          }
        >
          {!isLanding ? <AppBreadcrumbs /> : null}
          <Routes>
            <Route path="/" element={<HomePage />} />

            <Route
              path="/patient"
              element={<Navigate to="/patient/identity" replace />}
            />
            <Route
              path="/patient/identity"
              element={
                <PatientLayout tab="identity">
                  <PatientIdentityPage />
                </PatientLayout>
              }
            />
            <Route
              path="/patient/inbox"
              element={
                <PatientLayout tab="inbox">
                  <PatientInboxPage />
                </PatientLayout>
              }
            />
            <Route
              path="/patient/submit"
              element={
                <PatientLayout tab="submit">
                  <PatientSubmitPage />
                </PatientLayout>
              }
            />
            <Route
              path="/patient/submit/:claimId"
              element={
                <PatientLayout tab="submit">
                  <PatientSubmitPage />
                </PatientLayout>
              }
            />
            <Route
              path="/patient/history"
              element={
                <PatientLayout tab="history">
                  <PatientHistoryPage />
                </PatientLayout>
              }
            />
            <Route
              path="/patient/passport"
              element={
                <PatientLayout tab="passport">
                  <PatientPassportPage />
                </PatientLayout>
              }
            />
            <Route
              path="/patient/passport/history"
              element={
                <PatientLayout tab="passport">
                  <PatientPassportHistoryPage />
                </PatientLayout>
              }
            />
            <Route
              path="/patient/passport/share"
              element={
                <PatientLayout tab="passport">
                  <PatientPassportSharePage />
                </PatientLayout>
              }
            />

            <Route
              path="/provider"
              element={<Navigate to="/provider/create" replace />}
            />
            <Route
              path="/provider/create"
              element={
                <ProviderLayout tab="create">
                  <ProviderCreatePage />
                </ProviderLayout>
              }
            />
            <Route
              path="/provider/register"
              element={
                <ProviderLayout tab="register">
                  <ProviderRegisterPage />
                </ProviderLayout>
              }
            />
            <Route
              path="/provider/history"
              element={
                <ProviderLayout tab="history">
                  <ProviderHistoryPage />
                </ProviderLayout>
              }
            />

            <Route path="/admin" element={<AdminPage />} />
            <Route path="/verifier" element={<VerifierCheckPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
