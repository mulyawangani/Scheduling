// Meta WhatsApp Cloud API (direct — no Twilio/BSP markup). Every send is a
// pre-approved Content Template, not freeform text: WhatsApp Business
// Platform only allows business-initiated messages (outside a customer's own
// 24h reply window, which is all this app ever sends) to use a template
// Meta has reviewed and approved. Template names below must be created in
// Meta Business Manager with these EXACT names before this will work — see
// createBookingConfirmationComponents/createOwnerReminderComponents for the
// exact body/button shape each one needs.
const GRAPH_API_VERSION = 'v21.0'
const LANGUAGE_CODE = 'en_US'

const BOOKING_CONFIRMATION_TEMPLATE = 'booking_confirmation'
const OWNER_SCHEDULING_REMINDER_TEMPLATE = 'weekly_scheduling_reminder'

interface TemplateComponent {
  type: 'body' | 'button'
  sub_type?: 'url'
  index?: string
  parameters: { type: 'text'; text: string }[]
}

/** Graph API wants digits only, no "+", no leading 0 — our stored phone numbers are E.164 ("+62..."). */
function normalizePhoneForMeta(phone: string): string {
  return phone.replace(/\D/g, '')
}

async function sendWhatsAppTemplate(toPhone: string, templateName: string, components: TemplateComponent[]) {
  const token = process.env.META_WHATSAPP_TOKEN
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    return { error: 'WhatsApp is not configured (missing Meta env vars).' }
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhoneForMeta(toPhone),
        type: 'template',
        template: {
          name: templateName,
          language: { code: LANGUAGE_CODE },
          components,
        },
      }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { error: data?.error?.message ?? `WhatsApp send failed (HTTP ${res.status}).` }
    }
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to send WhatsApp message.' }
  }
}

/**
 * A session proposal, sent to a parent — same message for both the
 * per-booking send (createSessionPlan) and the deferred bulk "WhatsApp push"
 * (schedules/actions.ts), since they're the same content either way.
 *
 * Template `booking_confirmation` (Utility category) must be created with:
 *   Body: "Hi {{1}}, a session for {{2}} ({{3}} with {{4}}) is proposed for {{5}}. Tap below to confirm."
 *   Button: Visit Website (dynamic URL) -> https://<your-domain>/offer/{{1}}
 * (the button's {{1}} is a separate variable namespace from the body's, per
 * WhatsApp's template component model — both are just "the first variable in
 * this component" to Meta, not a shared counter.)
 */
export async function sendBookingConfirmationWhatsApp(
  toPhone: string,
  params: { parentName: string; studentName: string; protocolName: string; teacherName: string; when: string; token: string }
) {
  return sendWhatsAppTemplate(toPhone, BOOKING_CONFIRMATION_TEMPLATE, [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: params.parentName },
        { type: 'text', text: params.studentName },
        { type: 'text', text: params.protocolName },
        { type: 'text', text: params.teacherName },
        { type: 'text', text: params.when },
      ],
    },
    {
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: params.token }],
    },
  ])
}

/**
 * The Friday internal nudge to the owner about next week's unmet needs (see
 * api/cron/weekly-suggestions) — no button, since the review link's own URL
 * never changes and can sit as static text in the template body.
 *
 * Template `weekly_scheduling_reminder` (Utility category) must be created with:
 *   Body: "{{1}} session(s) need scheduling for next week. Review at https://<your-domain>/admin/suggestions"
 */
export async function sendOwnerSchedulingReminderWhatsApp(toPhone: string, unmetNeedsCount: number) {
  return sendWhatsAppTemplate(toPhone, OWNER_SCHEDULING_REMINDER_TEMPLATE, [
    { type: 'body', parameters: [{ type: 'text', text: String(unmetNeedsCount) }] },
  ])
}
