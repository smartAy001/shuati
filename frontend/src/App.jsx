import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Upload from './pages/Upload'
import EditSet from './pages/EditSet'
import Practice from './pages/Practice'
import Result from './pages/Result'
import Settings from './pages/Settings'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-indigo-600">
            自定义刷题
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md ${isActive ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100'}`
              }
            >
              首页
            </NavLink>
            <NavLink
              to="/upload"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md ${isActive ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100'}`
              }
            >
              上传题目
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md ${isActive ? 'bg-indigo-50 text-indigo-600' : 'hover:bg-slate-100'}`
              }
            >
              设置
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/edit/:setId" element={<EditSet />} />
          <Route path="/practice/:sessionId" element={<Practice />} />
          <Route path="/result/:sessionId" element={<Result />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
