import { useCallback, useEffect, useRef, useState } from 'react';

type User = {
  id: number;
  name: string;
  email: string;
};

const mockUsers: User[] = [
  { id: 1, name: 'Saeed Ahmadi', email: 'saeed@example.com' },
  { id: 2, name: 'Anna Müller', email: 'anna@scalable.capital' },
  { id: 3, name: 'Max Schneider', email: 'max@example.com' },
];

function fetchUsers(): Promise<User[]> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.5) reject(new Error('Failed to fetch users'));
      else resolve(mockUsers);
    }, 1000);
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Unknown Error';
}

type FetchStatus =
  | { status: 'error'; error: string }
  | { status: 'success'; users: User[] }
  | { status: 'loading' };

function useFetchUsers() {
  const [fetchState, setFetchState] = useState<FetchStatus>({ status: 'loading' });
  const doFetch = useCallback(async (isActive: boolean = true) => {
    setFetchState({ status: 'loading' });
    try {
      const users = await fetchUsers();
      if (isActive) setFetchState({ status: 'success', users });
    } catch (error: unknown) {
      if (isActive) setFetchState({ status: 'error', error: getErrorMessage(error) });
    }
  }, []);
  useEffect(() => {
    let isActive = true;
    doFetch(isActive);
    return () => {
      isActive = false;
    };
  }, [doFetch]);

  return { fetchState, doFetch };
}

export default function UserDashboard() {
  const { fetchState, doFetch } = useFetchUsers();

  if (fetchState.status === 'loading') return <p>Loading users...</p>;
  if (fetchState.status === 'error')
    return (
      <>
        <p>Failed to load users.</p>
        <p>{fetchState.error}</p>
        <button onClick={async () => doFetch()} type="button">
          Retry
        </button>
      </>
    );
  if (fetchState.status === 'success') {
    return (
      <ul>
        {fetchState.users.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email})
          </li>
        ))}
      </ul>
    );
  }
  return null;
}
