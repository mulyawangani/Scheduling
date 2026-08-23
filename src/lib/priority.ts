/** Student priority labels — 1 is most urgent. Matches the option values on the Children page's Priority select. */
export const PRIORITY_LABEL: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }

export function priorityLabel(priority: number | null): string {
  if (priority === null) return 'No priority'
  return PRIORITY_LABEL[priority] ?? `Priority ${priority}`
}
