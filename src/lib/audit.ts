import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

/** Fire-and-forget: a logging failure should never block the action it's recording. */
export function logAudit(
  supabase: SupabaseClient<Database>,
  actorId: string,
  action: string,
  targetType?: string,
  targetId?: string,
  metadata?: Record<string, unknown>
) {
  supabase
    .from('audit_log')
    .insert({ actor_id: actorId, action, target_type: targetType ?? null, target_id: targetId ?? null, metadata: metadata ?? null })
    .then(({ error }) => {
      if (error) console.error('audit log failed:', action, error.message)
    })
}
