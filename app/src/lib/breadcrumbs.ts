export interface BreadcrumbItem {
  label: string;
  to?: string;
}

const PATIENT_ROOT: BreadcrumbItem = {
  label: "Patient",
  to: "/patient/identity",
};

const PROVIDER_ROOT: BreadcrumbItem = {
  label: "Provider",
  to: "/provider/create",
};

const PASSPORT_CRUMB: BreadcrumbItem = {
  label: "Passport",
  to: "/patient/passport",
};

/** Resolve breadcrumb trail for the current pathname. */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/") return [];

  if (pathname === "/patient/identity") {
    return [PATIENT_ROOT, { label: "Identity" }];
  }
  if (pathname === "/patient/inbox") {
    return [PATIENT_ROOT, { label: "Inbox" }];
  }
  if (pathname === "/patient/submit") {
    return [PATIENT_ROOT, { label: "Submit" }];
  }
  if (pathname.startsWith("/patient/submit/")) {
    return [
      PATIENT_ROOT,
      { label: "Submit", to: "/patient/submit" },
      { label: "Review claim" },
    ];
  }
  if (pathname === "/patient/history") {
    return [PATIENT_ROOT, { label: "History" }];
  }
  if (pathname === "/patient/passport") {
    return [PATIENT_ROOT, { label: "Passport" }];
  }
  if (pathname === "/patient/passport/history") {
    return [PATIENT_ROOT, PASSPORT_CRUMB, { label: "Private history" }];
  }
  if (pathname === "/patient/passport/share") {
    return [PATIENT_ROOT, PASSPORT_CRUMB, { label: "Share credential" }];
  }

  if (pathname === "/provider/create") {
    return [PROVIDER_ROOT, { label: "Create claim" }];
  }
  if (pathname === "/provider/register") {
    return [PROVIDER_ROOT, { label: "Credential" }];
  }
  if (pathname === "/provider/history") {
    return [PROVIDER_ROOT, { label: "History" }];
  }

  if (pathname === "/admin") {
    return [{ label: "Admin" }];
  }

  return [];
}
