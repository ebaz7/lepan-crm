
import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// Fix: Use React.Component explicitly instead of destructured import to ensure proper type inheritance.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Fix: Initialize state using property initializer for better compatibility with modern TypeScript.
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  // Fix: Ensure the static method returns the correct state shape for the component.
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  // Fix: setState is now correctly inherited from React.Component.
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Critical Application Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    // Fix: state property is now correctly inherited from React.Component.
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center" dir="rtl">
          <div className="bg-white p-8 rounded-2xl shadow-2xl border border-red-100 max-w-md w-full animate-fade-in">
            <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-red-600" size={40} />
            </div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">خطای سیستمی</h1>
            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
              متاسفانه برنامه با یک خطای غیرمنتظره مواجه شد.<br/>
              لطفاً صفحه را رفرش کنید.
            </p>
            
            <div className="bg-gray-100 p-4 rounded-xl text-left dir-ltr mb-6 overflow-auto max-h-40 border border-gray-200">
              <code className="text-xs text-red-600 font-mono break-all font-bold">
                {this.state.error?.message || 'Unknown Error'}
              </code>
            </div>

            <button 
                onClick={() => window.location.reload()} 
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
                <RefreshCcw size={20} />
                <span>تلاش مجدد (رفرش)</span>
            </button>
          </div>
        </div>
      );
    }

    // Fix: props property is now correctly inherited from React.Component.
    return this.props.children;
  }
}

export default ErrorBoundary;
