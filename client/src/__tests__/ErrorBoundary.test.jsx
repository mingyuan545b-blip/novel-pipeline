import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ErrorBoundary from '../components/ErrorBoundary';

function ThrowingChild({ error }) {
    throw error;
}

function SafeChild() {
    return <div data-testid="safe-child">Safe content</div>;
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should render children when no error', () => {
        render(
            <ErrorBoundary>
                <SafeChild />
            </ErrorBoundary>
        );
        expect(screen.getByTestId('safe-child')).toBeInTheDocument();
    });

    test('should render error UI when child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowingChild error={new Error('Test error message')} />
            </ErrorBoundary>
        );
        expect(screen.getByText(/渲染错误/)).toBeInTheDocument();
        expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    test('should render retry button on error', () => {
        render(
            <ErrorBoundary>
                <ThrowingChild error={new Error('Boom')} />
            </ErrorBoundary>
        );
        expect(screen.getByText('重试')).toBeInTheDocument();
    });

    test('should display error message in error UI', () => {
        render(
            <ErrorBoundary>
                <ThrowingChild error={new Error('Custom error details')} />
            </ErrorBoundary>
        );
        expect(screen.getByText('Custom error details')).toBeInTheDocument();
    });
});
