import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { TYPE_LABELS } from '../utils'

export default function Practice() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const timers = useRef({})

  useEffect(() => {
    api
      .getSession(sessionId)
      .then((s) => {
        setSession(s)
        setAnswers(s.answers || {})
      })
      .catch((e) => setError(e.message))
  }, [sessionId])

  if (error) return <div className="text-red-500 py-20 text-center">{error}</div>
  if (!session) return <div className="text-slate-400 py-20 text-center">加载中…</div>

  const questions = session.questions
  const q = questions[idx]

  const setAnswer = (qid, val) => {
    setAnswers((a) => ({ ...a, [qid]: val }))
    clearTimeout(timers.current[qid])
    timers.current[qid] = setTimeout(() => {
      api.saveAnswer(sessionId, qid, val).catch(() => {})
    }, 400)
  }

  const submit = async () => {
    const unanswered = questions.filter((qq) => !(answers[qq.id] || '').trim()).length
    if (unanswered > 0 && !window.confirm(`还有 ${unanswered} 题未作答，确定交卷？`)) return
    // 交卷前先保存当前题，避免防抖尚未触发的答案丢失
    Object.values(timers.current).forEach(clearTimeout)
    timers.current = {}
    const cur = questions[idx]
    try {
      await api.saveAnswer(sessionId, cur.id, answers[cur.id] || '')
    } catch {
      /* 忽略保存失败 */
    }
    setSubmitting(true)
    setError('')
    try {
      const r = await api.submit(sessionId)
      navigate(`/result/${r.id}`)
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">{session.title}</h1>
        <span className="text-sm text-slate-500">
          {session.has_answers ? '自带答案' : '交卷后 DeepSeek 生成解析'}
        </span>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="text-sm text-slate-500 mb-4">
            第 {idx + 1} / {questions.length} 题 · {TYPE_LABELS[q.type]} · {q.score} 分
          </div>
          <div className="text-lg whitespace-pre-wrap mb-6">{q.stem}</div>

          <AnswerInput q={q} value={answers[q.id] || ''} onChange={(v) => setAnswer(q.id, v)} />

          <div className="flex justify-between mt-8">
            <button
              disabled={idx === 0}
              onClick={() => setIdx(idx - 1)}
              className="border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              上一题
            </button>
            <button
              onClick={submit}
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700"
            >
              交卷
            </button>
            <button
              disabled={idx === questions.length - 1}
              onClick={() => setIdx(idx + 1)}
              className="border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              下一题
            </button>
          </div>
        </div>

        <AnswerCard questions={questions} answers={answers} idx={idx} onJump={setIdx} />
      </div>

      {submitting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 text-center w-80">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
            <div className="font-medium">正在判分…</div>
            <div className="text-sm text-slate-500 mt-1">
              {session.has_answers ? '正在核对答案' : '正在通过 DeepSeek 生成答案解析（可能需几十秒）'}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AnswerInput({ q, value, onChange }) {
  if (q.type === 'single') {
    return (
      <div className="space-y-2">
        {q.options.map((o) => {
          const active = value === o.label
          return (
            <label
              key={o.label}
              className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer ${
                active ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                checked={active}
                onChange={() => onChange(o.label)}
                className="accent-indigo-600"
              />
              <span>
                <b className="mr-1">{o.label}.</b>
                {o.text}
              </span>
            </label>
          )
        })}
      </div>
    )
  }

  if (q.type === 'multiple') {
    const selected = (value || '').split('')
    return (
      <div className="space-y-2">
        {q.options.map((o) => {
          const active = selected.includes(o.label)
          return (
            <label
              key={o.label}
              className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 cursor-pointer ${
                active ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => {
                  const set = new Set(selected.filter(Boolean))
                  if (e.target.checked) set.add(o.label)
                  else set.delete(o.label)
                  onChange([...set].sort().join(''))
                }}
                className="accent-indigo-600"
              />
              <span>
                <b className="mr-1">{o.label}.</b>
                {o.text}
              </span>
            </label>
          )
        })}
      </div>
    )
  }

  if (q.type === 'judge') {
    return (
      <div className="flex gap-3">
        {[
          ['对', '对 √'],
          ['错', '错 ×'],
        ].map(([v, label]) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-6 py-2.5 rounded-lg border font-medium ${
              value === v
                ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    )
  }

  if (q.type === 'fill') {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="填写答案"
        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    )
  }

  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={6}
      placeholder="写下你的答案…"
      className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
    />
  )
}

function AnswerCard({ questions, answers, idx, onJump }) {
  const answeredCount = questions.filter((q) => (answers[q.id] || '').trim()).length
  return (
    <div className="w-44 shrink-0 bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
      <div className="text-sm font-medium mb-2">答题卡</div>
      <div className="grid grid-cols-5 gap-1.5">
        {questions.map((q, i) => {
          const answered = !!(answers[q.id] || '').trim()
          const current = i === idx
          return (
            <button
              key={q.id}
              onClick={() => onJump(i)}
              className={`h-8 rounded-md text-sm font-medium ${
                current
                  ? 'bg-indigo-600 text-white'
                  : answered
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <div className="text-xs text-slate-500 mt-3">
        已答 {answeredCount} / {questions.length}
      </div>
    </div>
  )
}
