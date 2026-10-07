# 自定义刷题 Web 软件

一个**个人本地使用**的刷题工具：上传 PDF / Word / 图片试题，自动解析成题目，在浏览器里刷题，交卷后自动判分——无答案的题由 DeepSeek 生成答案解析，有答案的题直接对照。

## 功能特性

- **文件上传**：支持 PDF（文字版 / 扫描版）、Word（.docx）、图片（.png/.jpg 等，可多张）
- **两种文件类型**：`仅题目（无答案）` → 交卷后 DeepSeek 生成解析；`题目 + 答案解析` → 直接对照自带答案
- **答案位置识别**：自动识别 / 答案紧跟题目 / 答案在文件末尾 / 单独的答案文件
- **题型识别**：单选题、多选题、判断题、填空题、简答题（主观题）
- **刷题模式**：顺序练习、随机打乱、错题重做，进度自动保存
- **判分评分**：客观题自动判分；主观题 DeepSeek 评分（分值可自定义，AI 分数可手动调整）
- **成绩统计**：总分、正确率、错题清单、答案解析

## 环境要求

- Python 3.10+
- Node.js 18+（仅构建前端时需要）

## 快速开始（Windows）

双击 **`start.bat`** 即可：

1. 首次运行会自动创建虚拟环境、安装依赖、构建前端（约几分钟）
2. 完成后浏览器自动打开 http://127.0.0.1:8000

## 配置 DeepSeek API Key

「仅题目（无答案）」的试题集在交卷时需要调用 DeepSeek 生成解析，二选一：

1. 打开软件右上角「设置」页，填入 API Key
2. 或复制 `.env.example` 为 `.env`，填写 `DEEPSEEK_API_KEY`

> Key 获取地址：https://platform.deepseek.com/api_keys
> Key 只保存在本地，不会提交到 GitHub。

## 开发模式

**后端**（端口 8000）：

```bash
python -m venv .venv
.venv/Scripts/activate          # Windows PowerShell 用 .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py                   # 或：uvicorn backend.main:app --reload
```

**前端**（另开一个终端，端口 5173）：

```bash
cd frontend
npm install
npm run dev                     # 已配置 /api 代理到 8000
```

开发时访问 http://localhost:5173 ；生产时构建前端后由后端托管，访问 http://127.0.0.1:8000 。

## 目录结构

```
刷题/
├── backend/             # FastAPI 后端
│   ├── main.py          # 入口
│   ├── config.py        # 配置与路径
│   ├── database.py      # SQLite
│   ├── routers/         # 接口：试题集 / 会话 / 配置
│   └── services/        # 解析 / OCR / 结构化 / DeepSeek
├── frontend/            # React + Vite + Tailwind 前端
│   └── src/pages/       # 首页 / 上传 / 编辑 / 刷题 / 结果 / 设置
├── data/                # 本地数据（SQLite、上传临时文件，已 gitignore）
├── start.bat            # 一键启动
├── requirements.txt
└── 需求说明.md          # 需求文档
```

## 说明与限制

- 数据全部保存在本地 `data/` 目录，不上传第三方（调用 DeepSeek 时仅发送题目文本）
- **单文件上传上限 50MB**，更大的文件请拆分后上传
- OCR 采用本地离线 **RapidOCR**；数学公式、复杂图表识别有限，解析结果可在「编辑」页手动修正
- **扫描版 PDF 需逐页 OCR**，页数越多耗时越长，上传后可见实时进度条
- 旧版 `.doc` 文件请先用 Word 另存为 `.docx`
- 主观题 AI 评分为参考，可在结果中自行调整对错判断
