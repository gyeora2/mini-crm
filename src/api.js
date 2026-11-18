const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

export const isConfigured = /^https:\/\/[^/?#]+$/.test(url) && key.startsWith('sb_publishable_')

async function request(path, { token, method = 'GET', body, signal } = {}) {
  const response = await fetch(url + path, {
    method,
    signal,
    headers: {
      apikey: key,
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const error = new Error('요청에 실패했습니다. 잠시 뒤 다시 시도해 주세요.')
    error.status = response.status
    throw error
  }
  return response.json()
}

export function signIn(email, password) {
  return request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
}

const endpoint = '/rest/v1/inquiries'
const fields = 'id,customer,title,details,status,created_at'

export async function listInquiries(token, signal) {
  const records = []
  let cursor = ''
  while (true) {
    const query = new URLSearchParams({ select: fields, order: 'id.asc', limit: '100' })
    if (cursor) query.set('id', 'gt.' + cursor)
    const page = await request(endpoint + '?' + query, { token, signal })
    if (page.length === 0) return records.sort((a, b) => b.created_at.localeCompare(a.created_at))
    records.push(...page)
    cursor = page.at(-1).id
  }
}

export async function saveInquiry(token, id, fields) {
  const path = id ? endpoint + '?id=eq.' + encodeURIComponent(id) : endpoint
  const [record] = await request(path, { token, method: id ? 'PATCH' : 'POST', body: fields })
  if (!record) throw new Error('문의가 이미 삭제되었거나 접근할 수 없습니다.')
  return record
}

export async function deleteInquiry(token, id) {
  await request(endpoint + '?id=eq.' + encodeURIComponent(id), { token, method: 'DELETE' })
}

export async function signOut(token) {
  const response = await fetch(url + '/auth/v1/logout?scope=local', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + token },
  })
  if (!response.ok && response.status !== 401) throw new Error('로그아웃을 완료하지 못했습니다.')
}
