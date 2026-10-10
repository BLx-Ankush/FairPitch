import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'

/**
 * FairPitch k6 Load Test
 * 
 * Simulates real user behavior across the 5 most critical visitor journeys:
 * 1. Visitor landing on homepage ('/')
 * 2. Accessing auth workspace ('/auth')
 * 3. Checking session status ('/api/auth/session/status')
 * 4. Viewing public cryptographic verification portal ('/verify')
 * 5. Querying institutions directory ('/api/institutions')
 * 
 * Safety:
 * - Strictly targets local (http://localhost:3000) or staging environment.
 * - NEVER targets production.
 * - Third-party paid APIs (Razorpay, Resend email, Google Gemini AI) are bypassed.
 */

// Custom Metrics
const errorRate = new Rate('custom_error_rate')
const homePageDuration = new Trend('homepage_duration')
const authPageDuration = new Trend('auth_duration')
const verifyPageDuration = new Trend('verify_duration')
const sessionApiDuration = new Trend('session_api_duration')

export const options = {
  // Gradual user ramp-up to discover the application breaking point
  stages: [
    { duration: '15s', target: 20 },  // Ramp up to 20 users
    { duration: '30s', target: 20 },  // Hold at 20 users (Normal traffic)
    { duration: '15s', target: 50 },  // Ramp up to 50 users (Peak traffic)
    { duration: '30s', target: 50 },  // Hold at 50 users
    { duration: '15s', target: 100 }, // Ramp up to 100 users (Stress / Breaking point test)
    { duration: '30s', target: 100 }, // Hold at 100 users
    { duration: '15s', target: 0 },   // Ramp down to 0 users
  ],

  // Performance thresholds
  thresholds: {
    // 95% of all HTTP requests must complete within 500ms
    http_req_duration: ['p(95)<500'],
    // Overall request failure rate must be under 1%
    http_req_failed: ['rate<0.01'],
    // Custom error rate under 1%
    custom_error_rate: ['rate<0.01'],
  },
}

// Configurable target URL (defaults to localhost:3000)
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  // Common headers
  const params = {
    headers: {
      'User-Agent': 'k6-load-test-agent/1.0',
      'Accept': 'text/html,application/json',
    },
    timeout: '10s',
  }

  // --------------------------------------------------------------------------
  // Step 1: Visitor lands on the FairPitch Homepage ('/')
  // --------------------------------------------------------------------------
  group('1. Homepage Landing', function () {
    const res = http.get(`${BASE_URL}/`, params)
    homePageDuration.add(res.timings.duration)

    const isOk = check(res, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage contains FairPitch': (r) => r.body && r.body.includes('FairPitch'),
    })
    errorRate.add(!isOk)
  })

  // Realistic human pause before navigating
  sleep(Math.random() * 1.5 + 0.5)

  // --------------------------------------------------------------------------
  // Step 2: Visitor navigates to the Auth portal ('/auth')
  // --------------------------------------------------------------------------
  group('2. Auth Portal View', function () {
    const res = http.get(`${BASE_URL}/auth`, params)
    authPageDuration.add(res.timings.duration)

    const isOk = check(res, {
      'auth page status is 200': (r) => r.status === 200,
    })
    errorRate.add(!isOk)
  })

  sleep(Math.random() * 1.0 + 0.5)

  // --------------------------------------------------------------------------
  // Step 3: Client checks session status ('/api/auth/session/status')
  // --------------------------------------------------------------------------
  group('3. Auth Session Status Check', function () {
    const sessionParams = Object.assign({}, params, {
      responseCallback: http.expectedStatuses(200, 401),
    })
    const res = http.get(`${BASE_URL}/api/auth/session/status`, sessionParams)
    sessionApiDuration.add(res.timings.duration)

    // Unauthenticated visitors correctly receive 401 with { authenticated: false }
    const isOk = check(res, {
      'session check status is 200 or 401': (r) => r.status === 200 || r.status === 401,
      'session response has valid cache headers': (r) => {
        const cacheControl = r.headers['Cache-Control'] || r.headers['cache-control'] || ''
        return cacheControl.includes('no-store') || cacheControl.includes('private')
      },
    })
    errorRate.add(!isOk)
  })

  sleep(Math.random() * 1.5 + 0.5)

  // --------------------------------------------------------------------------
  // Step 4: Visitor views the Public Cryptographic Verifier ('/verify')
  // --------------------------------------------------------------------------
  group('4. Public Audit Verifier', function () {
    const res = http.get(`${BASE_URL}/verify`, params)
    verifyPageDuration.add(res.timings.duration)

    const isOk = check(res, {
      'verify page status is 200': (r) => r.status === 200,
    })
    errorRate.add(!isOk)
  })

  sleep(Math.random() * 2.0 + 1.0)
}
