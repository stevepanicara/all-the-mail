import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '16px', opacity: 0.3 }}>&#9888;</div>
          <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-1)', marginBottom: '8px' }}>Something went wrong</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '16px', maxWidth: '300px', margin: '0 auto 16px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button onClick={this.handleReset} className="btn-ghost" style={{ fontSize: '13px' }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
