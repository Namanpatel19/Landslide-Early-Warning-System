# ╔══════════════════════════════════════════════════════════╗
# ║  LandWatch NER — Start Both Servers (PowerShell)        ║
# ║  Run from: c:\Users\Khati\Desktop\SIH\                  ║
# ║  Usage:  .\start.ps1                                     ║
# ╚══════════════════════════════════════════════════════════╝

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "=== LandWatch NER — Starting Servers ===" -ForegroundColor Cyan
Write-Host ""

# ── Backend ────────────────────────────────────────────────
Write-Host 'Starting Backend: FastAPI on port 8000...' -ForegroundColor Yellow
$backend = Start-Process powershell -ArgumentList `
    "-NoExit", "-Command", `
    "cd '$PSScriptRoot\backend'; python -m uvicorn app.main:app --reload --port 8000 --host 0.0.0.0" `
    -PassThru
Write-Host "  Backend PID: $($backend.Id)" -ForegroundColor Green

Start-Sleep -Seconds 2

# ── Frontend ───────────────────────────────────────────────
Write-Host 'Starting Frontend: Vite on port 5173...' -ForegroundColor Yellow
$frontend = Start-Process powershell -ArgumentList `
    "-NoExit", "-Command", `
    "cd '$PSScriptRoot\frontend'; npm run dev" `
    -PassThru
Write-Host "  Frontend PID: $($frontend.Id)" -ForegroundColor Green

Write-Host ""
Write-Host "Both servers started!" -ForegroundColor Cyan
Write-Host "  Frontend:  http://localhost:5173" -ForegroundColor White
Write-Host "  Backend:   http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs:  http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in each terminal to stop." -ForegroundColor Gray
