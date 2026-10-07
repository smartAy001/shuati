export const TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  short: '简答题',
}

export const ANSWER_LOCATION_LABELS = {
  auto: '自动识别',
  inline: '答案紧跟题目',
  end: '答案在文件末尾',
  separate: '单独的答案文件',
}

export function optionsToText(options = []) {
  return options.map((o) => `${o.label}. ${o.text}`).join('\n')
}

export function textToOptions(text = '') {
  return text
    .split('\n')
    .map((l) => {
      const m = l.match(/^\s*([A-Ha-h])\s*[.、．:：)]\s*(.*)$/)
      return m ? { label: m[1].toUpperCase(), text: m[2].trim() } : null
    })
    .filter(Boolean)
}
