import { useNavigate } from "react-router-dom";

function PatientIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ProviderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 2v2" />
      <path d="M5 2v2" />
      <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
      <path d="M8 15a6 6 0 0 0 12 0v-3" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}

function RoleCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="choice-card">
      <div className="choice-card__icon">{icon}</div>
      <span className="choice-card__title">{title}</span>
      <span className="choice-card__desc">{description}</span>
    </button>
  );
}

export function RoleChooser() {
  const navigate = useNavigate();

  return (
    <div className="landing-hero">
      <div className="landing-hero__anchor">
        <div className="landing-hero__intro">
          <img
            src="/logo.png"
            alt="ZKlaim"
            className="h-14 w-auto md:h-[4.25rem]"
            width={180}
            height={68}
          />

          <h1 className="mt-8 max-w-3xl text-3xl font-[650] leading-[1.12] tracking-tight md:mt-10 md:text-4xl lg:text-[2.75rem]">
            Private medical claims on Stellar
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground md:mt-5 md:text-lg">
            Prove your claim is valid. Receive payment. Reveal nothing about your
            diagnosis.
          </p>
        </div>

        <div className="landing-hero__cards">
          <RoleCard
            icon={<PatientIcon className="h-6 w-6" />}
            title="Enter as a Patient"
            description="Set up your identity, receive encrypted claims, and submit privately with ZK proofs."
            onClick={() => navigate("/patient/identity")}
          />
          <RoleCard
            icon={<ProviderIcon className="h-6 w-6" />}
            title="Enter as a Provider"
            description="Register as a licensed physician and send encrypted claim tokens to patients."
            onClick={() => navigate("/provider/create")}
          />
        </div>
      </div>
    </div>
  );
}
