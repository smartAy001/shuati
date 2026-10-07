import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import Modal from '../components/Modal'

const MODES = [
  { key: 'order', label: '顺序练习', desc: '按题目顺序作答' },
  { key: 'random', label: '随机打乱', desc: '随机排序作答' },
  { key: 'wrong', label: '错题重做', desc: '只做做过的错题' },
]

export default function Home() {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState(null)
  const [starting, setStarting] = useState(false)
  const navigate = useNavigate()

  const load = () => {
    setLoading(true)
    api
      .listSets()
      .then(setSets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const start = async (mode) => {
    setStarting(true)
    try {
      const s = await api.createSession(picker.id, mode)
      navigate(`/practice/${s.id}`)
    } catch (e) {
      alert(e.message)
      setStarting(false)
    }
  }

  const del = async (set) => {
    if (!window.confirm(`确定删除「${set.title}」？删除后不可恢复。`)) return
    try {
      await api.deleteSet(set.id)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-semibold">我的试题集</h1>
        <Link
          to="/upload"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          ＋ 上传题目
        </Link>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {loading ? (
        <div className="text-slate-400 py-20 text-center">加载中…</div>
      ) : sets.length === 0 ? (
        <div className="text-center py-24 text-slate-400">
          <p className="text-lg mb-2">还没有试题集</p>
          <p>点击右上角「上传题目」开始</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sets.map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-lg truncate" title={s.title}>
                  {s.title}
                </h3>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                    s.has_answers ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}
                >
                  {s.has_answers ? '自带答案' : '无答案·DeepSeek'}
                </span>
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {s.question_count} 题 · {s.source_type || '未知来源'} · {s.created_at}
              </div>
              <div className="flex gap-2 mt-4 text-sm">
                <button
                  onClick={() => setPicker(s)}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                >
                  开始刷题
                </button>
                <Link
                  to={`/edit/${s.id}`}
                  className="border border-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-50"
                >
                  编辑
                </Link>
                <button
                  onClick={() => del(s)}
                  className="text-red-500 px-2 py-1.5 hover:text-red-600 ml-auto"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {picker && (
        <Modal onClose={() => setPicker(null)}>
          <h3 className="font-semibold text-lg mb-1">开始刷题</h3>
          <p className="text-sm text-slate-500 mb-4 truncate">{picker.title}</p>
          <div className="space-y-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                disabled={starting}
                onClick={() => start(m.key)}
                className="w-full text-left border border-slate-200 rounded-lg px-3 py-2.5 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
              >
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-slate-500">{m.desc}</div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
