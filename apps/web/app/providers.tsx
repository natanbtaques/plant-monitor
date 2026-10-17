'use client';
//Armazenamento do React Query Client para cache de dados e gerenciamento de estado assíncrono.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // useState garante um único QueryClient por sessão do navegador: não é recriado a cada
  // render (perderia o cache) nem compartilhado entre usuários no servidor (singleton de módulo).
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
