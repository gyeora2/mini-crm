import { useEffect, useState } from 'react'
import { deleteInquiry, isConfigured, listInquiries, saveInquiry, signIn, signOut } from './api.js'
import InquiryCard from './InquiryCard.jsx'

export const statuses = { received: '접수', inProgress: '처리 중', resolved: '완료' }
const blank = { customer: '', title: '', details: '', status: 'received' }

export default function App() {
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!session) return
    const timer = setTimeout(() => {
      setSession(null)
      setError('로그인 시간이 만료되었습니다. 다시 로그인해 주세요.')
    }, Math.max(0, session.expires_at * 1000 - Date.now()))
    return () => clearTimeout(timer)
  }, [session])

  async function handleLogin(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError('')
    try {
      const result = await signIn(form.get('email').trim(), form.get('password'))
      setSession({ ...result, expires_at: result.expires_at ?? Math.floor(Date.now() / 1000) + result.expires_in })
    } catch (failure) {
      setError(failure.status === 400 || failure.status === 401
        ? '이메일과 비밀번호를 확인해 주세요.'
        : '로그인 서버에 연결하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    setError('')
    try {
      await signOut(session.access_token)
    } catch {
      setError('이 화면에서 로그아웃했습니다. 서버 로그아웃 요청은 실패했습니다.')
    } finally {
      setSession(null)
      setBusy(false)
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell brand">
          <span>Mini CRM</span>
          {session && <button disabled={busy} onClick={handleLogout}>로그아웃</button>}
        </div>
      </header>
      {!isConfigured ? (
        <main className="shell auth">
          <h1>연결 설정 필요</h1>
          <p>Supabase 프로젝트 URL과 공개 키를 설정하면 로그인할 수 있습니다.</p>
        </main>
      ) : session ? (
        <Workspace token={session.access_token} />
      ) : (
        <main className="shell auth">
          <form className="panel form" onSubmit={handleLogin}>
            <h1>로그인</h1>
            <label>이메일<input name="email" type="email" autoComplete="username" required /></label>
            <label>비밀번호<input name="password" type="password" autoComplete="current-password" required /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
          </form>
        </main>
      )}
    </>
  )
}

function Workspace({ token }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [editor, setEditor] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    listInquiries(token, controller.signal)
      .then(setRecords)
      .catch(() => {
        if (!controller.signal.aborted) setError('문의 목록을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token, reload])

  function refresh() {
    setError('')
    setLoading(true)
    setReload((previous) => previous + 1)
  }

  async function mutate(action, success) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
    } catch (failure) {
      setError(failure instanceof TypeError ? '네트워크 연결을 확인해 주세요.' : failure.message)
    } finally {
      setBusy(false)
    }
  }

  function updateRecord(id, values) {
    return saveInquiry(token, id, values).then((saved) =>
      setRecords((current) => id ? current.map((item) => item.id === id ? saved : item) : [saved, ...current]),
    )
  }

  function submit(event) {
    event.preventDefault()
    const fields = {
      customer: editor.customer.trim(),
      title: editor.title.trim(),
      details: editor.details.trim(),
      status: editor.status,
    }
    if (!fields.customer || !fields.title) {
      setError('고객명과 제목을 입력해 주세요.')
      return
    }
    mutate(async () => {
      await updateRecord(editor.id, fields)
      setEditor(null)
    }, editor.id ? '문의를 수정했습니다.' : '문의를 등록했습니다.')
  }

  function remove(record) {
    if (!window.confirm('이 문의를 삭제할까요?')) return
    mutate(async () => {
      await deleteInquiry(token, record.id)
      setRecords((current) => current.filter((item) => item.id !== record.id))
      if (editor?.id === record.id) setEditor(null)
    }, '문의를 삭제했습니다.')
  }

  const search = query.trim().toLowerCase()
  const visible = records.filter((item) => (!filter || item.status === filter) &&
    (item.customer.toLowerCase().includes(search) || item.title.toLowerCase().includes(search)))

  return (
    <main className="shell">
      <div className="heading">
        <h1>고객 문의</h1>
        <button className="primary" disabled={busy || loading} onClick={() => setEditor({ ...blank })}>문의 등록</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="notice" role="status">{notice}</p>
      {editor && (
        <form className="panel form editor" onSubmit={submit}>
          <h2>{editor.id ? '문의 수정' : '새 문의'}</h2>
          <fieldset disabled={busy}>
            <label>고객명<input value={editor.customer} required maxLength={100}
              onChange={(event) => setEditor({ ...editor, customer: event.target.value })} /></label>
            <label>제목<input value={editor.title} required maxLength={160}
              onChange={(event) => setEditor({ ...editor, title: event.target.value })} /></label>
            <label>문의 내용<textarea value={editor.details} maxLength={3000} rows={4}
              onChange={(event) => setEditor({ ...editor, details: event.target.value })} /></label>
            <label>처리 상태<select value={editor.status}
              onChange={(event) => setEditor({ ...editor, status: event.target.value })}>
              {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></label>
            <div className="actions">
              <button className="primary" type="submit">{busy ? '저장 중…' : '저장'}</button>
              <button type="button" onClick={() => setEditor(null)}>취소</button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="toolbar">
        <label>검색<input type="search" placeholder="고객명 또는 제목" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>상태 필터<select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="">전체</option>
          {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <button onClick={refresh} disabled={loading || busy}>새로고침</button>
      </div>
      {loading ? <p role="status">문의를 불러오는 중…</p> : (
        <>
          <p className="customer">{visible.length}건 / 전체 {records.length}건</p>
          {visible.length === 0 && <p className="panel">표시할 문의가 없습니다.</p>}
          <ul className="inquiry-list">
            {visible.map((record) => (
              <li key={record.id}>
                <InquiryCard record={record} statuses={statuses} disabled={busy || Boolean(editor)}
                  onEdit={() => setEditor({ ...record })}
                  onDelete={() => remove(record)}
                  onStatus={(status) => mutate(() => updateRecord(record.id, { status }), '처리 상태를 변경했습니다.')} />
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
