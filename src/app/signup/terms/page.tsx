'use client'

import { useState } from 'react'

const TERMS = [
  {
    title: 'School Fees & Payment Policy',
    subtitle: 'Terms of Condition 1 of 3',
    icon: '💳',
    content: [
      {
        heading: 'Registration Fee',
        text: 'The registration fee is non-refundable under any circumstances, including withdrawal before the program start date.',
      },
      {
        heading: 'Monthly School Fee Due Date',
        text: 'Monthly school fees are due on or before the 25th of each month for the following month\'s program.',
      },
      {
        heading: 'Late Payment Penalty',
        text: 'Late payments will incur a 10% penalty per month on the outstanding amount. Continued non-payment may result in the suspension of school services.',
      },
      {
        heading: 'Refund Policy',
        text: 'No refund will be issued unless written notice of withdrawal is received at least 2 (two) weeks prior to the withdrawal date. Refunds, if approved, will be processed within 14 working days.',
      },
    ],
  },
  {
    title: 'Photo & Video Consent',
    subtitle: 'Terms of Condition 2 of 3',
    icon: '📸',
    content: [
      {
        heading: 'Educational Documentation',
        text: 'I consent to Playtics photographing and/or video recording my child during school activities for educational documentation and portfolio purposes.',
      },
      {
        heading: 'Promotional Use',
        text: 'I consent to Playtics using photographs and video recordings of my child for promotional materials, including but not limited to social media, the school website, brochures, and presentations.',
      },
      {
        heading: 'Privacy Protection',
        text: 'Playtics will never publish images that could compromise the safety or privacy of your child. Full names will not be used in public-facing promotional materials without separate consent.',
      },
      {
        heading: 'Revocation',
        text: 'This consent may be revoked at any time by submitting a written request to the school administration. Previously published materials cannot be retroactively removed.',
      },
    ],
  },
  {
    title: 'Liability Waiver',
    subtitle: 'Terms of Condition 3 of 3',
    icon: '📋',
    content: [
      {
        heading: 'School Premises',
        text: 'PT Bermain Analitika Indonesia (Playtics) takes all reasonable precautions to maintain a safe environment. However, the school shall not be held liable for minor personal injuries that occur during normal school activities.',
      },
      {
        heading: 'Personal Belongings',
        text: 'Playtics is not responsible for the loss, theft, or damage of personal belongings brought to the school premises. Parents are advised not to send valuable items with their children.',
      },
      {
        heading: 'Medical Emergencies',
        text: 'In the event of a medical emergency, Playtics staff will take immediate appropriate action including contacting emergency services. The cost of emergency medical treatment is the responsibility of the parent/guardian.',
      },
      {
        heading: 'Acknowledgement',
        text: 'By agreeing, I acknowledge that I have read, understood, and agreed to all terms stated above. I confirm that all information I provide during registration is accurate and truthful.',
      },
    ],
  },
]

export default function TermsPage() {
  const [step, setStep] = useState(0)
  const term = TERMS[step]

  function handleAgree() {
    if (step < TERMS.length - 1) {
      setStep(s => s + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      window.location.href = '/signup/register'
    }
  }

  return (
    <div className="playtics-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div
          className="px-6 py-5"
          style={{ background: 'linear-gradient(135deg, #F59030 0%, #DC2870 100%)' }}
        >
          <div className="text-orange-100 text-xs font-medium mb-1">{term.subtitle}</div>
          <div className="text-white text-lg font-bold flex items-center gap-2">
            <span>{term.icon}</span>
            <span>{term.title}</span>
          </div>
          <div className="flex gap-2 mt-3">
            {TERMS.map((_, i) => (
              <div
                key={i}
                className="h-1.5 rounded-full transition-all"
                style={{
                  flex: i <= step ? 2 : 1,
                  background: i <= step ? 'white' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="p-6">
          <div className="flex flex-col gap-4 mb-6">
            {term.content.map((item, i) => (
              <div key={i}>
                <div className="text-sm font-semibold text-gray-700 mb-1">{item.heading}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{item.text}</div>
              </div>
            ))}
          </div>

          <button
            onClick={handleAgree}
            className="w-full text-white font-semibold py-3 rounded-full"
            style={{ background: 'linear-gradient(135deg, #F59030 0%, #dc6820 100%)' }}
          >
            {step < TERMS.length - 1 ? 'I Agree — Continue' : 'I Agree — Proceed to Registration'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-3">
            By proceeding, you agree to Playtics&apos; terms and conditions.
          </p>
        </div>
      </div>
    </div>
  )
}
