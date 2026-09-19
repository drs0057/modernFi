import { ReactNode } from 'react';

export default function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 pb-3 text-sm font-medium ${
        active
          ? 'border-electric text-electric'
          : 'border-transparent text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}
