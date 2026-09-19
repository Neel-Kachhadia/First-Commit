import { useState, useEffect } from "react";
import { apiClient, type Category } from "@/lib/api-client";

export interface UseCategoriesReturn {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the user's available mandate categories from the backend (DynamoDB).
 * System categories are seeded automatically on the first call.
 */
export function useCategories(): UseCategoriesReturn {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await apiClient.getCategories();
        if (!cancelled) setCategories(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load categories");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { categories, loading, error };
}
