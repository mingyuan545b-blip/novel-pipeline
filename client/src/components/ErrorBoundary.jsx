import { Component } from 'react';
import logger from '../shared/logger';
import styles from './ErrorBoundary.module.css';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        logger.error('ErrorBoundary', 'Uncaught error:', error.message, errorInfo?.componentStack);
    }

    render() {
        if (this.state.hasError) {
            const msg = this.state.error?.message || String(this.state.error);
            const isRenderError = msg.includes('Objects are not valid as a React child')
                || msg.includes('Cannot read properties')
                || msg.includes('is not defined');

            return (
                <div className={styles.errorContainer}>
                    <div className={styles.errorTitle}>⚠️ 渲染错误</div>
                    <div className={styles.errorMessage}>
                        {isRenderError ? '数据格式不匹配，可能是后端返回了对象而非字符串' : msg}
                    </div>
                    <details className={styles.errorDetails}>
                        <summary>详细信息</summary>
                        <pre>{this.state.errorInfo?.componentStack || msg}</pre>
                    </details>
                    <button
                        className={styles.retryButton}
                        onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                        aria-label="重试加载"
                    >
                        重试
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
