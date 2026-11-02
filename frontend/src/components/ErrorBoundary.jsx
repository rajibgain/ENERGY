import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled SyncSpace UI Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f0f0e8',
          padding: '24px',
          fontFamily: "'DM Sans', -apple-system, sans-serif",
          color: '#1a2920'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #d2d6c9',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 8px 30px rgba(0,0,0,0.06)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '22px'
            }}>
              ⚠️
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 600, margin: '0 0 8px' }}>Something went wrong</h2>
            <p style={{ fontSize: '13px', color: '#566055', margin: '0 0 20px', lineHeight: 1.5 }}>
              SyncSpace encountered an unexpected interface error. You can reload the workspace or return to the sign-in screen.
            </p>
            {this.state.error?.message && (
              <pre style={{
                background: '#f9f9f6',
                border: '1px solid #e1e3d8',
                borderRadius: '6px',
                padding: '10px',
                fontSize: '11px',
                color: '#b54724',
                textAlign: 'left',
                overflowX: 'auto',
                marginBottom: '20px'
              }}>
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleReset}
              style={{
                width: '100%',
                background: '#19362a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 20px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload SyncSpace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
