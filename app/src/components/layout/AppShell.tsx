import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminPage } from "../../admin/AdminPage";
import { PatientIdentityPage } from "../../patient/PatientIdentityPage";
import { PatientInboxPage } from "../../patient/PatientInboxPage";
import { PatientSubmitPage } from "../../patient/PatientSubmitPage";
import { PatientHistoryPage } from "../../patient/PatientHistoryPage";
import { ProviderCreatePage } from "../../provider/ProviderCreatePage";
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
    <div className="min-h-screen bg-background select-none">
      <WalletHydrator />
      <AppNavbar />
      <main
        className={`mx-auto flex w-full max-w-[var(--page-max)] flex-col px-[var(--page-gutter)] ${
          isLanding ? "py-4 md:py-6" : "py-8"
        }`}
      >
        <div className="w-full animate-fade-in-up stagger-2">
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
