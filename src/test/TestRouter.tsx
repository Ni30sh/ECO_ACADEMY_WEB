import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import type { ReactNode } from 'react';

export function TestRouter({ children, ...props }: MemoryRouterProps & { children: ReactNode }) {
  return (
    <MemoryRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
      {...props}
    >
      {children}
    </MemoryRouter>
  );
}
