/**
 * FairPitch Dynamic UPI QR Allocation & Verification Module
 * Enables 100% direct-to-organizer transfers with 0% platform transaction fees.
 * Encodes standard UPI Intent URIs and renders scannable QR codes for all UPI apps.
 */

import QRCode from 'qrcode'

export interface UpiUriInput {
  vpa: string // Payee UPI VPA (e.g., organizer@okhdfcbank)
  payeeName: string // Display name of organizer or event
  amount: number // Amount in Indian Rupees
  transactionRef: string // Unique reference string for reconciliation
  transactionNote?: string // Purpose note displayed in the UPI app
}

export interface UpiQrOutput {
  upiUri: string
  qrCodeDataUrl: string
  vpa: string
  payeeName: string
  amount: number
  transactionRef: string
}

/**
 * Builds standard UPI Intent URI according to NPCI specifications:
 * upi://pay?pa={vpa}&pn={payeeName}&am={amount}&cu=INR&tn={note}&tr={ref}
 */
export function generateUpiUri(input: UpiUriInput): string {
  const { vpa, payeeName, amount, transactionRef, transactionNote } = input

  const cleanVpa = vpa.trim()
  const cleanName = encodeURIComponent(payeeName.trim())
  const cleanAmount = Number(amount).toFixed(2)
  const cleanRef = transactionRef.trim()
  const note = encodeURIComponent(transactionNote?.trim() || `Reg Fee: ${cleanRef}`)

  return `upi://pay?pa=${cleanVpa}&pn=${cleanName}&am=${cleanAmount}&cu=INR&tn=${note}&tr=${cleanRef}`
}

/**
 * Renders high-resolution QR code data URL (image/png) from a UPI Intent URI.
 */
export async function generateUpiQrCodeDataUrl(upiUri: string): Promise<string> {
  return QRCode.toDataURL(upiUri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 320,
    color: {
      dark: '#0f172a', // Deep slate for high-contrast scanning
      light: '#ffffff',
    },
  })
}

/**
 * Generates both the UPI URI and the scannable QR code data URL in one step.
 */
export async function generateDynamicUpiQr(input: UpiUriInput): Promise<UpiQrOutput> {
  const upiUri = generateUpiUri(input)
  const qrCodeDataUrl = await generateUpiQrCodeDataUrl(upiUri)

  return {
    upiUri,
    qrCodeDataUrl,
    vpa: input.vpa,
    payeeName: input.payeeName,
    amount: input.amount,
    transactionRef: input.transactionRef,
  }
}

/**
 * Validates UPI Transaction Reference / UTR Number.
 * Indian banking UPI UTRs are typically 12-digit numbers (or alphanumeric 12-16 characters).
 */
export function validateUtrNumber(utr: string): { isValid: boolean; error?: string } {
  if (!utr || typeof utr !== 'string') {
    return { isValid: false, error: 'UTR number is required.' }
  }

  const cleanUtr = utr.trim()

  if (cleanUtr.length < 8 || cleanUtr.length > 20) {
    return {
      isValid: false,
      error: 'UTR number must be between 8 and 20 characters (typically 12 digits).',
    }
  }

  // Regex allows 12-digit numeric or alphanumeric bank reference IDs
  const utrPattern = /^[A-Za-z0-9]{8,20}$/
  if (!utrPattern.test(cleanUtr)) {
    return {
      isValid: false,
      error: 'UTR number must contain only letters and numbers without spaces.',
    }
  }

  return { isValid: true }
}

/**
 * Generates a human-friendly unique reconciliation transaction reference.
 */
export function generateTransactionRef(eventId: string, teamIdentifier: string): string {
  const eventPart = eventId.replace(/-/g, '').slice(0, 4).toUpperCase()
  const teamPart = teamIdentifier.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
  const randomPart = Math.floor(1000 + Math.random() * 9000)
  return `FP-${eventPart}-${teamPart}-${randomPart}`
}
