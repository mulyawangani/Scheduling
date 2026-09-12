import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim()
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim()
const supabase = createClient(url, key)

const { data: student } = await supabase.from('students').select('id, name').eq('name', 'Kefas').single()
const { data: sessions } = await supabase
  .from('session_plans')
  .select('id, protocol_id, status, start_time, protocols(title), profiles!session_plans_teacher_id_fkey(name)')
  .eq('student_id', student.id)
  .in('status', ['pending', 'accepted', 'completed'])
console.log('Active sessions for Kefas:')
console.log(JSON.stringify(sessions, null, 2))

const { data: notes } = await supabase
  .from('therapy_notes')
  .select('id, session_plan_id, session_date, start_date, duration, objectives, observations, parent_instructions, status, created_at, updated_at, profiles!therapy_notes_teacher_id_fkey(name)')
  .in('session_plan_id', sessions.map((s) => s.id))
  .order('created_at', { ascending: true })
console.log('\nAll notes for Kefas right now:')
console.log(JSON.stringify(notes, null, 2))
