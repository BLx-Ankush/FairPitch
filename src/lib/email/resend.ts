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

/**
 * Sends a welcome email upon successful account registration.
 */
export async function sendWelcomeEmail({
  to,
  fullName,
  role,
  workspaceUrl,
}: {
  to: string
  fullName: string
  role: string
  workspaceUrl?: string
}): Promise<EmailDispatchResult> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const targetUrl =
    workspaceUrl ||
    `${baseUrl}${
      role === 'organizer'
        ? '/org'
        : role === 'jury'
        ? '/jury'
        : role === 'institution_admin'
        ? '/admin'
        : '/team'
    }`

  const roleLabel =
    role === 'organizer'
      ? 'Competition Director (Organizer)'
      : role === 'jury'
      ? 'Vetted Jury Evaluator'
      : role === 'institution_admin'
      ? 'Institution Administrator'
      : 'Participant / Builder'

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #090d16; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="margin-bottom: 24px; display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 20px; font-weight: 800; background: linear-gradient(135deg, #818cf8, #c084fc); -webkit-background-clip: text; color: #818cf8;">FairPitch</span>
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 9999px; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); font-weight: 600;">Verifiable Infrastructure</span>
      </div>
      <h2 style="font-size: 22px; font-weight: 700; color: #f1f5f9; margin: 0 0 12px 0;">Welcome to FairPitch, ${fullName}!</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px 0;">
        Your account has been registered with role <strong>${roleLabel}</strong>. You now have access to auditable evaluations backed by cryptographic hash chains and statistical fairness telemetry.
      </p>
      <div style="margin: 28px 0;">
        <a href="${targetUrl}" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);">
          Launch Your Workspace &rarr;
        </a>
      </div>
      <div style="background: #0f172a; padding: 16px; border-radius: 10px; border: 1px solid #1e293b; font-size: 12px; color: #64748b; line-height: 1.5;">
        <strong>Zero-Black-Box Guarantee:</strong> Every score in FairPitch can be mathematically inspected, cryptographically audited, and verified independently.
      </div>
    </div>
  `

  return sendEmail({
    to,
    subject: `Welcome to FairPitch — Account Activated (${roleLabel})`,
    html,
  })
}

/**
 * Sends an email verification link and 6-digit confirmation code.
 */
export async function sendVerificationEmail({
  to,
  fullName,
  verifyUrl,
  otpCode,
}: {
  to: string
  fullName: string
  verifyUrl: string
  otpCode?: string
}): Promise<EmailDispatchResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #090d16; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 800; color: #818cf8;">FairPitch</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; color: #f1f5f9; margin: 0 0 12px 0;">Confirm Your Email Address</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px 0;">
        Hello ${fullName}, please confirm your email address to complete your registration on FairPitch.
      </p>
      ${
        otpCode
          ? `
        <div style="margin: 24px 0; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600; display: block; margin-bottom: 8px;">Your 6-Digit Verification Code</span>
          <div style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #38bdf8; background: #0f172a; padding: 14px 20px; border-radius: 12px; display: inline-block; border: 1px solid #1e293b;">
            ${otpCode}
          </div>
        </div>
      `
          : ''
      }
      <div style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Verify Email Address &rarr;
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
        If you did not register for FairPitch, you can safely ignore this email.
      </p>
    </div>
  `

  return sendEmail({
    to,
    subject: otpCode ? `FairPitch Verification Code: ${otpCode}` : 'Verify your FairPitch account',
    html,
  })
}

/**
 * Sends a passwordless Magic Link / OTP email.
 */
export async function sendMagicLinkEmail({
  to,
  magicLink,
  otpCode,
}: {
  to: string
  magicLink: string
  otpCode?: string
}): Promise<EmailDispatchResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #090d16; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 20px; font-weight: 800; color: #818cf8;">FairPitch</span>
      </div>
      <h2 style="font-size: 20px; font-weight: 700; color: #f1f5f9; margin: 0 0 12px 0;">Passwordless Sign-In</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px 0;">
        Click the link below or enter the 6-digit code to securely sign in to your FairPitch account.
      </p>
      ${
        otpCode
          ? `
        <div style="margin: 24px 0; text-align: center;">
          <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 600; display: block; margin-bottom: 8px;">Single-Use Login Code</span>
          <div style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #a855f7; background: #0f172a; padding: 14px 20px; border-radius: 12px; display: inline-block; border: 1px solid #1e293b;">
            ${otpCode}
          </div>
        </div>
      `
          : ''
      }
      <div style="margin: 24px 0;">
        <a href="${magicLink}" style="background: #9333ea; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Sign In Instantly &rarr;
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
        This login request expires in 15 minutes. If you did not request this link, no action is required.
      </p>
    </div>
  `

  return sendEmail({
    to,
    subject: otpCode ? `FairPitch Login Code: ${otpCode}` : 'Your FairPitch Magic Link',
    html,
  })
}

/**
 * Sends a password reset email.
 */
export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string
  resetUrl: string
}): Promise<EmailDispatchResult> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #090d16; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <h2 style="font-size: 20px; font-weight: 700; color: #f1f5f9; margin: 0 0 12px 0;">Reset Your Password</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 20px 0;">
        A password reset request was requested for your FairPitch account. Click below to establish a new password:
      </p>
      <div style="margin: 24px 0;">
        <a href="${resetUrl}" style="background: #e11d48; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">
          Reset Password &rarr;
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">
        If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
  `

  return sendEmail({
    to,
    subject: 'Reset your FairPitch password',
    html,
  })
}

