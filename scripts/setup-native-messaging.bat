@echo off
REM ============================================================
REM 知识库保存助手 - Native Messaging Host 注册脚本
REM ============================================================
REM
REM 功能：
REM   1. 创建 %LOCALAPPDATA%\KnowledgeBase 目录
REM   2. 生成 host.bat 启动脚本（含正确的应用路径）
REM   3. 生成 com.knowledgebase.host.json 配置文件
REM   4. 在 Windows 注册表中注册 Native Messaging Host
REM
REM 使用方法：
REM   以管理员身份运行此脚本，或在普通用户权限下运行
REM   （注册到 HKCU 不需要管理员权限）。
REM
REM 注意事项：
REM   - 请修改下方 APP_PATH 变量为实际的 exe 路径
REM   - 请修改 EXTENSION_ID 变量为实际的 Chrome 扩展 ID
REM     （可在 chrome://extensions 中获取）
REM ============================================================

setlocal enabledelayedexpansion

REM ---- 配置区域（请根据实际情况修改） ----

REM Electron 应用 exe 文件路径
set "APP_PATH=C:\path\to\knowledge-base.exe"

REM Chrome 扩展 ID（在 chrome://extensions 开发者模式中获取）
set "EXTENSION_ID=your-extension-id-here"

REM Native Messaging Host 名称
set "HOST_NAME=com.knowledgebase.host"

REM ---- 配置区域结束 ----

REM 验证应用路径
if not exist "%APP_PATH%" (
    echo [错误] 应用文件不存在: %APP_PATH%
    echo 请修改脚本中的 APP_PATH 变量为正确的路径。
    pause
    exit /b 1
)

REM 设置目标目录
set "TARGET_DIR=%LOCALAPPDATA%\KnowledgeBase"
set "HOST_BAT=%TARGET_DIR%\host.bat"
set "HOST_JSON=%TARGET_DIR%\%HOST_NAME%.json"
set "REG_KEY=HKCU\SOFTWARE\Google\Chrome\NativeMessagingHosts\%HOST_NAME%"

echo ============================================================
echo  知识库保存助手 - Native Messaging Host 注册
echo ============================================================
echo.

REM 步骤 1：创建目标目录
echo [1/4] 创建目录: %TARGET_DIR%
if not exist "%TARGET_DIR%" (
    mkdir "%TARGET_DIR%"
    if errorlevel 1 (
        echo [错误] 无法创建目录: %TARGET_DIR%
        pause
        exit /b 1
    )
    echo       目录创建成功。
) else (
    echo       目录已存在。
)

REM 步骤 2：生成 host.bat
echo [2/4] 生成启动脚本: %HOST_BAT%
(
    echo @echo off
    echo "%APP_PATH%" --native-messaging-host
) > "%HOST_BAT%"
if errorlevel 1 (
    echo [错误] 无法写入文件: %HOST_BAT%
    pause
    exit /b 1
)
echo       启动脚本生成成功。

REM 步骤 3：生成 Native Messaging Host 配置文件
echo [3/4] 生成配置文件: %HOST_JSON%

REM 使用 PowerShell 生成 JSON 文件（避免 echo 的引号转义问题）
powershell -NoProfile -Command ^
    "$json = @{^"name^"='%HOST_NAME%';^"description^"='知识库桌面应用 Native Messaging Host';^"path^"='%HOST_BAT:\=\\%';^"type^"='stdio';^"allowed_origins^"=@('chrome-extension://%EXTENSION_ID%/')} | ConvertTo-Json -Depth 3; [System.IO.File]::WriteAllText('%HOST_JSON:\=\\%', $json, [System.Text.Encoding]::UTF8)"

if errorlevel 1 (
    echo [错误] 无法生成配置文件。
    pause
    exit /b 1
)
echo       配置文件生成成功。

REM 步骤 4：注册到 Windows 注册表
echo [4/4] 注册到注册表: %REG_KEY%
reg add "%REG_KEY%" /ve /t REG_SZ /d "%HOST_JSON%" /f >nul 2>&1
if errorlevel 1 (
    echo [错误] 注册表写入失败。
    echo 请确保有足够的权限。
    pause
    exit /b 1
)
echo       注册表写入成功。

echo.
echo ============================================================
echo  注册完成！
echo ============================================================
echo.
echo  配置文件: %HOST_JSON%
echo  启动脚本: %HOST_BAT%
echo  注册表项: %REG_KEY%
echo.
echo  请重启 Chrome 浏览器使配置生效。
echo.
pause
