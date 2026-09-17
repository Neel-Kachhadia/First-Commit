$ErrorActionPreference = "Continue"

$base = "http://localhost:4000"
$aws = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
$table = "kavachpay-dev"
$region = "ap-south-1"

$passed = 0
$failed = 0
$results = @()

function Pass($name) {
    Write-Host "[PASS] $name" -ForegroundColor Green
    $script:passed++
    $script:results += [PSCustomObject]@{ Test = $name; Result = "PASS" }
}

function Fail($name, $detail = "") {
    Write-Host "[FAIL] $name" -ForegroundColor Red
    if ($detail) { Write-Host "       $detail" -ForegroundColor Yellow }
    $script:failed++
    $script:results += [PSCustomObject]@{ Test = $name; Result = "FAIL" }
}

function PostJson($url, $body) {
    try {
        return Invoke-RestMethod `
            -Uri $url `
            -Method POST `
            -ContentType "application/json" `
            -Body ($body | ConvertTo-Json -Depth 10)
    }
    catch {
        $raw = $_.ErrorDetails.Message
        if ($raw) {
            try {
                return @{ __error = $true; response = ($raw | ConvertFrom-Json) }
            }
            catch {
                return @{ __error = $true; raw = $raw }
            }
        }
        return @{ __error = $true; raw = $_.Exception.Message }
    }
}

function GetGrant($userId, $grantId) {
    $key = '{\"PK\":{\"S\":\"USER#' + $userId + '\"},\"SK\":{\"S\":\"GRANT#' + $grantId + '\"}}'
    $result = & $aws dynamodb get-item `
        --table-name $table `
        --region $region `
        --key $key `
        --no-cli-pager `
        --output json | ConvertFrom-Json
    return $result.Item
}

Write-Host ""
Write-Host "============================================================"
Write-Host " KAVACHPAY - FULL VALIDATION SUITE"
Write-Host "============================================================"
Write-Host ""

# ============================================================
# 01 - BUILD
# ============================================================

Write-Host "========== 01 - BUILD =========="

npm run build 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Pass "Backend build"
} else {
    Fail "Backend build"
}

# ============================================================
# 02 - UNIT TESTS
# ============================================================

Write-Host ""
Write-Host "========== 02 - UNIT TESTS =========="

npm test 2>&1 | Tee-Object -Variable testOutput | Select-String -Pattern "Tests|passed|failed" | Select-Object -Last 3

if ($LASTEXITCODE -eq 0) {
    Pass "Backend unit tests (77/77)"
} else {
    Fail "Backend unit tests"
}

# ============================================================
# 03 - HEALTH
# ============================================================

Write-Host ""
Write-Host "========== 03 - HEALTH =========="

try {
    $health = Invoke-RestMethod "$base/health"
    if ($health.status -eq "ok") {
        Pass "API health check"
    } else {
        Fail "API health check" ($health | ConvertTo-Json)
    }
}
catch {
    Fail "API health check" $_.Exception.Message
}

# ============================================================
# FIXTURE - Create fresh isolated user
# ============================================================

$ts = Get-Date -Format "yyyyMMddHHmmssfff"
$userId = "u_master_test_$ts"

Write-Host ""
Write-Host "========== TEST FIXTURE =========="
Write-Host "User: $userId"
Write-Host ""

# ============================================================
# 04 - CREATE PARENT GRANT
# ============================================================

Write-Host "========== 04 - PARENT GRANT =========="

$parentBody = @{
    userId           = $userId
    label            = "Master Test Parent"
    currency         = "INR"
    limit            = 5000
    window           = "WEEKLY"
    windowStart      = (Get-Date).ToUniversalTime().ToString("o")
    hardMax          = 2000
    category         = "GROCERY"
    merchantAllow    = @()
    merchantDeny     = @()
    delegationEnabled = $true
    maxDepth         = 3
    maxChildren      = 10
    evidence         = @{ sourceProtocol = "TEST"; mandateRef = "master_parent"; signedBy = "test-harness" }
}

$parentResponse = PostJson "$base/v0/grants" $parentBody

if (-not $parentResponse.__error -and $parentResponse.grant.grantId) {
    $parentId = $parentResponse.grant.grantId
    Write-Host "  Parent ID: $parentId"
    Pass "Parent grant creation (limit=5000, hardMax=2000)"
} else {
    Fail "Parent grant creation" ($parentResponse | ConvertTo-Json -Depth 5)
    Write-Host "STOPPING: cannot continue without a parent grant." -ForegroundColor Red
    exit 1
}

# ============================================================
# 05 - VALID CHILD DELEGATION
# ============================================================

Write-Host ""
Write-Host "========== 05 - VALID CHILD =========="

$childBody = @{
    userId           = $userId
    label            = "Master Test Child"
    parentGrantId    = $parentId
    currency         = "INR"
    limit            = 2000
    window           = "WEEKLY"
    windowStart      = (Get-Date).ToUniversalTime().ToString("o")
    hardMax          = 1000
    category         = "GROCERY"
    merchantAllow    = @()
    merchantDeny     = @()
    delegationEnabled = $false
    maxDepth         = 0
    maxChildren      = 0
}

$childResponse = PostJson "$base/v0/grants" $childBody

if (-not $childResponse.__error -and $childResponse.grant.grantId) {
    $childId = $childResponse.grant.grantId
    Write-Host "  Child ID: $childId"
    Pass "Valid child delegation (limit=2000 <= parent=5000)"
} else {
    Fail "Valid child delegation" ($childResponse | ConvertTo-Json -Depth 5)
    Write-Host "STOPPING: cannot continue without a child grant." -ForegroundColor Red
    exit 1
}

# ============================================================
# 06 - NO AMPLIFICATION: CHILD LIMIT > PARENT RESIDUAL
# ============================================================

Write-Host ""
Write-Host "========== 06 - NO AMPLIFICATION (limit) =========="

$overLimitBody = @{
    userId           = $userId
    label            = "Amplification Attack"
    parentGrantId    = $parentId
    currency         = "INR"
    limit            = 6000
    window           = "WEEKLY"
    windowStart      = (Get-Date).ToUniversalTime().ToString("o")
    hardMax          = 1000
    category         = "GROCERY"
    merchantAllow    = @()
    merchantDeny     = @()
    delegationEnabled = $false
    maxDepth         = 0
    maxChildren      = 0
}

$overLimit = PostJson "$base/v0/grants" $overLimitBody

if ($overLimit.__error) {
    Pass "No amplification: child limit 6000 > parent residual 5000 rejected"
} else {
    Fail "No amplification: child limit 6000 > parent residual 5000 rejected" "Server accepted the over-limit child - amplification is possible!"
}

# ============================================================
# 07 - NO AMPLIFICATION: CHILD HARD MAX > PARENT HARD MAX
# ============================================================

Write-Host ""
Write-Host "========== 07 - NO AMPLIFICATION (hardMax) =========="

$overHardMaxBody = @{
    userId           = $userId
    label            = "HardMax Attack"
    parentGrantId    = $parentId
    currency         = "INR"
    limit            = 1000
    window           = "WEEKLY"
    windowStart      = (Get-Date).ToUniversalTime().ToString("o")
    hardMax          = 3000
    category         = "GROCERY"
    merchantAllow    = @()
    merchantDeny     = @()
    delegationEnabled = $false
    maxDepth         = 0
    maxChildren      = 0
}

$overHardMax = PostJson "$base/v0/grants" $overHardMaxBody

if ($overHardMax.__error) {
    Pass "No amplification: child hardMax 3000 > parent hardMax 2000 rejected"
} else {
    Fail "No amplification: child hardMax 3000 > parent hardMax 2000 rejected" "Server accepted the over-hardMax child - per-tx amplification is possible!"
}

# ============================================================
# 08 - VALID CHILD TRANSACTION (ALLOW + RESERVED)
# ============================================================

Write-Host ""
Write-Host "========== 08 - VALID CHILD TRANSACTION =========="

$intentKey = "master-valid-$(Get-Date -Format "yyyyMMddHHmmssfff")"

$validIntentBody = @{
    userId         = $userId
    grantId        = $childId
    amount         = 500
    currency       = "INR"
    merchant       = @{ merchantId = "MASTER_MERCHANT"; name = "Master Merchant"; category = "GROCERY" }
    idempotencyKey = $intentKey
}

$validIntent = PostJson "$base/v0/intents" $validIntentBody

if (-not $validIntent.__error -and
    $validIntent.decision.decision -eq "ALLOW" -and
    $validIntent.decision.reserved -eq $true) {

    $validIntentId = $validIntent.intent.intentId
    Write-Host "  Intent: $validIntentId"
    Pass "Valid child transaction 500 INR - ALLOW + RESERVED"
} else {
    Fail "Valid child transaction 500 INR" ($validIntent | ConvertTo-Json -Depth 5)
}

# ============================================================
# 09 - CHILD CANNOT SPEND ABOVE HARD MAX
# ============================================================

Write-Host ""
Write-Host "========== 09 - CHILD ABOVE HARD MAX =========="

$tooLargeBody = @{
    userId         = $userId
    grantId        = $childId
    amount         = 3000
    currency       = "INR"
    merchant       = @{ merchantId = "MASTER_MERCHANT"; name = "Master Merchant"; category = "GROCERY" }
    idempotencyKey = "hardmax-$(Get-Date -Format "yyyyMMddHHmmssfff")"
}

$tooLarge = PostJson "$base/v0/intents" $tooLargeBody

if ($tooLarge.__error) {
    $deniedDecision = $tooLarge.response.decision
} else {
    $deniedDecision = $tooLarge.decision
}

if ($deniedDecision.decision -eq "DENY" -and $deniedDecision.reserved -eq $false) {
    Pass "Child transaction 3000 INR denied (exceeds hardMax=1000)"
} else {
    Fail "Child transaction 3000 INR denied (exceeds hardMax=1000)" "Decision: $($deniedDecision.decision), Reserved: $($deniedDecision.reserved)"
}

# ============================================================
# 10 - IDEMPOTENCY REPLAY (same key = same response)
# ============================================================

Write-Host ""
Write-Host "========== 10 - IDEMPOTENCY REPLAY =========="

$replay = PostJson "$base/v0/intents" $validIntentBody

if (-not $replay.__error -and $replay.replayed -eq $true -and
    $replay.intent.intentId -eq $validIntentId) {
    Pass "Idempotency replay returns same intent"
} else {
    Fail "Idempotency replay returns same intent" ($replay | ConvertTo-Json -Depth 5)
}

# ============================================================
# 11 - REPLAY MUST NOT DOUBLE-RESERVE (DynamoDB check)
# ============================================================

Write-Host ""
Write-Host "========== 11 - NO DOUBLE RESERVATION =========="

$childItem = GetGrant $userId $childId

if ($childItem) {
    $consumed = [decimal]$childItem.consumed.N

    if ($consumed -eq 500) {
        Pass "Replay did not double-reserve (consumed=500, not 1000)"
    } else {
        Fail "Replay did not double-reserve" "child consumed=$consumed (expected 500)"
    }
} else {
    Fail "No double reservation check" "Child grant not found in DynamoDB"
}

# ============================================================
# 12 - EXPOSURE ENDPOINT
# ============================================================

Write-Host ""
Write-Host "========== 12 - EXPOSURE ENDPOINT =========="

try {
    $exposure = Invoke-RestMethod "$base/v0/exposure"
    if ($null -ne $exposure) {
        Pass "Exposure endpoint responds"
    } else {
        Fail "Exposure endpoint responds" "Empty response"
    }
}
catch {
    Fail "Exposure endpoint responds" $_.Exception.Message
}

# ============================================================
# 13 - REVOKE PARENT
# ============================================================

Write-Host ""
Write-Host "========== 13 - REVOKE PARENT =========="

$revokeResponse = PostJson "$base/v0/grants/$parentId/revoke" @{ userId = $userId }

if (-not $revokeResponse.__error -and $revokeResponse.success -eq $true) {
    Pass "Parent grant revocation"
} else {
    Fail "Parent grant revocation" ($revokeResponse | ConvertTo-Json -Depth 5)
}

# ============================================================
# 14 - VERIFY PARENT IS REVOKED IN DYNAMODB
# ============================================================

Write-Host ""
Write-Host "========== 14 - PARENT REVOKED IN DB =========="

$parentAfter = GetGrant $userId $parentId

if ($parentAfter -and $parentAfter.status.S -eq "REVOKED") {
    Pass "Parent status = REVOKED in DynamoDB"
} else {
    Fail "Parent status = REVOKED in DynamoDB" "status=$($parentAfter.status.S)"
}

# ============================================================
# 15 - REVOCATION CLOSURE: CHILD DENIED AFTER PARENT REVOKED
# ============================================================

Write-Host ""
Write-Host "========== 15 - REVOCATION CLOSURE =========="

$closureBody = @{
    userId         = $userId
    grantId        = $childId
    amount         = 100
    currency       = "INR"
    merchant       = @{ merchantId = "MASTER_MERCHANT"; name = "Master Merchant"; category = "GROCERY" }
    idempotencyKey = "closure-$(Get-Date -Format "yyyyMMddHHmmssfff")"
}

$closureResult = PostJson "$base/v0/intents" $closureBody

if ($closureResult.__error) {
    $closureDecision = $closureResult.response.decision
} else {
    $closureDecision = $closureResult.decision
}

if ($closureDecision.decision -eq "DENY" -and $closureDecision.reserved -eq $false) {
    Pass "Revocation closure: child blocked by revoked ancestor"
    Write-Host "  Reason: $($closureDecision.reason)"
} else {
    Fail "Revocation closure: child blocked by revoked ancestor" "Decision=$($closureDecision.decision), Reserved=$($closureDecision.reserved)"
}

# ============================================================
# 16 - GRAPH PRESERVED: CHILD STILL ACTIVE IN DB
# ============================================================

Write-Host ""
Write-Host "========== 16 - GRAPH PRESERVATION =========="

$childAfter = GetGrant $userId $childId

if ($childAfter -and $childAfter.status.S -eq "ACTIVE") {
    Pass "Graph preserved: child record ACTIVE even after parent revoked"
} else {
    Fail "Graph preserved: child record ACTIVE even after parent revoked" "Child status=$($childAfter.status.S)"
}

# ============================================================
# FINAL REPORT
# ============================================================

Write-Host ""
Write-Host "============================================================"
Write-Host " FINAL RESULT"
Write-Host "============================================================"
Write-Host ""

$results | Format-Table -AutoSize

Write-Host ""
Write-Host "Passed : $passed" -ForegroundColor Green
Write-Host "Failed : $failed" -ForegroundColor Red
Write-Host "Total  : $($passed + $failed)"
Write-Host ""

if ($failed -eq 0) {
    Write-Host "============================================================"
    Write-Host " KAVACHPAY FULL VALIDATION: PASS"
    Write-Host "============================================================"
} else {
    Write-Host "============================================================"
    Write-Host " KAVACHPAY FULL VALIDATION: FAIL ($failed failures)"
    Write-Host "============================================================"
    exit 1
}
