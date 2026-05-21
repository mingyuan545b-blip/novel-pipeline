import { Component } from 'react';

const IGNORED_ERRORS = ['removeChild', 'insertBefore', 'not a child of this node'];

function isIgnoredError(error) {
    const msg = error?.message || String(error);
    return IGNORED_ERRORS.some(k => msg.includes(k));
}

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        if (isIgnoredError(error)) {
            return { hasError: false, error: null };
        }
        return { hasError: true, error: error.message || String(error) };
    }

    componentDidCatch(error, errorInfo) {
        if (isIgnoredError(error)) {
            return;
        }
        console.error('[ErrorBoundary]', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: 40,
                    textAlign: 'center',
                    color: '#ff0044',
                    background: '#0a0a0f',
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'sans-serif'
                }}>
                    <h1 style={{ fontSize: 24, marginBottom: 16 }}>页面出现错误</h1>
                    <p style={{ color: '#8888aa', marginBottom: 20, maxWidth: 600 }}>
                        {this.state.error}
                    </p>
                    <button
                        onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
                        style={{
                            padding: '10px 24px',
                            background: 'linear-gradient(135deg, #00f0ff, #ff00ff)',
                            border: 'none',
                            borderRadius: 8,
                            color: '#000',
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontSize: 14
                        }}
                    >
                        重新加载页面
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
