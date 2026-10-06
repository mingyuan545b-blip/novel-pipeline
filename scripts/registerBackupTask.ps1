# registerBackupTask.ps1 — 注册「每日 PG 备份」Windows 计划任务（当前用户，无需管理员）
#
# ⚠️ 已弃用：本机环境优先 cmd，请改用 scripts\registerBackupTask.bat。
#    （保留本文件仅为向后兼容；新流程见 docs/sop/11-数据备份与恢复.md）
#
# 注意：这是系统级改动（写入任务计划程序）。按项目约定需由用户显式执行，不做自动安装。
# 用法：
#   powershell -ExecutionPolicy Bypass -File scripts\registerBackupTask.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\registerBackupTask.ps1 -Time 04:15
# 卸载：
#   Unregister-ScheduledTask -TaskName "NovelPipeline-PG-Backup" -Confirm:$false
#
# 文件位置：scripts/registerBackupTask.ps1
param(
    [string]$Time = "03:30",
    [string]$TaskName = "NovelPipeline-PG-Backup"
)

$root = Split-Path -Parent $PSScriptRoot
$bat  = Join-Path $root "scripts\pgBackupTask.bat"

if (-not (Test-Path $bat)) { throw "找不到备份外壳脚本：$bat" }

$action  = New-ScheduledTaskAction -Execute $bat -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Daily -At $Time
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "novel-pipeline 每日 PostgreSQL 备份（保留 14 份，含 manifest 校验）" -Force | Out-Null

Write-Host "已注册计划任务：$TaskName（每日 $Time）"
Write-Host "手动验证：schtasks /Run /TN `"$TaskName`""
Write-Host "查看结果：node scripts/pgBackup.js --list"
