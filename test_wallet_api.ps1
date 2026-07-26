$ErrorActionPreference = "Stop"

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Body = $null,
        [string]$Token = $null
    )

    $headers = @{}
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $uri = "http://localhost:8080/api/v1$Endpoint"
    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $headers
        ContentType = "application/json; charset=utf-8"
    }

    if ($Body) {
        $params.Body = $Body
    }

    try {
        $response = Invoke-RestMethod @params
        return $response
    } catch {
        Write-Host "Error calling $uri" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errBody = $reader.ReadToEnd()
            Write-Host "Response Body: $errBody" -ForegroundColor Red
        }
        throw $_
    }
}

function Generate-UUID {
    return [guid]::NewGuid().ToString()
}

Write-Host "--- TEST TOÀN BỘ API VÍ ĐIỆN TỬ ---" -ForegroundColor Cyan

# 1. Đăng ký & Đăng nhập User A
Write-Host "`n1. Đăng ký & Đăng nhập User A" -ForegroundColor Yellow
$userA_Email = "userA_$(Get-Date -Format 'yyyyMMddHHmmss')@gmail.com"
$userA_Phone = "09$((Get-Date).ToString('HHmmssff'))"
$regA = Invoke-Api -Method POST -Endpoint "/auth/register" -Body "{`"email`":`"$userA_Email`",`"phone`":`"$userA_Phone`",`"password`":`"123456`",`"fullName`":`"User A`"}"
Write-Host "Đăng ký User A thành công!" -ForegroundColor Green

$loginA = Invoke-Api -Method POST -Endpoint "/auth/login" -Body "{`"email`":`"$userA_Email`",`"password`":`"123456`"}"
$tokenA = $loginA.data.accessToken
Write-Host "Đăng nhập User A thành công!" -ForegroundColor Green

# 2. Tạo ví cho User A
Write-Host "`n2. Tạo ví cho User A" -ForegroundColor Yellow
$walletA = Invoke-Api -Method POST -Endpoint "/accounts" -Token $tokenA
$accNumA = $walletA.data.accountNumber
Write-Host "Tạo ví User A thành công! Số tài khoản: $accNumA" -ForegroundColor Green

# 3. Nạp tiền (Top Up) User A
Write-Host "`n3. Nạp tiền vào ví User A (500,000 VND)" -ForegroundColor Yellow
$topUpA = Invoke-Api -Method POST -Endpoint "/transactions/top-up" -Body "{`"idempotencyKey`":`"$(Generate-UUID)`",`"amount`":500000,`"description`":`"Nạp lương`"}" -Token $tokenA
Write-Host "Nạp tiền thành công! Giao dịch: $($topUpA.data.referenceNumber)" -ForegroundColor Green

# 4. Rút tiền (Withdraw) User A
Write-Host "`n4. Rút tiền từ ví User A (100,000 VND)" -ForegroundColor Yellow
$withdrawA = Invoke-Api -Method POST -Endpoint "/transactions/withdraw" -Body "{`"idempotencyKey`":`"$(Generate-UUID)`",`"amount`":100000,`"description`":`"Rút tiêu vặt`"}" -Token $tokenA
Write-Host "Rút tiền thành công! Giao dịch: $($withdrawA.data.referenceNumber)" -ForegroundColor Green

# 5. Đăng ký & Đăng nhập User B
Write-Host "`n5. Đăng ký & Đăng nhập User B" -ForegroundColor Yellow
$userB_Email = "userB_$(Get-Date -Format 'yyyyMMddHHmmss')@gmail.com"
$userB_Phone = "09$((Get-Date).AddSeconds(1).ToString('HHmmssff'))"
$regB = Invoke-Api -Method POST -Endpoint "/auth/register" -Body "{`"email`":`"$userB_Email`",`"phone`":`"$userB_Phone`",`"password`":`"123456`",`"fullName`":`"User B`"}"
Write-Host "Đăng ký User B thành công!" -ForegroundColor Green

$loginB = Invoke-Api -Method POST -Endpoint "/auth/login" -Body "{`"email`":`"$userB_Email`",`"password`":`"123456`"}"
$tokenB = $loginB.data.accessToken
Write-Host "Đăng nhập User B thành công!" -ForegroundColor Green

# 6. Tạo ví cho User B
Write-Host "`n6. Tạo ví cho User B" -ForegroundColor Yellow
$walletB = Invoke-Api -Method POST -Endpoint "/accounts" -Token $tokenB
$accNumB = $walletB.data.accountNumber
Write-Host "Tạo ví User B thành công! Số tài khoản: $accNumB" -ForegroundColor Green

# 7. Chuyển tiền (Transfer) từ User A -> User B
Write-Host "`n7. Chuyển tiền từ User A -> User B (200,000 VND)" -ForegroundColor Yellow
$transfer = Invoke-Api -Method POST -Endpoint "/transactions/transfer" -Body "{`"idempotencyKey`":`"$(Generate-UUID)`",`"destinationAccountNumber`":`"$accNumB`",`"amount`":200000,`"description`":`"Trích quỹ`"}" -Token $tokenA
Write-Host "Chuyển tiền thành công! Giao dịch: $($transfer.data.referenceNumber)" -ForegroundColor Green

# 8. Kiểm tra số dư cuối
Write-Host "`n8. Kiểm tra số dư cuối cùng" -ForegroundColor Yellow
$balA = Invoke-Api -Method GET -Endpoint "/accounts/me" -Token $tokenA
Write-Host "Số dư User A (Kỳ vọng: 200,000): $($balA.data.balance) VND" -ForegroundColor Green

$balB = Invoke-Api -Method GET -Endpoint "/accounts/me" -Token $tokenB
Write-Host "Số dư User B (Kỳ vọng: 200,000): $($balB.data.balance) VND" -ForegroundColor Green

# 9. Kiểm tra lịch sử giao dịch
Write-Host "`n9. Lịch sử giao dịch User A" -ForegroundColor Yellow
$histA = Invoke-Api -Method GET -Endpoint "/transactions/history/$($balA.data.id)" -Token $tokenA
$histA.data.content | Format-Table -Property referenceNumber, transactionType, amount, description, status

Write-Host "`n--- TEST HOÀN TẤT THÀNH CÔNG ---" -ForegroundColor Cyan
