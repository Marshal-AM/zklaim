import { Routes, Route } from "react-router-dom";
import { AdminPage } from "../../admin/AdminPage";
import { PatientPage } from "../../patient/PatientPage";
import { ProviderPage } from "../../provider/ProviderPage";
import { WalletHydrator } from "../WalletHydrator";
import { AppNavbar } from "./AppNavbar";

export function AppShell() {
  return (
    <div className="min-h-screen bg-background select-none">
      <WalletHydrator />
      <AppNavbar />
      <main className="mx-auto flex w-full max-w-[var(--page-max)] flex-col px-[var(--page-gutter)] py-8">
        <div className="w-full animate-fade-in-up stagger-2">
          <Routes>
            <Route path="/" element={<PatientPage />} />
            <Route path="/provider" element={<ProviderPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
