@echo off
rem ============================================================
rem  マイクラ経済ワールド - ローカル閲覧・編集用ランチャー
rem  ダブルクリックすると編集サーバーを起動し、ブラウザで開きます。
rem  （価格表は fetch を使うため、file:// 直開きでは表示できません）
rem  終了するときはこの黒い窓を閉じてください。
rem ============================================================
cd /d "%~dp0"

set PY=C:\Python313\python.exe
if not exist "%PY%" set PY=py

start "" /b cmd /c "timeout /t 1 >nul & start http://localhost:8000/"
"%PY%" tools\dev_server.py
pause
