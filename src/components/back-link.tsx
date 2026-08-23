import Link from 'next/link'

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-3 inline-block text-sm text-blue-600 hover:underline">
      ← {label}
    </Link>
  )
}
