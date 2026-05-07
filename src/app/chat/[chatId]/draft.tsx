import React from 'react';
type ListProps<T> = {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
};

function List<T>({ items, renderItem }: ListProps<T>) {
  return <div>{items.map((item) => renderItem(item))}</div>;
}

type User = {
  name: string;
  id: string;
};

export default function Draft({ users }: { users: User[] }) {
  return <List items={users} renderItem={(user) => <div>{`${user.id}-${user.name}`}</div>} />;
}

type State<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T[] }
  | { status: 'error'; error: string };
