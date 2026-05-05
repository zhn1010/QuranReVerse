export type ResourceSnapshot<TData> = {
  data: TData;
  error: string | null;
  hasFetched: boolean;
  isLoading: boolean;
};

export function createResourceStore<TData>({
  fetchResource,
  getErrorMessage = defaultErrorMessage,
  initialData,
}: {
  fetchResource: () => Promise<TData>;
  getErrorMessage?: (error: unknown) => string;
  initialData: TData;
}) {
  const initialSnapshot: ResourceSnapshot<TData> = {
    data: initialData,
    error: null,
    hasFetched: false,
    isLoading: false,
  };

  let snapshot = initialSnapshot;
  let inFlightRequest: Promise<void> | null = null;
  const listeners = new Set<() => void>();

  function emitChange() {
    for (const listener of listeners) {
      listener();
    }
  }

  function setSnapshot(nextSnapshot: ResourceSnapshot<TData>) {
    snapshot = nextSnapshot;
    emitChange();
  }

  async function request(force: boolean) {
    if (inFlightRequest) {
      return inFlightRequest;
    }

    if (!force && snapshot.hasFetched) {
      return Promise.resolve();
    }

    setSnapshot({
      ...snapshot,
      error: null,
      isLoading: true,
    });

    inFlightRequest = (async () => {
      try {
        const data = await fetchResource();

        setSnapshot({
          data,
          error: null,
          hasFetched: true,
          isLoading: false,
        });
      } catch (error) {
        setSnapshot({
          ...snapshot,
          error: getErrorMessage(error),
          hasFetched: true,
          isLoading: false,
        });
      } finally {
        inFlightRequest = null;
      }
    })();

    return inFlightRequest;
  }

  return {
    getServerSnapshot: () => initialSnapshot,
    getSnapshot: () => snapshot,
    prefetch: () => request(false),
    reset: () => {
      if (snapshot === initialSnapshot) {
        return;
      }

      inFlightRequest = null;
      setSnapshot(initialSnapshot);
    },
    revalidate: () => request(true),
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function defaultErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Request failed.';
}
