import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { TYPE_LABELS } from '../utils'

export default function Result() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [s, setS] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getSession(sessionId)
      .then(setS)
      .catch((e) => setError(e.message))
  }, [sessionId])

  if (error) return <div className="text-red-500 py-20 text-center">{error}</div>
  if (!s) return <div className="text-slate-400 py-20 text-center">加载中…</div>

  const totalScore = s.questions.reduce((a, q) => a + (q.score || 0), 0)
  const got = s.total_score
  const accuracy = totalScore ? Math.round((got / totalScore) * 100) : 0
  const wrongCount = s.questions.length - s.correct_count

  const redoWrong = async () => {
    try {
      const s2 = await api.createSession(s.set_id, 'wrong')
      navigate(`/practice/${s2.id}`)
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-5 text-center">
        <div className="text-sm text-slate-500 mb-2">{s.title}</div>
        <div className="text-5xl font-bold text-indigo-600">{got}</div>
        <div className="text-sm text-slate-500 mt-1">总分 / {totalScore} 分</div>
        <div className="flex justify-center gap-8 mt-4 text-sm">
          <Stat label="正确" value={s.correct_count} color="text-emerald-600" />
          <Stat label="错误" value={wrongCount} color="text-red-500" />
          <Stat label="正确率" value={`${accuracy}%`} color="text-indigo-600" />
          <Stat label="总题数" value={s.questions.length} color="text-slate-700" />
        </div>
        <div className="flex justify-center gap-3 mt-6">
          {wrongCount > 0 && (
            <button
              onClick={redoWrong}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700"
            >
              错题重做
            </button>
          )}
          <Link
            to="/"
            className="border border-slate-300 px-5 py-2 rounded-lg hover:bg-slate-50"
          >
            返回首页
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {s.questions.map((q, i) => (
          <QuestionResult key={q.id} q={q} result={s.results[q.id] || {}} index={i} />
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function QuestionResult({ q, result, index }) {
  const correct = result.correct
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-slate-400 text-sm">第 {index + 1} 题</span>
        <span className="text-xs text-slate-500">{TYPE_LABELS[q.type]}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
            correct ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
          }`}
        >
          {correct ? '正确' : '错误'} · {result.score ?? 0} 分
        </span>
      </div>

      <div className="whitespace-pre-wrap mb-3">{q.stem}</div>

      {q.options?.length > 0 && (
        <div className="mb-3 space-y-1">
          {q.options.map((o) => {
            const isAns = (q.answer || '').includes(o.label)
            const isUser = (result.user_answer || '').includes(o.label)
            return (
              <div
                key={o.label}
                className={`text-sm px-2 py-1 rounded ${
                  isAns ? 'bg-emerald-50' : isUser && !correct ? 'bg-red-50' : ''
                }`}
              >
                <b className="mr-1">{o.label}.</b>
                {o.text}
                {isAns && <span className="text-emerald-600 ml-2 text-xs">✓ 正确答案</span>}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-slate-50 p-3">
          <div className="text-slate-500 text-xs mb-1">你的答案</div>
          <div className={correct ? '' : 'text-red-600'}>{result.user_answer || '（未作答）'}</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="text-slate-500 text-xs mb-1">参考答案</div>
          <div className="text-emerald-700">{q.answer || '—'}</div>
        </div>
      </div>

      {result.reason && (
        <div className="rounded-lg bg-amber-50 p-3 mt-3 text-sm">
          <div className="text-amber-600 text-xs mb-1">AI 评分理由</div>
          <div>{result.reason}</div>
        </div>
      )}

      {q.explanation && (
        <div className="rounded-lg border border-slate-200 p-3 mt-3 text-sm">
          <div className="text-slate-500 text-xs mb-1">解析</div>
          <div className="whitespace-pre-wrap">{q.explanation}</div>
        </div>
      )}
    </div>
  )
}
