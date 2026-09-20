import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, details: ErrorInfo) {
    console.error('Aegis could not render the current page.', error, details.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-ink-950 px-5 text-center">
        <div className="max-w-xl border border-signal-500/30 bg-ink-900/70 p-8">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-signal-400">AEGIS UPDATED</p>
          <h1 className="massive mt-4 text-4xl text-bone-50">RELOAD REQUIRED.</h1>
          <p className="mt-4 text-sm leading-relaxed text-bone-400">
            This tab could not load the current version of Aegis. Your work and payment state are safe.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-7 min-h-11 border border-signal-500/45 bg-signal-500/10 px-6 font-mono text-xs uppercase tracking-wider text-signal-300"
          >
            RELOAD AEGIS
          </button>
        </div>
      </main>
    );
  }
}

