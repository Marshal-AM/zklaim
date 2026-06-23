import { DoctorEnrollment } from "./DoctorEnrollment";
import { FraudPatterns } from "./FraudPatterns";
import { PolicyRegistration } from "./PolicyRegistration";
import { EscrowBalance } from "./EscrowBalance";

export function AdminPage() {
  return (
    <section className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Admin Panel</h2>
        <p className="text-slate-400 text-sm mt-1">
          Insurer ASP enrollment, fraud patterns, policy registration, and
          escrow management.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <h3 className="font-medium">Escrow USDC reserve</h3>
        <EscrowBalance />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <h3 className="font-medium">ASP doctor enrollment</h3>
        <DoctorEnrollment />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <h3 className="font-medium">Fraud pattern management</h3>
        <FraudPatterns />
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 space-y-4">
        <h3 className="font-medium">Policy registration</h3>
        <PolicyRegistration />
      </div>
    </section>
  );
}
