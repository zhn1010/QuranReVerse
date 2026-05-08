import { useEffect, useMemo, useState } from 'react';

type User = {
  id: number;
  name: string;
  email: string;
};

const users: User[] = [
  { id: 1, name: 'Saeed Ahmadi', email: 'saeed@example.com' },
  { id: 2, name: 'Anna Müller', email: 'anna@scalable.capital' },
  { id: 3, name: 'Max Schneider', email: 'max@example.com' },
  { id: 4, name: 'Laura Becker', email: 'laura@test.com' },
];

function useDebounce<T>(value: T, delay: number = 300) {
  const [debouncedValue, setDebounceValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounceValue(value), delay);
    return () => {
      clearInterval(timeoutId);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function SearchableUserList() {
  const [query, setQuery] = useState<string>('');
  const debouncedQuery = useDebounce(query, 300);
  const filteredUsers = useMemo(() => {
    const normalizedQuery = debouncedQuery.toLowerCase().trim();
    if (!normalizedQuery) {
      return users;
    }
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.name.toLowerCase().includes(normalizedQuery),
    );
  }, [debouncedQuery]);

  return (
    <>
      <div>
        <label htmlFor="query">Search:</label>
        <input
          id="query"
          aria-label="Search users"
          type="text"
          placeholder="Search by name or email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <ul>
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <li key={user.id}>
              {user.name} ({user.email})
            </li>
          ))
        ) : (
          <li>No users found.</li>
        )}
      </ul>
    </>
  );
}
