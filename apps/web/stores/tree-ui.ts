import { create } from 'zustand';

// Estado de tela da árvore: qual nó está selecionado e quais estão abertos.
interface TreeUiState {
  selectedId: string | null;
  expanded: Set<string>;
  select: (id: string) => void;
  toggle: (id: string) => void;
}

export const useTreeUi = create<TreeUiState>()((set) => ({
  selectedId: null,
  expanded: new Set(),
  select: (id) => set({ selectedId: id }),
  // Cria um Set novo em vez de mexer no atual: o Zustand detecta mudança por referência,
  // então `s.expanded.add(id)` não avisaria nenhum componente.
  toggle: (id) =>
    set((s) => {
      const expanded = new Set(s.expanded);
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      return { expanded };
    }),
}));
