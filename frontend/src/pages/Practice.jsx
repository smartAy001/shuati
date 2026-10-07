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
  const isPractice = session.session_type === 'practice'

  const setAnswer = (qid, val) => {
    setAnswers((a) => ({ ...a, [qid]: val }))
    clearTimeout(timers.current[qid])
    timers.current[qid] = setTimeout(() => {
      api.saveAnswer(sessionId, qid, val).catch(() => {})
    }, 400)
  }

  // 切题前立即保存当前题，保证练习模式断点续答不丢答案
  const flushCurrent = () => {
    const cur = questions[idx]
    clearTimeout(timers.current[cur.id])
    api.saveAnswer(sessionId, cur.id, answers[cur.id] || '').catch(() => {})
  }
  const goTo = (i) => {
    flushCurrent()
    setIdx(i)
  }

  const submit = async () => {
    const unanswered = questions.filter((qq) => !(answers[qq.id] || '').trim()).length
    if (!isPractice && unanswered > 0 && !window.confirm(`还有 ${unanswered} 题未作答，确定交卷？`)) return
    // 交卷前先保存所有已答题目，避免防抖尚未触发的答案丢失
    Object.values(timers.current).forEach(clearTimeout)
    timers.current = {}
    await Promise.all(
      questions.map((qq) => api.saveAnswer(sessionId, qq.id, answers[qq.id] || '').catch(() => {}))
    )
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
          {isPractice
            ? '练习模式 · 答一题即看解析，可随时结束'
            : session.has_answers
              ? '自带答案'
              : '交卷后 DeepSeek 生成解析'}
        </span>
      </div>

      <div className="flex gap-4 items-start">
        <div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="text-sm text-slate-500 mb-4">
            第 {idx + 1} / {questions.length} 题 · {TYPE_LABELS[q.type]} · {q.score} 分
          </div>
          <div className="text-lg whitespace-pre-wrap mb-6">{q.stem}</div>

          <AnswerInput q={q} value={answers[q.id] || ''} onChange={(v) => setAnswer(q.id, v)} />

          {isPractice && (answers[q.id] || '').trim() && (
            <PracticeFeedback q={q} userAnswer={answers[q.id] || ''} />
          )}

          <div className="flex justify-between mt-8">
            <button
              disabled={idx === 0}
              onClick={() => goTo(idx - 1)}
              className="border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              上一题
            </button>
            <button
              onClick={submit}
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700"
            >
              {isPractice ? '完成练习' : '交卷'}
            </button>
            <button
              disabled={idx === questions.length - 1}
              onClick={() => goTo(idx + 1)}
              className="border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-40"
            >
              下一题
            </button>
          </div>
        </div>

        <AnswerCard questions={questions} answers={answers} idx={idx} onJump={goTo} />
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

const JUDGE_TRUE = new Set(['对', '√', '正确', 'T', 't', '是'])
const JUDGE_FALSE = new Set(['错', '×', '错误', 'F', 'f', '否'])

function normalizeAnswer(ans) {
  if (!ans) return ''
  ans = String(ans).trim().replace(/[。.；;]+$/, '')
  if (!ans) return ''
  if (JUDGE_TRUE.has(ans)) return '对'
  if (JUDGE_FALSE.has(ans)) return '错'
  if (/^[A-Ha-h,，、\s]+$/.test(ans)) {
    const letters = ans.match(/[A-Ha-h]/g)
    if (letters) return letters.map((l) => l.toUpperCase()).sort().join('')
  }
  return ans
}

// 客观题即时判分；返回 null 表示无法判断（主观题 / 未作答）
function isObjectiveCorrect(q, userAnswer) {
  const ua = (userAnswer || '').trim()
  if (!ua) return null
  if (q.type === 'short') return null
  if (q.type === 'fill') {
    return ua === (q.answer || '').trim() || normalizeAnswer(ua) === normalizeAnswer(q.answer)
  }
  return normalizeAnswer(ua) === normalizeAnswer(q.answer)
}

function PracticeFeedback({ q, userAnswer }) {
  const correct = isObjectiveCorrect(q, userAnswer)
  const wrong = correct === false
  const right = correct === true
  return (
    <div
      className={`mt-6 rounded-lg border p-4 ${
        wrong ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'
      }`}
    >
      <div className={`text-sm font-medium mb-2 ${wrong ? 'text-red-600' : 'text-emerald-700'}`}>
        {wrong ? '回答错误 ✗' : right ? '回答正确 ✓' : '答案与解析'}
      </div>
      <div className="text-sm mb-1">
        <span className="text-slate-500">你的答案：</span>
        <b className={wrong ? 'text-red-600' : right ? 'text-emerald-700' : 'text-slate-700'}>
          {userAnswer}
        </b>
      </div>
      {q.answer ? (
        <div className="text-sm mb-1">
          <span className="text-slate-500">正确答案：</span>
          <b className={wrong ? 'text-red-700' : 'text-emerald-700'}>{q.answer}</b>
        </div>
      ) : (
        <div className="text-sm text-slate-400 mb-1">该题暂无参考答案</div>
      )}
      {q.explanation && (
        <div className="text-sm text-slate-600 whitespace-pre-wrap mt-2">{q.explanation}</div>
      )}
    </div>
  )
}
