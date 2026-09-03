import { useCallback, useEffect, useState } from 'react';

import { uiCopy, uiError } from '@/constants/ui';

import {
  createSavedSearch,
  deleteSavedSearch,
  getSavedSearch,
  listSavedSearches,
  toggleSavedSearchActive,
  updateSavedSearch,
} from '../services/saved-search.service';
import type { SavedSearch, SavedSearchWriteInput } from '../types/search.types';

function toErrorMessage(error: unknown): string {
  return uiError(error, uiCopy.genericError);
}

export function useSavedSearches() {
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const searches = await listSavedSearches();
      setItems(searches);
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const createSearch = useCallback(async (input: SavedSearchWriteInput) => {
    const result = await createSavedSearch(input);
    setItems((current) => [
      result.search,
      ...current.filter((item) => item.id !== result.search.id),
    ]);
    return result;
  }, []);

  const updateSearch = useCallback(async (id: string, input: SavedSearchWriteInput) => {
    const result = await updateSavedSearch(id, input);
    setItems((current) =>
      current.map((item) => (item.id === id ? result.search : item)),
    );
    return result;
  }, []);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, isActive } : item)),
    );

    try {
      const result = await toggleSavedSearchActive(id, isActive);
      setItems((current) =>
        current.map((item) => (item.id === id ? result.search : item)),
      );
      return result;
    } catch (caught) {
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, isActive: !isActive } : item,
        ),
      );
      throw caught;
    }
  }, []);

  const removeSearch = useCallback(async (id: string) => {
    let snapshot: SavedSearch[] = [];
    setItems((current) => {
      snapshot = current;
      return current.filter((item) => item.id !== id);
    });

    try {
      await deleteSavedSearch(id);
    } catch (caught) {
      setItems(snapshot);
      throw caught;
    }
  }, []);

  return {
    items,
    isLoading,
    error,
    refetch,
    createSearch,
    updateSearch,
    toggleActive,
    removeSearch,
  };
}

export function useSavedSearch(id: string | undefined) {
  const [search, setSearch] = useState<SavedSearch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setSearch(null);
      setError('Arama bulunamadı.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await getSavedSearch(id);
      setSearch(next);
    } catch (caught) {
      setSearch(null);
      setError(toErrorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    search,
    isLoading,
    error,
    refetch,
  };
}
