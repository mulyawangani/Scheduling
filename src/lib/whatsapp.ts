import twilio from 'twilio'

function normalizeWhatsAppNumber(phone: string) {
  const trimmed = phone.trim()
  return trimmed.startsWith('whatsapp:') ? trimmed : `whatsapp:${trimmed}`
}

export async function sendWhatsAppMessage(toPhone: string, message: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WHATSAPP_FROM

  if (!accountSid || !authToken || !from) {
    return { error: 'WhatsApp is not configured (missing Twilio env vars).' }
  }

  const client = twilio(accountSid, authToken)

  try {
    await client.messages.create({
      from,
      to: normalizeWhatsAppNumber(toPhone),
      body: message,
    })
    return { error: null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Failed to send WhatsApp message.' }
  }
}
