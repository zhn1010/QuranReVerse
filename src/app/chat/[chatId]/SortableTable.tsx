import { useMemo, useState } from 'react';

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
type SortKey = 'name' | 'email';
type SortDirection = 'asc' | 'desc';

type SortConfig = {
  key: SortKey;
  direction: SortDirection;
};

function SortIndicator({ direction }: { direction: SortDirection }) {
  return <span>{direction === 'asc' ? '↑' : '↓'}</span>;
}

export default function SortableUserTable() {
  const [sortState, setSortState] = useState<SortConfig>({ key: 'name', direction: 'asc' });
  const sortedUsers = useMemo(() => {
    return users.toSorted(
      (a, b) =>
        (sortState.direction === 'asc' ? 1 : -1) * a[sortState.key].localeCompare(b[sortState.key]),
    );
  }, [sortState]);

  function toggleDirection(prevDirection: SortDirection): SortDirection {
    return prevDirection === 'asc' ? 'desc' : 'asc';
  }

  function setProperDirection(prevState: SortConfig, key: SortKey) {
    return prevState.key !== key ? 'asc' : toggleDirection(prevState.direction);
  }

  function handleSortClick(key: SortKey) {
    setSortState((prevState) => ({
      key: key,
      direction: setProperDirection(prevState, key),
    }));
  }

  function getAriaSort(key: SortKey): 'none' | 'ascending' | 'descending' {
    if (sortState.key !== key) return 'none';
    return sortState.direction === 'asc' ? 'ascending' : 'descending';
  }

  return (
    <table>
      <thead>
        <tr>
          <th>id</th>
          <th aria-sort={getAriaSort('name')}>
            <button type="button" onClick={() => handleSortClick('name')}>
              Name {sortState.key === 'name' && <SortIndicator direction={sortState.direction} />}
            </button>
          </th>
          <th aria-sort={getAriaSort('email')}>
            <button type="button" onClick={() => handleSortClick('email')}>
              Email {sortState.key === 'email' && <SortIndicator direction={sortState.direction} />}
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        {sortedUsers.map((user) => (
          <tr key={user.id}>
            <td>{user.id}</td>
            <td>{user.name}</td>
            <td>{user.email}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
