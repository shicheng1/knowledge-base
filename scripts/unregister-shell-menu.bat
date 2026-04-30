@echo off
REM ============================================================
REM 知识库保存助手 - Windows 右键菜单卸载脚本
REM ============================================================
REM
REM 功能：
REM   移除在 Windows 资源管理器右键菜单中添加的
REM   "保存到知识库"选项。
REM
REM 使用方法：
REM   以管理员身份运行此脚本。
REM ============================================================

setlocal

echo ============================================================
echo  知识库保存助手 - 右键菜单卸载
echo ============================================================
echo.

REM ---- 删除文件右键菜单 ----
echo [1/3] 删除文件右键菜单...
reg delete "HKCR\*\shell\SaveToKnowledgeBase" /f >nul 2>&1
if errorlevel 1 (
    echo       文件右键菜单不存在或已删除。
) else (
    echo       文件右键菜单已删除。
)

REM ---- 删除文件夹右键菜单 ----
echo [2/3] 删除文件夹右键菜单...
reg delete "HKCR\Directory\shell\SaveToKnowledgeBase" /f >nul 2>&1
if errorlevel 1 (
    echo       文件夹右键菜单不存在或已删除。
) else (
    echo       文件夹右键菜单已删除。
)

REM ---- 删除文件夹背景右键菜单 ----
echo [3/3] 删除文件夹背景右键菜单...
reg delete "HKCR\Directory\Background\shell\SaveToKnowledgeBase" /f >nul 2>&1
if errorlevel 1 (
    echo       文件夹背景右键菜单不存在或已删除。
) else (
    echo       文件夹背景右键菜单已删除。
)

echo.
echo ============================================================
echo  卸载完成！
echo ============================================================
echo.
echo  所有右键菜单项已被移除。
echo.
pause
