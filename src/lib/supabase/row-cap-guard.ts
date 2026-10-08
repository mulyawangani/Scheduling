// Supabase silently truncates any query to 1,000 rows (PostgREST max-rows) —
// no error, the remaining rows just vanish. That once hid the newest children
// from scheduling entirely. This wraps the client's fetch so a read that comes
// back at or near the cap WITHOUT being deliberately paged is logged loudly,
// instead of staying invisible until someone notices a child is missing.
const CAP = 1000
const WARN_AT = 800

export const rowCapGuardFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init)

  try {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))

    // A deliberate page (.range()/.limit()) legitimately returns up to 1,000
    // rows; only an unbounded read that hits the ceiling is the problem.
    const isPaged = url.searchParams.has('limit') || url.searchParams.has('offset') || headers.has('Range')
    if (method === 'GET' && url.pathname.startsWith('/rest/v1/') && !isPaged) {
      // PostgREST reports what it actually returned, e.g. "0-999/*" or "0-999/1157".
      const match = res.headers.get('content-range')?.match(/^(\d+)-(\d+)\//)
      const returned = match ? Number(match[2]) - Number(match[1]) + 1 : 0
      const table = url.pathname.split('/').pop()

      if (returned >= CAP) {
        console.error(
          `[row-cap] TRUNCATED: unpaginated read of "${table}" returned exactly ${returned} rows — anything beyond that was silently dropped. Page it with fetchAllRows (src/lib/supabase/fetch-all.ts).`
        )
      } else if (returned >= WARN_AT) {
        console.warn(
          `[row-cap] NEARING LIMIT: unpaginated read of "${table}" returned ${returned} of a ${CAP}-row cap. Page it with fetchAllRows before it starts dropping rows.`
        )
      }
    }
  } catch {
    // Logging must never be able to break a real query.
  }

  return res
}
