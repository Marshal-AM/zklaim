import { Navigate, Route, Routes, useLocation } from "react-router-dom";
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
import { PatientLayout } from "./PatientLayout";
import { ProviderLayout } from "./ProviderLayout";
import { AppNavbar } from "./AppNavbar";

export function AppShell() {
  const { pathname } = useLocation();
  const isLanding = pathname === "/";

  return (
    <div className="flex min-h-screen flex-col bg-background select-none">
      <WalletHydrator />
      <AppNavbar />
      <main
        className={
          isLanding
            ? "flex flex-1 flex-col px-[var(--page-gutter)]"
            : "mx-auto flex w-full max-w-[var(--page-max)] flex-col px-[var(--page-gutter)] py-8"
        }
      >
        <div
          className={
            isLanding
              ? "flex w-full max-w-[var(--page-max)] flex-1 flex-col animate-fade-in-up stagger-2"
              : "w-full animate-fade-in-up stagger-2"
          }
        >
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
          </Routes>
        </div>
      </main>
    </div>
  );
}
