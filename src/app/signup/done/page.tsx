export default function DonePage() {
  return (
    <div className="playtics-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div
          className="px-6 py-8 text-center"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
        >
          <div className="text-white text-5xl mb-3">🎉</div>
          <div className="text-white text-2xl font-bold tracking-widest">PLAYTICS</div>
        </div>

        <div className="p-6 text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Registration Submitted!</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            Thank you for registering with Playtics. Your application is now pending review.
            Our team will contact you shortly to confirm your child&apos;s enrollment.
          </p>

          <div
            className="rounded-2xl p-4 mb-6 text-left"
            style={{ background: 'rgba(245,144,48,0.08)' }}
          >
            <div className="text-xs font-semibold mb-2" style={{ color: '#F59030' }}>WHAT HAPPENS NEXT</div>
            <div className="flex flex-col gap-2">
              {[
                'Our admin team reviews your registration',
                'You will receive a WhatsApp confirmation',
                'Schedule an orientation visit',
                'Complete enrollment and begin classes',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span
                    className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-bold"
                    style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
                  >
                    {i + 1}
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <a
            href="/login"
            className="block w-full text-center text-white font-semibold py-3 rounded-full"
            style={{ background: 'linear-gradient(135deg, #F59030 0%, #dc6820 100%)' }}
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  )
}
