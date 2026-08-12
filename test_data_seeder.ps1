# =============================================================================
# test_data_seeder.ps1 — Create 5 users + 70+ txs for AI fraud testing
# Requires: Backend :8080, Postgres, Kafka running
# Run: powershell -ExecutionPolicy Bypass -File .\test_data_seeder.ps1
# =============================================================================

param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$AdminEmail = "admin@primewallet.com",
    [string]$AdminPassword = "admin123"
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Token = $null
    )
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    $uri = "$BaseUrl$Path"
    $bytes = $null
    if ($null -ne $Body) {
        $json = ($Body | ConvertTo-Json -Depth 8 -Compress)
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    try {
        if ($null -ne $bytes) {
            return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -Body $bytes -TimeoutSec 60
        }
        return Invoke-RestMethod -Uri $uri -Method $Method -Headers $headers -TimeoutSec 60
    }
    catch {
        $msg = $_.Exception.Message
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $msg = $_.ErrorDetails.Message }
        throw "API $Method $Path failed: $msg"
    }
}

function New-GuidStr { [guid]::NewGuid().ToString() }

Write-Host "==> Login admin..." -ForegroundColor Cyan
$adminLogin = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body @{
    email    = $AdminEmail
    password = $AdminPassword
}
$adminToken = $adminLogin.data.accessToken
if (-not $adminToken) { throw "Missing admin accessToken" }
Write-Host "    OK" -ForegroundColor Green

$users = @(
    @{ email = "nguyen.van.a@test.com"; phone = "0911000001"; password = "Test@123"; fullName = "Nguyen Van A"; role = "normal" }
    @{ email = "tran.thi.b@test.com";   phone = "0911000002"; password = "Test@123"; fullName = "Tran Thi B";   role = "active" }
    @{ email = "le.van.c@test.com";     phone = "0911000003"; password = "Test@123"; fullName = "Le Van C";     role = "suspect" }
    @{ email = "pham.hoang.d@test.com"; phone = "0911000004"; password = "Test@123"; fullName = "Pham Hoang D"; role = "highrisk" }
    @{ email = "vo.minh.e@test.com";    phone = "0911000005"; password = "Test@123"; fullName = "Vo Minh E";    role = "newbie" }
)

$session = @{}

Write-Host "==> Register / login users..." -ForegroundColor Cyan
foreach ($u in $users) {
    $email = $u.email
    $token = $null

    try {
        $reg = Invoke-Api -Method POST -Path "/api/v1/auth/register" -Body @{
            email    = $u.email
            phone    = $u.phone
            password = $u.password
            fullName = $u.fullName
        }
        if ($reg.data.accessToken) {
            $token = $reg.data.accessToken
            Write-Host "    Registered $email (token from register)" -ForegroundColor Green
        }
        else {
            Write-Host "    Registered $email" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "    Skip register $email (may already exist)" -ForegroundColor Yellow
    }

    if (-not $token) {
        # Login rate-limit is 5/min — wait between attempts
        Start-Sleep -Seconds 13
        $login = Invoke-Api -Method POST -Path "/api/v1/auth/login" -Body @{
            email    = $u.email
            password = $u.password
        }
        $token = $login.data.accessToken
    }

    Start-Sleep -Seconds 1
    $q = [uri]::EscapeDataString($email)
    $found = Invoke-Api -Method GET -Path "/api/v1/admin/users?q=$q&size=5" -Token $adminToken
    $match = $found.data.content | Where-Object { $_.email -eq $email } | Select-Object -First 1
    if (-not $match) { throw "Admin search missed user $email" }

    if ($u.role -in @("suspect", "highrisk", "active")) {
        try {
            $null = Invoke-Api -Method PUT -Path "/api/v1/admin/users/$($match.id)/kyc" -Token $adminToken -Body @{
                kycStatus = "VERIFIED"
                note      = "Seeder auto-verify for test data"
            }
        }
        catch {
            Write-Host "    KYC warn: $($_.Exception.Message)" -ForegroundColor DarkYellow
        }
    }

    $acc = Invoke-Api -Method GET -Path "/api/v1/accounts/me" -Token $token
    $accountNumber = $acc.data.accountNumber
    if (-not $accountNumber) {
        $list = Invoke-Api -Method GET -Path "/api/v1/accounts" -Token $token
        $accountNumber = $list.data[0].accountNumber
    }

    $session[$email] = @{
        token         = $token
        userId        = $match.id
        accountNumber = $accountNumber
        role          = $u.role
        fullName      = $u.fullName
    }
    Write-Host "    $email -> $accountNumber" -ForegroundColor Green
}

function TopUp([string]$email, [decimal]$amount, [string]$desc) {
    $s = $session[$email]
    $null = Invoke-Api -Method POST -Path "/api/v1/transactions/top-up" -Token $s.token -Body @{
        idempotencyKey = (New-GuidStr)
        amount         = $amount
        description    = $desc
    }
}

function Transfer([string]$fromEmail, [string]$toEmail, [decimal]$amount, [string]$desc) {
    $from = $session[$fromEmail]
    $to = $session[$toEmail]
    $null = Invoke-Api -Method POST -Path "/api/v1/transactions/transfer" -Token $from.token -Body @{
        idempotencyKey           = (New-GuidStr)
        destinationAccountNumber = $to.accountNumber
        amount                   = $amount
        description              = $desc
    }
}

$script:txCount = 0
function Inc { $script:txCount++ }

Write-Host "==> Seed TOPUP..." -ForegroundColor Cyan
TopUp "nguyen.van.a@test.com" 5000000  "Nap tien luong"; Inc
TopUp "nguyen.van.a@test.com" 2000000  "Nap tu VietcomBank"; Inc
TopUp "tran.thi.b@test.com"   15000000 "Nap tien luong"; Inc
TopUp "tran.thi.b@test.com"   3000000  "Nap tu Techcombank"; Inc
TopUp "tran.thi.b@test.com"   1500000  "Nap tu MoMo"; Inc
TopUp "le.van.c@test.com"     80000000 "Nap tien luong"; Inc
TopUp "le.van.c@test.com"     25000000 "Nap tu VietinBank"; Inc
TopUp "pham.hoang.d@test.com" 120000000 "Nap tien dau tu"; Inc
TopUp "pham.hoang.d@test.com" 55000000  "Nap tu ngan hang"; Inc
TopUp "vo.minh.e@test.com"    1000000  "Nap lan dau"; Inc
TopUp "vo.minh.e@test.com"    500000   "Nap tu ATM"; Inc
Write-Host "    TOPUP done" -ForegroundColor Green

Write-Host "==> Seed normal TRANSFER..." -ForegroundColor Cyan
$normalDescs = @(
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 85000;  desc = "Tien an trua" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 120000; desc = "Mua shopee" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 200000; desc = "Thanh toan tien dien" },
    @{ from = "tran.thi.b@test.com"; to = "vo.minh.e@test.com"; amount = 150000; desc = "Hoc phi khoa hoc" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 75000;  desc = "Grab Food" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 350000; desc = "Mua ve xem phim" },
    @{ from = "nguyen.van.a@test.com"; to = "vo.minh.e@test.com"; amount = 50000;  desc = "Xe bus" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 450000; desc = "Kham benh" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 99000;  desc = "Netflix" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 250000; desc = "Mua do an" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 180000; desc = "Tra hoa don nuoc" },
    @{ from = "tran.thi.b@test.com"; to = "vo.minh.e@test.com"; amount = 300000; desc = "Hoc phi" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 65000;  desc = "Cafe" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 500000; desc = "Mua thuoc" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 220000; desc = "Shopee Mall" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 110000; desc = "Grab Bike" },
    @{ from = "vo.minh.e@test.com"; to = "nguyen.van.a@test.com"; amount = 30000;  desc = "Tra no cafe" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 890000; desc = "Hoc phi khoa hoc" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 175000; desc = "An toi" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 420000; desc = "Mua sach" },
    @{ from = "nguyen.van.a@test.com"; to = "vo.minh.e@test.com"; amount = 100000; desc = "Chuyen tien ban" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 260000; desc = "Thanh toan internet" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 95000;  desc = "Do an van phong" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 310000; desc = "Mua quan ao" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 140000; desc = "Xem phim CGV" },
    @{ from = "tran.thi.b@test.com"; to = "vo.minh.e@test.com"; amount = 80000;  desc = "Chuyen tien" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 55000;  desc = "Tra sua" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 700000; desc = "Hoa don dien" },
    @{ from = "nguyen.van.a@test.com"; to = "tran.thi.b@test.com"; amount = 190000; desc = "Lazada" },
    @{ from = "tran.thi.b@test.com"; to = "nguyen.van.a@test.com"; amount = 125000; desc = "Taxi" }
)

foreach ($t in $normalDescs) {
    try {
        Transfer $t.from $t.to $t.amount $t.desc
        Inc
        Start-Sleep -Milliseconds 200
    }
    catch {
        Write-Host "    WARN transfer: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}

Write-Host "==> Seed suspect (C) rapid + large..." -ForegroundColor Cyan
for ($i = 1; $i -le 8; $i++) {
    try {
        Transfer "le.van.c@test.com" "nguyen.van.a@test.com" (500000 + $i * 100000) "Chuyen nhanh #$i"
        Inc
        Start-Sleep -Milliseconds 100
    }
    catch {
        Write-Host "    WARN C rapid: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}
try {
    Transfer "le.van.c@test.com" "tran.thi.b@test.com" 15000000 "Chuyen bat thuong lon"
    Inc
}
catch {
    Write-Host "    WARN C large: $($_.Exception.Message)" -ForegroundColor DarkYellow
}

Write-Host "==> Seed high-risk (D) >50M..." -ForegroundColor Cyan
try {
    Transfer "pham.hoang.d@test.com" "le.van.c@test.com" 52000000 "Chuyen von lon ban dem"
    Inc
}
catch {
    Write-Host "    WARN D 52M: $($_.Exception.Message)" -ForegroundColor DarkYellow
}
try {
    Transfer "pham.hoang.d@test.com" "tran.thi.b@test.com" 61000000 "Rut von crypto"
    Inc
}
catch {
    Write-Host "    WARN D 61M: $($_.Exception.Message)" -ForegroundColor DarkYellow
}
for ($i = 1; $i -le 5; $i++) {
    try {
        Transfer "pham.hoang.d@test.com" "nguyen.van.a@test.com" (2000000 * $i) "Burst D #$i"
        Inc
        Start-Sleep -Milliseconds 80
    }
    catch {
        Write-Host "    WARN D burst: $($_.Exception.Message)" -ForegroundColor DarkYellow
    }
}

Write-Host "==> Patch night timestamps via Docker Postgres (optional)..." -ForegroundColor Cyan
try {
    $sql = "UPDATE transactions SET created_at = (CURRENT_DATE - INTERVAL '1 day') + TIME '03:15:00' WHERE description ILIKE '%ban dem%' OR description ILIKE '%Burst D%' OR description ILIKE '%Rut von crypto%' OR description ILIKE '%Chuyen von lon%';"
    docker exec primewallet-postgres psql -U postgres -d primewallet_db -c $sql
    Write-Host "    Night timestamps updated" -ForegroundColor Green
}
catch {
    Write-Host "    Skip timestamp patch: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host "Approx transactions created: $txCount"
Write-Host "Users:"
foreach ($u in $users) {
    $s = $session[$u.email]
    Write-Host ("  - {0} | {1} | acct {2} | role={3}" -f $u.fullName, $u.email, $s.accountNumber, $u.role)
}
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Wait for Kafka -> AI ingest"
Write-Host "  2. Admin login -> Bao cao gian lan / click user for detail modal"
Write-Host "  3. Expect le.van.c + pham.hoang.d MEDIUM/HIGH risk"
Write-Host "Password for all test users: Test@123"
