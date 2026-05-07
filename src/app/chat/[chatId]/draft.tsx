import React, { useState } from 'react';

export default function SearchableUserList() {
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

  const [query, setQuery] = useState<string>('');

  return (
    <>
      <div>
        <label htmlFor="query">Search:</label>
        <input
          id="query"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div>
        {users.map((user) => (
          <p key={user.id}>
            `${user.name}\t${user.email}`
          </p>
        ))}
      </div>
    </>
  );
}
