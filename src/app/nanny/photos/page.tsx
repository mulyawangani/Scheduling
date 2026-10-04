import { requireNanny } from '@/lib/auth/require-nanny'

export default async function NannyPhotosPage() {
  await requireNanny()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase">Classroom</p>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Photo Gallery</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload and share classroom moments with parents.</p>
      </div>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-16 flex flex-col items-center gap-3 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </div>
        <p className="font-semibold text-gray-700">Coming soon</p>
        <p className="text-sm text-gray-400 max-w-sm">
          Photo upload and gallery for classrooms will be available here once Supabase Storage is configured.
        </p>
      </div>
    </div>
  )
}
