import { useEffect, useState } from 'react'
import { api } from '../api'

export default function Settings() {
  const [cfg, setCfg] = useState(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () =>
    api.getConfig().then((c) => {
      setCfg(c)
      setBaseUrl(c.base_url)
      setModel(c.model)
    })

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg('')
    try {
      const payload = { base_url: baseUrl, model }
      if (apiKey.trim()) payload.api_key = apiKey.trim()
      await api.setConfig(payload)
      setApiKey('')
      setMsg('已保存')
      await load()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const clearKey = async () => {
    if (!window.confirm('确定清除已保存的 API Key？')) return
    await api.setConfig({ api_key: '' })
    setMsg('已清除')
    await load()
  }

  if (!cfg) return <div className="text-slate-400 py-20 text-center">加载中…</div>

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold mb-5">设置</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-sm">
        <div>
          <div className="text-sm font-medium mb-2">DeepSeek API Key</div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={cfg.has_api_key ? `已配置（${cfg.api_key_masked}），输入新值可覆盖` : '填写你的 DeepSeek API Key'}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="text-xs text-slate-500 mt-1">
            {cfg.has_api_key ? `当前已配置：${cfg.api_key_masked}` : '尚未配置，无答案的试题集需要用到'}
            {' · '}
            <a
              href="https://platform.deepseek.com/api_keys"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              获取 Key
            </a>
          </div>
        </div>

        <div>
          <div className="text-sm font-medium mb-2">API 地址</div>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div>
          <div className="text-sm font-medium mb-2">模型名称</div>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        {msg && <div className="text-emerald-600 text-sm">{msg}</div>}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? '保存中…' : '保存'}
          </button>
          {cfg.has_api_key && (
            <button
              onClick={clearKey}
              className="text-red-500 px-3 py-2 hover:text-red-600"
            >
              清除 Key
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
