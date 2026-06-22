import { Link, Route, Routes } from "react-router-dom";
import { AdminPage } from "./admin/AdminPage";
import { PatientPage } from "./patient/PatientPage";
import { ProviderPage } from "./provider/ProviderPage";

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">ZKlaim</h1>
        <nav className="flex gap-4 text-sm text-slate-400">
          <Link to="/" className="hover:text-white">
            Patient
          </Link>
          <Link to="/provider" className="hover:text-white">
            Provider
          </Link>
          <Link to="/admin" className="hover:text-white">
            Admin
          </Link>
        </nav>
      </header>
      <main className="p-6">
        <Routes>
          <Route path="/" element={<PatientPage />} />
          <Route path="/provider" element={<ProviderPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
