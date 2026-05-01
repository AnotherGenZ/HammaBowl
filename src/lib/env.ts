export function env(name: string, fallback = '') {
  return process.env[name] ?? fallback
}

export function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function appBaseUrl() {
  return env('APP_BASE_URL', 'http://localhost:3000')
}

export function sessionPassword() {
  return env(
    'SESSION_PASSWORD',
    'dev-only-hammabowl-session-secret-change-me',
  )
}
