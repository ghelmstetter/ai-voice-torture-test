@echo off
REM Starts AI Voice Torture Test and opens it in your browser.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20.12+ is required: https://nodejs.org & pause & exit /b 1)
if not exist .env (copy .env.example .env >nul & echo Created .env - add your API keys to it, then run start.bat again. & notepad .env & exit /b 0)
start "" http://localhost:5178
node server/index.js
pause