import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } }
    });
    return function Wrapper({ children }) {
        return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    };
}

export { createWrapper };
