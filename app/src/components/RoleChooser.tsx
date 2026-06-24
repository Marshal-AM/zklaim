import { useNavigate } from "react-router-dom";

const CARD_CLASS =
  "group flex flex-col items-center rounded-lg border border-border/50 bg-muted/15 px-5 py-6 text-center transition-colors hover:border-primary/35 hover:bg-primary/10 w-full";

const ICON_BOX_CLASS =
  "flex items-center justify-center rounded-md bg-muted/40 text-muted-foreground transition-colors group-hover:bg-primary/20 group-hover:text-primary";

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
    <button type="button" onClick={onClick} className={CARD_CLASS}>
      <div className={`mb-4 h-12 w-12 ${ICON_BOX_CLASS}`}>{icon}</div>
      <span className="text-base font-[650] text-foreground">{title}</span>
      <span className="mt-2 max-w-[14rem] text-sm leading-relaxed text-muted-foreground transition-colors group-hover:text-primary">
        {description}
      </span>
    </button>
  );
}

export function RoleChooser() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[calc(100svh-9rem)] flex-col items-center justify-center px-4 py-10 text-center md:py-14">
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

      <div className="mt-12 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2 md:mt-14">
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
  );
}
