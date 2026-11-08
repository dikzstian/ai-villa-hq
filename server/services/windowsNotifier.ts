import { execFile } from 'node:child_process';

/**
 * Sends a native Windows 10/11 desktop notification (balloon/toast) via PowerShell
 * so the Head of Digital Marketing receives alerts even when the browser is minimized.
 */
export function sendWindowsDesktopNotification(title: string, message: string): void {
  if (process.platform !== 'win32') return;

  const safeTitle = title.replace(/['"`$]/g, '').slice(0, 60);
  const safeMessage = message.replace(/['"`$]/g, '').replace(/\r?\n/g, ' ').slice(0, 200);

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = [System.Drawing.SystemIcons]::Information
$notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
$notify.BalloonTipTitle = '${safeTitle}'
$notify.BalloonTipText = '${safeMessage}'
$notify.Visible = $true
$notify.ShowBalloonTip(6000)
Start-Sleep -Seconds 6
$notify.Dispose()
`.trim();

  execFile(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', psScript],
    { timeout: 10000, windowsHide: true },
    () => {
      // Ignore non-critical toast errors silently
    }
  );
}
