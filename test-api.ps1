$body = @{
  email = 'test@pmav.local'
  password = 'testpass123'
  displayName = 'Test User'
} | ConvertTo-Json

$result = Invoke-RestMethod -Uri 'http://localhost:5000/api/v1/auth/register' -Method POST -ContentType 'application/json' -Body $body
$result | ConvertTo-Json -Depth 5
Write-Host ""
Write-Host "--- Login Test ---"
$loginBody = @{ email = 'test@pmav.local'; password = 'testpass123' } | ConvertTo-Json
$login = Invoke-RestMethod -Uri 'http://localhost:5000/api/v1/auth/login' -Method POST -ContentType 'application/json' -Body $loginBody
$login | ConvertTo-Json -Depth 5
$token = $login.data.accessToken
Write-Host ""
Write-Host "--- /auth/me Test ---"
$me = Invoke-RestMethod -Uri 'http://localhost:5000/api/v1/auth/me' -Headers @{Authorization="Bearer $token"}
$me | ConvertTo-Json -Depth 5
Write-Host ""
Write-Host "--- Integrations Status Test ---"
$status = Invoke-RestMethod -Uri 'http://localhost:5000/api/v1/integrations/status' -Headers @{Authorization="Bearer $token"}
$status | ConvertTo-Json -Depth 5
