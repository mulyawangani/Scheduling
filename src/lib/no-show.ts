import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/**
 * True once the database knows the 'no_show' session status (supabase/add_no_show.sql has run). Until then the
 * No-show buttons stay hidden, so the app can be deployed before the SQL is run. Asking the database to filter on
 * the status is the check: a status the enum does not have makes the query fail.
 */
export async function isNoShowReady(supabase: SupabaseClient<Database>): Promise<boolean> {
  const { error } = await supabase.from('session_plans').select('id').eq('status', 'no_show').limit(1)
  return !error
}
