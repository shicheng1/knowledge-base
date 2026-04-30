@echo off
REM ============================================================
REM 知识库保存助手 - Windows 右键菜单注册脚本
REM ============================================================
REM
REM 功能：
REM   在 Windows 资源管理器右键菜单中添加"保存到知识库"选项
REM   支持以下场景：
REM     - 右键点击文件：保存该文件到知识库
REM     - 右键点击文件夹：保存该文件夹到知识库
REM     - 右键点击文件夹背景：保存当前文件夹到知识库
REM
REM 使用方法：
REM   以管理员身份运行此脚本。
REM   修改 APP_PATH 变量为实际的 exe 文件路径。
REM ============================================================

setlocal

REM ---- 配置区域（请根据实际情况修改） ----

REM Electron 应用 exe 文件路径
set "APP_PATH=C:\path\to\knowledge-base.exe"

REM 菜单显示名称
set "MENU_LABEL=保存到知识库"

REM 图标路径（使用 exe 内嵌图标）
set "MENU_ICON=%APP_PATH%,0"

REM ---- 配置区域结束 ----

REM 验证应用路径
if not exist "%APP_PATH%" (
    echo [错误] 应用文件不存在: %APP_PATH%
    echo 请修改脚本中的 APP_PATH 变量为正确的路径。
    pause
    exit /b 1
)

echo ============================================================
echo  知识库保存助手 - 右键菜单注册
echo ============================================================
echo.

REM ---- 注册文件右键菜单 ----
echo [1/3] 注册文件右键菜单...
reg add "HKCR\*\shell\SaveToKnowledgeBase" /ve /t REG_SZ /d "%MENU_LABEL%" /f >nul 2>&1
if errorlevel 1 (
    echo [错误] 注册文件右键菜单失败。
    goto :error
)
reg add "HKCR\*\shell\SaveToKnowledgeBase" /v "Icon" /t REG_SZ /d "%MENU_ICON%" /f >nul 2>&1
reg add "HKCR\*\shell\SaveToKnowledgeBase\command" /ve /t REG_SZ /d "\"%APP_PATH%\" --save-file \"%%1\"" /f >nul 2>&1
echo       文件右键菜单注册成功。

REM ---- 注册文件夹右键菜单 ----
echo [2/3] 注册文件夹右键菜单...
reg add "HKCR\Directory\shell\SaveToKnowledgeBase" /ve /t REG_SZ /d "%MENU_LABEL%" /f >nul 2>&1
if errorlevel 1 (
    echo [错误] 注册文件夹右键菜单失败。
    goto :error
)
reg add "HKCR\Directory\shell\SaveToKnowledgeBase" /v "Icon" /t REG_SZ /d "%MENU_ICON%" /f >nul 2>&1
reg add "HKCR\Directory\shell\SaveToKnowledgeBase\command" /ve /t REG_SZ /d "\"%APP_PATH%\" --save-folder \"%%1\"" /f >nul 2>&1
echo       文件夹右键菜单注册成功。

REM ---- 注册文件夹背景右键菜单 ----
echo [3/3] 注册文件夹背景右键菜单...
reg add "HKCR\Directory\Background\shell\SaveToKnowledgeBase" /ve /t REG_SZ /d "%MENU_LABEL%" /f >nul 2>&1
if errorlevel 1 (
    echo [错误] 注册文件夹背景右键菜单失败。
    goto :error
)
reg add "HKCR\Directory\Background\shell\SaveToKnowledgeBase" /v "Icon" /t REG_SZ /d "%MENU_ICON%" /f >nul 2>&1
reg add "HKCR\Directory\Background\shell\SaveToKnowledgeBase\command" /ve /t REG_SZ /d "\"%APP_PATH%\" --save-folder \"%%V\"" /f >nul 2>&1
echo       文件夹背景右键菜单注册成功。

echo.
echo ============================================================
echo  注册完成！
echo ============================================================
echo.
echo  已注册以下右键菜单项：
echo    - 文件右键菜单: 保存到知识库
echo    - 文件夹右键菜单: 保存到知识库
echo    - 文件夹背景右键菜单: 保存到知识库
echo.
echo  如需卸载，请运行 unregister-shell-menu.bat。
echo.
pause
exit /b 0

:error
echo.
echo [失败] 注册过程中出现错误。
echo 请确保以管理员身份运行此脚本。
echo.
pause
exit /b 1
