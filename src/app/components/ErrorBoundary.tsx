import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F5F3EE] flex flex-col items-center justify-center gap-5 px-4">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div className="text-center max-w-md">
          <h1 className="text-[#0A0A0A] text-xl font-bold mb-2">Что-то пошло не так</h1>
          <p className="text-[#6B6B6B] text-sm leading-relaxed">
            Произошла непредвиденная ошибка. Попробуйте обновить страницу.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 text-xs text-left overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0047FF] hover:bg-[#0038CC] text-white rounded-xl text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Обновить страницу
        </button>
      </div>
    );
  }
}
