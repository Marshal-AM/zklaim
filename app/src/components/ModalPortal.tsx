import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface ModalPortalProps {
  children: ReactNode;
}

/** Render modals on document.body so position:fixed covers the full app. */
export function ModalPortal({ children }: ModalPortalProps) {
  return createPortal(children, document.body);
}
