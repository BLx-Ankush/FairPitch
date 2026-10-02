/**
 * FairPitch Thin Email Service Module (Resend)
 * All secrets remain strictly on the server; never exposed to client bundles.
 */

export interface EmailDispatchResult {
  success: boolean
  id?: string
  mock: boolean
  error?: string
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}): Promise<EmailDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.EMAIL_FROM || 'FairPitch <audits@fairpitch.io>'

  const recipients = Array.isArray(to) ? to : [to]

  if (!apiKey || apiKey.startsWith('dummy') || apiKey.trim() === '') {
    // Development / offline logging mode
    console.log(`[Resend Mock Dispatch] To: ${recipients.join(', ')} | Subject: "${subject}"`)
    return {
      success: true,
      id: `mock_email_${Date.now()}`,
      mock: true,
    }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject,
        html,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return {
        success: false,
        mock: false,
        error: err.message || res.statusText,
      }
    }

    const data = await res.json()
    return {
      success: true,
      id: data.id,
      mock: false,
    }
  } catch (error: any) {
    return {
      success: false,
      mock: false,
      error: error.message || 'Email dispatch failed',
    }
  }
}

/**
 * Sends an invitation email with single-use token link.
 */
export async function sendInviteEmail(
  to: string,
  inviteToken: string,
  role: string,
  eventName: string,
  inviterName: string
): Promise<EmailDispatchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
      <h2 style="color: #6366f1; margin-top: 0;">FairPitch Invitation</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
        <strong>${inviterName}</strong> has invited you to join <strong>${eventName}</strong> as a <strong>${role.toUpperCase()}</strong>.
      </p>
      <p style="font-size: 13px; color: #94a3b8;">
        FairPitch is an auditable hackathon judging system backed by cryptographic hash chains and statistical fairness telemetry.
      </p>
      <div style="margin: 28px 0;">
        <a href="${inviteUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
          Accept Invitation & Join
        </a>
      </div>
      <p style="font-size: 11px; color: #64748b; margin-bottom: 0;">
        This is a single-use token. If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>
  `

  return sendEmail({
    to,
    subject: `You've been invited as ${role} to ${eventName} on FairPitch`,
    html,
  })
}

/**
 * Sends notification when event results and Merkle root are officially published.
 */
export async function sendResultsPublishedEmail(
  to: string,
  eventName: string,
  eventId: string,
  merkleRoot: string
): Promise<EmailDispatchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const resultsUrl = `${baseUrl}/events/${eventId}/results`
  const verifyUrl = `${baseUrl}/verify/${eventId}`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px;">
      <h2 style="color: #10b981; margin-top: 0;">Judging Concluded & Verified</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
        Official results for <strong>${eventName}</strong> have been published and cryptographically anchored.
      </p>
      <div style="background: #1e293b; padding: 12px; border-radius: 8px; margin: 16px 0; font-family: monospace; font-size: 11px; color: #818cf8; word-break: break-all;">
        Anchored Merkle Root: ${merkleRoot}
      </div>
      <div style="margin: 24px 0; display: flex; gap: 12px;">
        <a href="${resultsUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
          View Public Leaderboard
        </a>
        &nbsp;&nbsp;
        <a href="${verifyUrl}" style="background: #334155; color: #e2e8f0; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
          Verify Cryptographic Proof
        </a>
      </div>
    </div>
  `

  return sendEmail({
    to,
    subject: `Official Results Published: ${eventName}`,
    html,
  })
}
