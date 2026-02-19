# Medusa V2 Service Connectivity Test Script for Windows (PowerShell)

Write-Host "------------------------------------------------" -ForegroundColor Cyan
Write-Host "Starting Medusa V2 Service Connectivity Test" -ForegroundColor Cyan
Write-Host "------------------------------------------------" -ForegroundColor Cyan

$allPassed = $true

# 1. Test Medusa Backend (Port 7001)
Write-Host "Checking Medusa Backend (Port 7001)... " -NoNewline
try {
    $resp1 = Invoke-WebRequest -Uri "http://localhost:7001/health" -Method Get -UseBasicParsing -TimeoutSec 5
    if ($resp1.StatusCode -eq 200) {
        Write-Host "PASS" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL" -ForegroundColor Red
        $allPassed = $false
    }
}
catch {
    Write-Host "FAIL (Unreachable)" -ForegroundColor Red
    $allPassed = $false
}

# 2. Test Medusa Admin UI (Port 9000)
Write-Host "Checking Medusa Admin UI (Port 9000)... " -NoNewline
try {
    $resp2 = Invoke-WebRequest -Uri "http://localhost:9000/health" -Method Get -UseBasicParsing -TimeoutSec 5
    if ($resp2.StatusCode -eq 200) {
        Write-Host "PASS" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL" -ForegroundColor Red
        $allPassed = $false
    }
}
catch {
    Write-Host "FAIL (Unreachable)" -ForegroundColor Red
    $allPassed = $false
}

# 3. Test Admin UI Asset Accessibility
Write-Host "Checking Admin UI Index File... " -NoNewline
try {
    $resp3 = Invoke-WebRequest -Uri "http://localhost:9000/app/index.html" -Method Get -UseBasicParsing -TimeoutSec 5
    if ($resp3.StatusCode -eq 200) {
        Write-Host "PASS" -ForegroundColor Green
    }
    else {
        Write-Host "FAIL" -ForegroundColor Red
        $allPassed = $false
    }
}
catch {
    Write-Host "FAIL (Unreachable)" -ForegroundColor Red
    $allPassed = $false
}

Write-Host "------------------------------------------------" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "Test Completed Successfully" -ForegroundColor Green
}
else {
    Write-Host "Test Completed with Errors" -ForegroundColor Red
}
Write-Host "------------------------------------------------" -ForegroundColor Cyan
