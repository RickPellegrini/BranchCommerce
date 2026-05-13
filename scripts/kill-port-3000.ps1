$ids = (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique
if ($ids) {
  foreach ($id in $ids) {
    Stop-Process -Id $id -Force -ErrorAction SilentlyContinue
    Write-Host "killed $id"
  }
} else {
  Write-Host "no process on 3000"
}
