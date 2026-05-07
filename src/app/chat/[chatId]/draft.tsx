import React, { useEffect, useMemo, useRef, useState } from 'react';

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

function useThrottle<T>(value: T, interval: number = 300) {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  const canUpdateImmediately = useRef(true);
  const valueRef = useRef<T>(value);
  useEffect(() => {
    const intervalId = setInterval(() => {
      setThrottledValue((current) => {
        if (Object.is(current, valueRef.current)) {
          return current;
        }
        return valueRef.current;
      });
      canUpdateImmediately.current = true;
    }, interval);
    return () => clearInterval(intervalId);
  }, [interval]);
  useEffect(() => {
    valueRef.current = value;
    if (canUpdateImmediately.current) {
      setThrottledValue(value);
      canUpdateImmediately.current = false;
    }
  }, [value]);
  return throttledValue;
}

function useDebounce<T>(value: T, delay: number = 300) {
  const [debouncedValue, setDebounceValue] = useState<T>(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebounceValue(value), delay);
    return () => {
      clearTimeout(timeoutId);
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
