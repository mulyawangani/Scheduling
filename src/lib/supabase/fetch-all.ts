import type { PostgrestError } from '@supabase/supabase-js'

const PAGE_SIZE = 1000

/**
 * Supabase silently caps any single query at 1,000 rows — no error, the rest
 * just vanish. Anything that reads a whole table able to grow past that has to
 * page through it. The callback must include a deterministic .order() (e.g. by
 * id), otherwise pages can skip or repeat rows.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) return { data: rows, error }
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) break
  }
  return { data: rows, error: null }
}
