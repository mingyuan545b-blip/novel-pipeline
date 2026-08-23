import { useState, useEffect, useRef, useCallback } from 'react';

export function useFetchData(fetchFn, options = {}) {
    const {
        autoFetch = true,
        onSuccess,
        onError,
        deps = []
    } = options;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(autoFetch);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);

    const fetch = useCallback(async (params) => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        setError(null);

        try {
            const res = params ? await fetchFn(params) : await fetchFn();
            if (abortRef.current.signal.aborted) return;
            setData(res.data || null);
            onSuccess?.(res.data);
        } catch (err) {
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') return;
            setError(err);
            onError?.(err);
        } finally {
            setLoading(false);
        }
    }, [fetchFn, onSuccess, onError]);

    useEffect(() => {
        if (autoFetch) {
            fetch();
        }
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, [autoFetch, fetch, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

    return { data, loading, error, refetch: fetch };
}

export function useMutateData(mutationFn, options = {}) {
    const { onSuccess, onError } = options;

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const mutate = async (params) => {
        setLoading(true);
        setError(null);

        try {
            const res = params !== undefined ? await mutationFn(params) : await mutationFn();
            setData(res.data || null);
            onSuccess?.(res.data);
            return res.data;
        } catch (err) {
            setError(err);
            onError?.(err);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { mutate, loading, error, data };
}
