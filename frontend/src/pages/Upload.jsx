import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { ANSWER_LOCATION_LABELS } from '../utils'

export default function Upload() {
  const [files, setFiles] = useState([])
  const [answerFile, setAnswerFile] = useState(null)
  const [hasAnswers, setHasAnswers] = useState(false)
  const [answerLocation, setAnswerLocation] = useState('auto')
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(null) // { progress, message }
  const [error, setError] = useState('')
  const pollTimer = useRef(null)
  const navigate = useNavigate()

  const submit = async () => {
    setError('')
    if (files.length === 0) return setError('请选择题目文件')
    if (hasAnswers && answerLocation === 'separate' && !answerFile)
      return setError('请上传单独的答案文件')

    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    if (answerFile) fd.append('answer_file', answerFile)
    fd.append('has_answers', hasAnswers ? '1' : '0')
    fd.append('answer_location', answerLocation)
    if (title.trim()) fd.append('title', title.trim())

    setLoading(true)
    setProgress({ progress: 0, message: '正在上传文件…' })
    try {
      const { task_id } = await api.upload(fd)
      poll(task_id)
    } catch (e) {
      setError(e.message)
      setLoading(false)
      setProgress(null)
    }
  }

  const poll = (taskId) => {
    pollTimer.current = setInterval(async () => {
      try {
        const t = await api.getTask(taskId)
        if (t.status === 'processing') {
          setProgress({ progress: t.progress ?? 0, message: t.message || '处理中…' })
        } else if (t.status === 'done') {
          clearInterval(pollTimer.current)
          navigate(`/edit/${t.result.set_id}`)
        } else if (t.status === 'error') {
          clearInterval(pollTimer.current)
          setError(t.error || '处理失败')
          setLoading(false)
          setProgress(null)
        }
      } catch {
        /* 网络抖动，继续轮询 */
      }
    }, 700)
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-5">上传题目</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6 shadow-sm">
        <Field label="试题集名称（可选）">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            placeholder="留空则使用文件名"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
          />
        </Field>

        <Field label="题目文件（PDF / Word / 图片，可多选，单文件 ≤ 50MB）">
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.bmp,.webp"
            disabled={loading}
            onChange={(e) => setFiles([...e.target.files])}
            className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 disabled:opacity-60"
          />
          {files.length > 0 && (
            <div className="text-sm text-slate-500 mt-2">
              已选 {files.length} 个文件：
              {files.map((f) => `${f.name}（${(f.size / 1024 / 1024).toFixed(1)}MB）`).join('、')}
            </div>
          )}
        </Field>

        <Field label="文件类型">
          <div className="flex gap-3">
            <RadioCard
              active={!hasAnswers}
              onClick={() => !loading && setHasAnswers(false)}
              title="仅题目（无答案）"
              desc="做完后由 DeepSeek 生成答案与解析"
            />
            <RadioCard
              active={hasAnswers}
              onClick={() => !loading && setHasAnswers(true)}
              title="题目 + 答案解析"
              desc="文件里自带答案，做完直接对照"
            />
          </div>
        </Field>

        {hasAnswers && (
          <Field label="答案位置">
            <select
              value={answerLocation}
              onChange={(e) => setAnswerLocation(e.target.value)}
              disabled={loading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-50"
            >
              {Object.entries(ANSWER_LOCATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>

            {answerLocation === 'separate' && (
              <div className="mt-3">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.bmp,.webp"
                  disabled={loading}
                  onChange={(e) => setAnswerFile(e.target.files[0] || null)}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 disabled:opacity-60"
                />
                <div className="text-xs text-slate-500 mt-1">上传只含答案的文件</div>
              </div>
            )}
          </Field>
        )}

        {error && <div className="text-red-500 text-sm">{error}</div>}

        {loading ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span>{progress?.message || '处理中…'}</span>
              <span>{progress?.progress ?? 0}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progress?.progress ?? 0}%` }}
              />
            </div>
            <div className="text-xs text-slate-400">
              扫描版 PDF 需要逐页 OCR，页数越多耗时越长，请耐心等待进度条前进
            </div>
          </div>
        ) : (
          <button
            onClick={submit}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700"
          >
            上传并解析
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{label}</div>
      {children}
    </div>
  )
}

function RadioCard({ active, onClick, title, desc }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 text-left border rounded-lg px-3 py-3 ${
        active ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{desc}</div>
    </button>
  )
}
