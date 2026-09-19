$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================"
Write-Host " KAVACHPAY - FULL V1 + V2 VALIDATION SUITE"
Write-Host "============================================================"
Write-Host ""

Write-Host "Running V1 Test Suite..." -ForegroundColor Cyan
.\master-test.ps1
$v1Exit = $LASTEXITCODE

Write-Host ""
Write-Host "Running V2 Test Suite..." -ForegroundColor Cyan
npx tsx src\test-v2.ts
$v2Exit = $LASTEXITCODE

if ($v1Exit -ne 0 -or $v2Exit -ne 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " VALIDATION FAILED" -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " ALL VALIDATION PASSED (V1 + V2)" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    exit 0
}
