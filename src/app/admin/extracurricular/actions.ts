/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdminOrOwner } from '@/lib/auth/require-admin-or-owner'
import { revalidatePath } from 'next/cache'

type Result = { error?: string }

function priceError(price: number | null | undefined): string | null {
  if (price === null || price === undefined) return null
  if (!Number.isFinite(price) || price < 0) return 'Price must be zero or more.'
  if (price > 9_999_999_999) return 'Price is too large.'
  return null
}

export async function createActivity(name: string, monthlyPrice: number | null): Promise<Result> {
  await requireAdminOrOwner()

  const trimmed = name.trim()
  if (!trimmed) return { error: 'Enter an activity name.' }
  const invalid = priceError(monthlyPrice)
  if (invalid) return { error: invalid }

  const db = (await createClient()) as any

  const { data: existing, error: lookupError } = await db
    .from('extracurricular_activities')
    .select('id')
    .ilike('name', trimmed.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
  if (lookupError) return { error: lookupError.message }
  if (existing?.length) return { error: `"${trimmed}" is already on the list.` }

  const { error } = await db.from('extracurricular_activities').insert({
    name: trimmed,
    monthly_price: monthlyPrice,
    is_active: true,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/extracurricular')
  return {}
}

export async function updateActivity(
  id: string,
  changes: { monthlyPrice?: number | null; isActive?: boolean },
): Promise<Result> {
  await requireAdminOrOwner()

  const patch: { monthly_price?: number | null; is_active?: boolean } = {}
  if (changes.monthlyPrice !== undefined) {
    const invalid = priceError(changes.monthlyPrice)
    if (invalid) return { error: invalid }
    patch.monthly_price = changes.monthlyPrice
  }
  if (changes.isActive !== undefined) patch.is_active = changes.isActive
  if (Object.keys(patch).length === 0) return {}

  const db = (await createClient()) as any
  const { data, error } = await db
    .from('extracurricular_activities')
    .update(patch)
    .eq('id', id)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Not saved: this activity could not be changed.' }

  revalidatePath('/admin/extracurricular')
  return {}
}
