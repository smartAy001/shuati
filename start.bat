@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   自定义刷题 - 一键启动
echo ==========================================

echo [1/4] 检查 Python 虚拟环境...
if not exist ".venv\Scripts\python.exe" (
    echo   首次运行，正在创建虚拟环境...
    python -m venv .venv
    if errorlevel 1 (
        echo [错误] 创建虚拟环境失败，请确认已安装 Python 3.10+
        pause
        exit /b 1
    )
)

echo [2/4] 安装后端依赖...
.venv\Scripts\python.exe -m pip install -r requirements.txt -q

echo [3/4] 安装并构建前端...
if not exist "frontend\node_modules" (
    echo   首次运行，安装前端依赖（可能需要几分钟）...
    pushd frontend
    call npm install
    popd
)
pushd frontend
call npm run build
popd

echo [4/4] 启动服务...
echo   浏览器将自动打开 http://127.0.0.1:8000
start "" cmd /c "timeout /t 3 >nul & start http://127.0.0.1:8000"
.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

endlocal
