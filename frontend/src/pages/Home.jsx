import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import Modal from '../components/Modal'

const ORDER_MODES = [
  { key: 'order', label: '顺序', desc: '按题目顺序' },
  { key: 'random', label: '随机', desc: '随机抽取' },
  { key: 'wrong', label: '错题', desc: '只做历史错题' },
]

const COUNT_OPTS = [10, 20, 30, 50]

export default function Home() {
  const [sets, setSets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState(null)
  const [starting, setStarting] = useState(false)
  // 弹窗内的临时选项
  const [optType, setOptType] = useState('exam')
  const [optMode, setOptMode] = useState('order')
  const [optCount, setOptCount] = useState(0) // 0 = 全部
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

  const openPicker = (s) => {
    setOptType('exam')
    setOptMode('order')
    setOptCount(0)
    setPicker(s)
  }

  const start = async () => {
    setStarting(true)
    try {
      const count = optCount > 0 ? optCount : null
      const s = await api.createSession(picker.id, optMode, optType, count)
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
              <div className="flex flex-wrap gap-2 mt-4 text-sm">
                <button
                  onClick={() => openPicker(s)}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700"
                >
                  开始刷题
                </button>
                {s.unfinished_id && (
                  <button
                    onClick={() => navigate(`/practice/${s.unfinished_id}`)}
                    className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
                  >
                    继续练习
                  </button>
                )}
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

          <div className="space-y-4">
            {/* 模式 */}
            <div>
              <div className="text-sm font-medium mb-2">刷题模式</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOptType('exam')}
                  className={`text-left border rounded-lg px-3 py-2.5 ${
                    optType === 'exam'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm">模拟考试</div>
                  <div className="text-xs text-slate-500 mt-1">全部答完交卷后才显示解析</div>
                </button>
                <button
                  onClick={() => setOptType('practice')}
                  className={`text-left border rounded-lg px-3 py-2.5 ${
                    optType === 'practice'
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium text-sm">练习模式</div>
                  <div className="text-xs text-slate-500 mt-1">答一题即看解析，可断点续答</div>
                </button>
              </div>
            </div>

            {/* 题量 */}
            <div>
              <div className="text-sm font-medium mb-2">题目数量</div>
              <div className="flex flex-wrap items-center gap-2">
                {COUNT_OPTS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setOptCount(n)}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${
                      optCount === n
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {n} 题
                  </button>
                ))}
                <button
                  onClick={() => setOptCount(0)}
                  className={`px-3 py-1.5 rounded-lg border text-sm ${
                    optCount === 0
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  全部（{picker.question_count}）
                </button>
                <input
                  type="number"
                  min="1"
                  max={picker.question_count}
                  value={optCount || ''}
                  placeholder="自定义"
                  onChange={(e) => setOptCount(Math.max(0, Number(e.target.value)))}
                  className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* 顺序 */}
            <div>
              <div className="text-sm font-medium mb-2">题目顺序</div>
              <div className="flex gap-2">
                {ORDER_MODES.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setOptMode(m.key)}
                    className={`px-3 py-1.5 rounded-lg border text-sm ${
                      optMode === m.key
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={start}
              disabled={starting}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {starting ? '创建中…' : `开始${optType === 'practice' ? '练习' : '考试'}（${optCount > 0 ? optCount : picker.question_count} 题）`}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
