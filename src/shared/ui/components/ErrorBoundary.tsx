"use client";

import { Component, type ReactNode } from "react";

/**
 * Generic render-error boundary (design-system.md "Error" state: specific,
 * human, paired with a next step — never a raw crash). Foundation-scope
 * feature shells use this to catch each feature's seam-hook stub, which
 * intentionally throws until its real logic change lands (design.md §7
 * sequencing) — see modules/*\/ui/*Screen.tsx.
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: (error: Error) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}
