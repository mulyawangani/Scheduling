'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setBillingRate, deleteBillingRate } from './actions'

export interface RateRow {
  id: string
  studentId: string
  studentName: string
  teacherId: string | null
  teacherName: string | null
  billingRate: number
  commissionRate: number
}

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function RateManager({
  rates,
  students,
  teachers,
}: {
  rates: RateRow[]
  students: { id: string; name: string }[]
  teachers: { id: string; name: string }[]
}) {
  const [studentId, setStudentId] = useState('')
  const [teacherId, setTeacherId] = useState('')
  const [billingInput, setBillingInput] = useState('')
  const [commissionInput, setCommissionInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleAdd() {
    if (!studentId || billingInput.trim() === '' || commissionInput.trim() === '') return
    setError(null)
    startTransition(async () => {
      const result = await setBillingRate(studentId, teacherId || null, billingInput, commissionInput)
      if (result.error) {
        setError(result.error)
        return
      }
      setStudentId('')
      setTeacherId('')
      setBillingInput('')
      setCommissionInput('')
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    if (!confirm('Remove this rate? Any session it would have applied to falls back to the child\'s default rate, or shows as unrated if none exists.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteBillingRate(id)
      if (result.error) setError(result.error)
      router.refresh()
    })
  }

  const sorted = [...rates].sort(
    (a, b) => a.studentName.localeCompare(b.studentName) || (a.teacherName ?? '').localeCompare(b.teacherName ?? '')
  )

  return (
    <div className="flex flex-col gap-3">
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500">No rates set yet — add one below.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="p-2 font-medium text-gray-700">Child</th>
                <th className="p-2 font-medium text-gray-700">Teacher</th>
                <th className="p-2 font-medium text-gray-700">Billing/session</th>
                <th className="p-2 font-medium text-gray-700">Commission/session</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td className="p-2">{r.studentName}</td>
                  <td className="p-2">{r.teacherName ?? <span className="text-gray-400">Default (any teacher)</span>}</td>
                  <td className="p-2">{currencyFormatter.format(r.billingRate)}</td>
                  <td className="p-2">{currencyFormatter.format(r.commissionRate)}</td>
                  <td className="p-2">
                    <button
                      onClick={() => handleDelete(r.id)}
                      disabled={isPending}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-3">
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Child
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm">
            <option value="">Select a child</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Teacher
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1 text-sm">
            <option value="">Default (any teacher)</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Billing/session
          <input
            type="number"
            min="0"
            step="0.01"
            value={billingInput}
            onChange={(e) => setBillingInput(e.target.value)}
            className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-500">
          Commission/session
          <input
            type="number"
            min="0"
            step="0.01"
            value={commissionInput}
            onChange={(e) => setCommissionInput(e.target.value)}
            className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          onClick={handleAdd}
          disabled={isPending || !studentId || billingInput.trim() === '' || commissionInput.trim() === ''}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save rate'}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
