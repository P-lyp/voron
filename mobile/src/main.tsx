import React, { Component, ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { registerPwaServiceWorker } from './utils/pwa.js';
import { PwaInstallGate } from './components/PwaInstallGate.js';
import './index.css';

registerPwaServiceWorker();

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl p-6 shadow-md border border-stone-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-base font-bold text-stone-900">
              Ocorreu um erro ao carregar a interface
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed font-mono bg-stone-50 p-3 rounded-xl border border-stone-200/80 text-left overflow-auto max-h-36">
              {this.state.error?.message || 'Erro inesperado'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 bg-[#0f3928] text-white text-xs font-semibold rounded-xl hover:bg-[#154c36] active:scale-95 transition-all cursor-pointer"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <PwaInstallGate>
          <App />
        </PwaInstallGate>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
