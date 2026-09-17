# ============================================================
# KAVACHPAY - TEST #8: REVOCATION CLOSURE
# Parent -> Child -> Revoke Parent -> Child must DENY
# ============================================================

$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$table = "kavachpay-dev"
$region = "ap-south-1"

$parentId = "g_5def0305-289e-4931-a2c7-17818398260b"
$childId  = "g_fe8e611a-225a-48a9-8cc1-4794e4b4a1de"
$userId   = "u_revocation_test_1789657471623"

Write-Host ""
Write-Host "============================================================"
Write-Host " TEST #8 - REVOCATION CLOSURE"
Write-Host "============================================================"
Write-Host "Parent : $parentId"
Write-Host "Child  : $childId"
Write-Host ""

# ------------------------------------------------------------
# 8A - Inspect parent + child
# ------------------------------------------------------------

Write-Host "========== 8A - BEFORE STATE =========="

$parentKey = '{\"PK\":{\"S\":\"USER#' + $userId + '\"},\"SK\":{\"S\":\"GRANT#' + $parentId + '\"}}'
$childKey = '{\"PK\":{\"S\":\"USER#' + $userId + '\"},\"SK\":{\"S\":\"GRANT#' + $childId + '\"}}'

$parentJson = & $aws dynamodb get-item --table-name $table --region $region --key $parentKey --no-cli-pager --output json | ConvertFrom-Json
$childJson = & $aws dynamodb get-item --table-name $table --region $region --key $childKey --no-cli-pager --output json | ConvertFrom-Json

$parent = $parentJson.Item
$child = $childJson.Item

if (-not $parent) {
    Write-Host "ERROR: Parent grant not found." -ForegroundColor Red
    exit 1
}

if (-not $child) {
    Write-Host "ERROR: Child grant not found." -ForegroundColor Red
    exit 1
}

Write-Host "Parent status : $($parent.status.S)"
Write-Host "Parent limit  : ₹$($parent.limit.N)"
Write-Host "Parent used   : ₹$($parent.consumed.N)"
Write-Host "Child status  : $($child.status.S)"
Write-Host "Child limit   : ₹$($child.limit.N)"
Write-Host "Child used    : ₹$($child.consumed.N)"
Write-Host "Child parent  : $($child.parentGrantId.S)"
Write-Host ""

if ($parent.status.S -ne "ACTIVE") {
    Write-Host "ERROR: Parent is not ACTIVE. Stop." -ForegroundColor Red
    exit 1
}

if ($child.status.S -ne "ACTIVE") {
    Write-Host "ERROR: Child is not ACTIVE. Stop." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# 8B - Baseline transaction BEFORE revocation
# ------------------------------------------------------------

Write-Host "========== 8B - CHILD BEFORE REVOCATION =========="

$baselineKey = "revocation-baseline-100-$([guid]::NewGuid())"

$baselineBody = @{
    userId = $userId
    grantId = $childId
    amount = 100
    currency = "INR"
    merchant = @{
        merchantId = "TestMerchant"
        name = "TestMerchant"
        category = "GROCERY"
    }
    idempotencyKey = $baselineKey
} | ConvertTo-Json -Depth 5

try {
    $baseline = Invoke-RestMethod `
        -Uri "http://localhost:4000/v0/intents" `
        -Method POST `
        -ContentType "application/json" `
        -Body $baselineBody

    Write-Host ($baseline | ConvertTo-Json -Depth 10)
}
catch {
    $errorText = $_.ErrorDetails.Message

    Write-Host $errorText

    Write-Host ""
    Write-Host "Baseline was rejected."
    Write-Host "We will NOT continue to revocation automatically."
    exit 1
}

# ------------------------------------------------------------
# Check baseline result
# ------------------------------------------------------------

if ($baseline.decision.decision -ne "ALLOW" -or
    $baseline.decision.reserved -ne $true) {

    Write-Host ""
    Write-Host "ERROR: Child baseline was not ALLOW + RESERVED." -ForegroundColor Red
    Write-Host "Decision: $($baseline.decision.decision)"
    Write-Host "Reserved: $($baseline.decision.reserved)"
    Write-Host ""
    Write-Host "STOPPING before parent revocation."
    exit 1
}

$baselineIntentId = $baseline.intent.intentId

Write-Host ""
Write-Host "BASELINE PASSED:"
Write-Host "Intent   : $baselineIntentId"
Write-Host "Decision : $($baseline.decision.decision)"
Write-Host "Reserved : $($baseline.decision.reserved)"
Write-Host ""

# ------------------------------------------------------------
# Release baseline reservation
# ------------------------------------------------------------

Write-Host "========== CLEANUP BASELINE RESERVATION =========="

$releaseScript = "import { reservationRepository } from './src/store/reservation-repository.ts'; const result = await reservationRepository.release('$baselineIntentId'); console.log('Release result:', result);"

$tmpFile = "release-tmp-$([guid]::NewGuid()).ts"
Set-Content -Path $tmpFile -Value $releaseScript -Encoding UTF8

try {
    npx tsx $tmpFile
}
finally {
    Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
}

Write-Host ""

# ------------------------------------------------------------
# 8C - Revoke parent
# ------------------------------------------------------------

Write-Host "========== 8C - REVOKE PARENT =========="

try {
    $revoke = Invoke-RestMethod `
        -Uri "http://localhost:4000/v0/grants/$parentId/revoke" `
        -Method POST `
        -ContentType "application/json" `
        -Body (@{ userId = $userId } | ConvertTo-Json)

    Write-Host ($revoke | ConvertTo-Json -Depth 10)
}
catch {
    Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    exit 1
}

Write-Host ""

# ------------------------------------------------------------
# Verify parent is actually revoked
# ------------------------------------------------------------

Write-Host "========== VERIFY PARENT REVOCATION =========="

$parentJsonAfter = & $aws dynamodb get-item --table-name $table --region $region --key $parentKey --no-cli-pager --output json | ConvertFrom-Json
$childJsonAfter = & $aws dynamodb get-item --table-name $table --region $region --key $childKey --no-cli-pager --output json | ConvertFrom-Json

$parentAfter = $parentJsonAfter.Item
$childAfter = $childJsonAfter.Item

Write-Host "Parent status after revoke: $($parentAfter.status.S)"
Write-Host "Child status after revoke : $($childAfter.status.S)"
Write-Host ""

if ($parentAfter.status.S -ne "REVOKED") {
    Write-Host "ERROR: Parent was not marked REVOKED." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------
# 8D - Attempt child transaction AFTER parent revocation
# ------------------------------------------------------------

Write-Host "========== 8D - CHILD AFTER REVOCATION =========="

$afterKey = "revocation-after-100-$([guid]::NewGuid())"

$afterBody = @{
    userId = $userId
    grantId = $childId
    amount = 100
    currency = "INR"
    merchant = @{
        merchantId = "TestMerchant"
        name = "TestMerchant"
        category = "GROCERY"
    }
    idempotencyKey = $afterKey
} | ConvertTo-Json -Depth 5

try {
    $after = Invoke-RestMethod `
        -Uri "http://localhost:4000/v0/intents" `
        -Method POST `
        -ContentType "application/json" `
        -Body $afterBody

    Write-Host ($after | ConvertTo-Json -Depth 10)

    $afterDecision = $after.decision.decision
    $afterReserved = $after.decision.reserved
    $afterReason = $after.decision.reasonCode

}
catch {
    $errorText = $_.ErrorDetails.Message

    Write-Host $errorText

    try {
        $afterJson = $errorText | ConvertFrom-Json
        $afterDecision = $afterJson.decision.decision
        $afterReserved = $afterJson.decision.reserved
        $afterReason = $afterJson.decision.reasonCode
    }
    catch {
        Write-Host "Could not parse denial response."
        exit 1
    }
}

# ------------------------------------------------------------
# FINAL RESULT
# ------------------------------------------------------------

Write-Host ""
Write-Host "============================================================"
Write-Host " TEST #8 RESULT"
Write-Host "============================================================"

Write-Host "Parent status : $($parentAfter.status.S)"
Write-Host "Child status  : $($childAfter.status.S)"
Write-Host "Child decision: $afterDecision"
Write-Host "Reserved      : $afterReserved"
Write-Host "Reason code   : $afterReason"
Write-Host ""

if ($afterDecision -eq "DENY" -and $afterReserved -eq $false) {

    Write-Host "============================================================"
    Write-Host " REVOCATION CLOSURE: PASS"
    Write-Host "============================================================"
    Write-Host ""
    Write-Host "Parent was revoked."
    Write-Host "Child remained stored in the graph."
    Write-Host "Child transaction was denied."
    Write-Host "No new reservation was created."
    Write-Host ""
}
else {

    Write-Host "============================================================"
    Write-Host " REVOCATION CLOSURE: FAIL"
    Write-Host "============================================================"
    Write-Host ""
    Write-Host "Expected:"
    Write-Host "  decision = DENY"
    Write-Host "  reserved = false"
    Write-Host ""
}
