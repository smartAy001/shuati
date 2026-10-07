const BASE = '/api'

async function req(path, options = {}) {
  const res = await fetch(BASE + path, options)
  if (!res.ok) {
    let msg = `请求失败（${res.status}）`
    try {
      const j = await res.json()
      msg = j.detail || msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.json()
}

const json = (method) => (path, data) =>
  req(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

export const api = {
  // 试题集
  listSets: () => req('/sets'),
  getSet: (id) => req(`/sets/${id}`),
  deleteSet: (id) => req(`/sets/${id}`, { method: 'DELETE' }),
  updateSet: (id, data) => json('PUT')(`/sets/${id}`, data),
  upload: (form) => req('/sets/upload', { method: 'POST', body: form }),

  // 会话
  createSession: (setId, mode) => req(`/sessions?set_id=${setId}&mode=${mode}`, { method: 'POST' }),
  getSession: (id) => req(`/sessions/${id}`),
  saveAnswer: (sid, questionId, answer) =>
    json('PUT')(`/sessions/${sid}/answer`, { question_id: questionId, answer }),
  submit: (sid) => req(`/sessions/${sid}/submit`, { method: 'POST' }),

  // 配置
  getConfig: () => req('/config'),
  setConfig: (data) => json('POST')('/config', data),

  // 上传解析任务
  getTask: (id) => req(`/tasks/${id}`),
}
