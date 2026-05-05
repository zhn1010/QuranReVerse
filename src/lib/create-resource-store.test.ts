import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createResourceStore } from '@/lib/create-resource-store';

describe('createResourceStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates data and exposes loading state transitions', async () => {
    let resolveFetch!: (value: { count: number }) => void;
    const fetchResource = vi.fn(
      () =>
        new Promise<{ count: number }>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const store = createResourceStore({
      fetchResource,
      initialData: { count: 0 },
    });

    const states: number[] = [];
    const unsubscribe = store.subscribe(() => {
      states.push(store.getSnapshot().isLoading ? 1 : 0);
    });

    const request = store.prefetch();

    expect(store.getSnapshot()).toMatchObject({
      data: { count: 0 },
      hasFetched: false,
      isLoading: true,
    });

    resolveFetch({ count: 4 });
    await request;

    expect(store.getSnapshot()).toMatchObject({
      data: { count: 4 },
      error: null,
      hasFetched: true,
      isLoading: false,
    });
    expect(states).toEqual([1, 0]);

    unsubscribe();
  });

  it('dedupes in-flight requests and skips refetch after initial load', async () => {
    const fetchResource = vi.fn(async () => ({ items: [1, 2, 3] }));
    const store = createResourceStore({
      fetchResource,
      initialData: { items: [] as number[] },
    });

    await Promise.all([store.prefetch(), store.prefetch()]);
    await store.prefetch();

    expect(fetchResource).toHaveBeenCalledTimes(1);
  });

  it('forces revalidation and preserves existing data on failure', async () => {
    const fetchResource = vi
      .fn<() => Promise<{ name: string }>>()
      .mockResolvedValueOnce({ name: 'first' })
      .mockRejectedValueOnce(new Error('boom'));
    const store = createResourceStore({
      fetchResource,
      getErrorMessage: (error) => (error instanceof Error ? error.message : 'unknown'),
      initialData: { name: 'initial' },
    });

    await store.prefetch();
    await store.revalidate();

    expect(store.getSnapshot()).toMatchObject({
      data: { name: 'first' },
      error: 'boom',
      hasFetched: true,
      isLoading: false,
    });
  });

  it('resets to the initial snapshot', async () => {
    const store = createResourceStore({
      fetchResource: async () => ({ enabled: true }),
      initialData: { enabled: false },
    });

    await store.prefetch();
    store.reset();

    expect(store.getSnapshot()).toMatchObject({
      data: { enabled: false },
      error: null,
      hasFetched: false,
      isLoading: false,
    });
  });
});
