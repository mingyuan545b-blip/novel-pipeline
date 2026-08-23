import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../../components/ErrorBoundary';

function ThrowingChild() {
    throw new Error('Test crash');
}

function SafeChild() {
    return <div data-testid="safe">All good</div>;
}

describe('ErrorBoundary - extended', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('catches render error and shows retry button', () => {
        render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(screen.getByText('重试')).toBeInTheDocument();
    });

    test('retry button resets error state', () => {
        let shouldThrow = true;
        function ConditionalChild() {
            if (shouldThrow) throw new Error('Boom');
            return <div data-testid="recovered">Recovered</div>;
        }

        render(
            <ErrorBoundary>
                <ConditionalChild />
            </ErrorBoundary>
        );
        expect(screen.getByText('重试')).toBeInTheDocument();

        shouldThrow = false;
        fireEvent.click(screen.getByText('重试'));
    });

    test('detects render error patterns', () => {
        function ObjectChild() {
            throw new Error('Objects are not valid as a React child');
        }

        render(
            <ErrorBoundary>
                <ObjectChild />
            </ErrorBoundary>
        );
        expect(screen.getByText(/数据格式不匹配/)).toBeInTheDocument();
    });

    test('shows details section', () => {
        render(
            <ErrorBoundary>
                <ThrowingChild />
            </ErrorBoundary>
        );
        expect(screen.getByText('详细信息')).toBeInTheDocument();
    });
});
