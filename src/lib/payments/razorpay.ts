/**
 * FairPitch Thin Payment Gateway Module (Razorpay)
 * All secrets remain strictly on the server; never exposed to client bundles.
 */

import { createHmac, randomBytes } from 'crypto'

export interface RazorpayOrderInput {
  amountInRupees: number
  receipt: string
  notes?: Record<string, string>
}

export interface RazorpayOrderOutput {
  id: string
  amount: number // in paise
  currency: string
  receipt: string
  status: string
  keyId: string
  isMock: boolean
}

export interface VerifyPaymentInput {
  razorpayOrderId: string
  razorpayPaymentId: string
  razorpaySignature: string
}

/**
 * Creates an order with Razorpay or mock test runner.
 */
export async function createRazorpayOrder(
  input: RazorpayOrderInput
): Promise<RazorpayOrderOutput> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET
  const amountInPaise = Math.round(input.amountInRupees * 100)

  if (!keyId || !keySecret || keyId.startsWith('dummy')) {
    // Deterministic mock order for offline testing & demo modes
    const mockOrderId = `order_mock_${randomBytes(8).toString('hex')}`
    return {
      id: mockOrderId,
      amount: amountInPaise,
      currency: 'INR',
      receipt: input.receipt,
      status: 'created',
      keyId: keyId || 'rzp_test_mock',
      isMock: true,
    }
  }

  // Official Razorpay API call via HTTP
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: 'INR',
      receipt: input.receipt,
      notes: input.notes || {},
    }),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}))
    throw new Error(
      errorBody.error?.description || `Razorpay order creation failed: ${response.statusText}`
    )
  }

  const orderData = await response.json()
  return {
    id: orderData.id,
    amount: orderData.amount,
    currency: orderData.currency,
    receipt: orderData.receipt,
    status: orderData.status,
    keyId,
    isMock: false,
  }
}

/**
 * Verifies Razorpay payment signature using HMAC SHA-256.
 * Formula: HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
 */
export function verifyRazorpaySignature(input: VerifyPaymentInput): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keySecret || keySecret.startsWith('dummy')) {
    // In mock mode, allow mock payments
    return (
      Boolean(input.razorpayOrderId) &&
      Boolean(input.razorpayPaymentId) &&
      Boolean(input.razorpaySignature)
    )
  }

  const payload = `${input.razorpayOrderId}|${input.razorpayPaymentId}`
  const expectedSignature = createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex')

  return expectedSignature === input.razorpaySignature
}
