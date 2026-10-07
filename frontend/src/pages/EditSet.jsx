import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { TYPE_LABELS, optionsToText, textToOptions } from '../utils'

const TYPE_KEYS = ['single', 'multiple', 'judge', 'fill', 'short']

export default function EditSet() {
  const { setId } = useParams()
  const navigate = useNavigate()
  const [setInfo, setSetInfo] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  // 按题型批量设置分值（默认值与上传时一致）
  const [batch, setBatch] = useState({ single: 2, multiple: 2, judge: 1, fill: 3, short: 10 })

  useEffect(() => {
    api
      .getSet(setId)
      .then((d) => {
        setSetInfo(d)
        setQuestions(d.questions)
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false))
  }, [setId])

  const update = (idx, patch) =>
    setQuestions((qs) => qs.map((q, i) => (i === idx ? { ...q, ...patch } : q)))

  const remove = (idx) => setQuestions((qs) => qs.filter((_, i) => i !== idx))
  const add = () =>
    setQuestions((qs) => [
      ...qs,
      { number: qs.length + 1, type: 'single', stem: '', options: [], answer: '', explanation: '', score: 2 },
    ])

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      const cleaned = questions.map((q, i) => ({ ...q, number: i + 1 }))
      await api.updateSet(setId, { questions: cleaned })
      setMsg('已保存')
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const applyBatch = () => {
    let changed = 0
    const next = questions.map((q) => {
      const v = Number(batch[q.type])
      if (Number.isFinite(v) && v >= 0) {
        changed += 1
        return { ...q, score: v }
      }
      return q
    })
    setQuestions(next)
    setMsg(`已按题型更新 ${changed} 道题的分值，点「保存」后生效`)
  }

  const startPractice = async () => {
    try {
      await save()
      const s = await api.createSession(setId, 'order')
      navigate(`/practice/${s.id}`)
    } catch (e) {
      alert(e.message)
    }
  }

  if (loading) return <div className="text-slate-400 py-20 text-center">加载中…</div>
  if (!setInfo) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">{setInfo.title}</h1>
          <p className="text-sm text-slate-500 mt-1">
            共 {questions.length} 题 · {setInfo.has_answers ? '自带答案' : '无答案（交卷后 DeepSeek 生成）'}
            · 解析结果可在此预览和修正
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="border border-slate-300 px-4 py-2 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          <button
            onClick={startPractice}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            开始刷题
          </button>
        </div>
      </div>

      {msg && <div className="text-emerald-600 text-sm mb-3">{msg}</div>}

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
        <div className="text-sm font-medium mb-2">按题型批量设置分值</div>
        <div className="text-xs text-slate-500 mb-3">
          设定每种题型的分值，点击「应用」即可整卷统一修改（只改对应题型的题目）
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {TYPE_KEYS.map((k) => (
            <label key={k} className="flex flex-col gap-1 text-xs text-slate-500">
              {TYPE_LABELS[k]}
              <input
                type="number"
                min="0"
                step="0.5"
                value={batch[k]}
                onChange={(e) => setBatch({ ...batch, [k]: e.target.value })}
                className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
              />
            </label>
          ))}
          <button
            onClick={applyBatch}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-sm"
          >
            应用到本卷
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="font-medium text-indigo-600 shrink-0">第 {idx + 1} 题</span>
              <select
                value={q.type}
                onChange={(e) => update(idx, { type: e.target.value })}
                className="border border-slate-300 rounded-md px-2 py-1 text-sm"
              >
                {TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {TYPE_LABELS[k]}
                  </option>
                ))}
              </select>
              <label className="text-sm text-slate-500 ml-auto flex items-center gap-1">
                分值
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={q.score}
                  onChange={(e) => update(idx, { score: Number(e.target.value) })}
                  className="w-20 border border-slate-300 rounded-md px-2 py-1"
                />
              </label>
              <button onClick={() => remove(idx)} className="text-red-500 text-sm hover:text-red-600">
                删除
              </button>
            </div>

            <textarea
              value={q.stem}
              onChange={(e) => update(idx, { stem: e.target.value })}
              rows={2}
              placeholder="题干"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            {(q.type === 'single' || q.type === 'multiple') && (
              <div className="mb-3">
                <div className="text-xs text-slate-500 mb-1">选项（每行一个，格式：A. 内容）</div>
                <textarea
                  value={optionsToText(q.options)}
                  onChange={(e) => update(idx, { options: textToOptions(e.target.value) })}
                  rows={q.options.length || 4}
                  placeholder={'A. 选项一\nB. 选项二\nC. 选项三\nD. 选项四'}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-slate-500 mb-1">答案</div>
                <input
                  value={q.answer}
                  onChange={(e) => update(idx, { answer: e.target.value })}
                  placeholder={q.type === 'single' ? '如：A' : q.type === 'multiple' ? '如：AB' : '参考答案'}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">解析</div>
                <textarea
                  value={q.explanation}
                  onChange={(e) => update(idx, { explanation: e.target.value })}
                  rows={2}
                  placeholder="解析（可为空）"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-4 w-full border-2 border-dashed border-slate-300 rounded-xl py-3 text-slate-500 hover:border-indigo-400 hover:text-indigo-500"
      >
        ＋ 添加题目
      </button>
    </div>
  )
}
