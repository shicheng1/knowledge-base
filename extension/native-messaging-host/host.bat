@echo off
REM ============================================================
REM 知识库桌面应用 - Native Messaging Host 启动脚本
REM ============================================================
REM
REM 使用方法：
REM   1. 将此文件复制到 %LOCALAPPDATA%\KnowledgeBase\ 目录
REM   2. 修改下方路径，指向实际的 knowledge-base.exe 位置
REM   3. 运行 setup-native-messaging.bat 完成注册
REM
REM 注意：请将 "C:\path\to\knowledge-base.exe" 替换为实际的
REM       Electron 应用打包后的 exe 文件路径。
REM ============================================================

"C:\path\to\knowledge-base.exe" --native-messaging-host
