Add-Type @"
using System;
using System.Runtime.InteropServices;
public class User32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
"@

$hwnd = [User32]::GetForegroundWindow()
$text = New-Object -TypeName System.Text.StringBuilder -ArgumentList 256
[User32]::GetWindowText($hwnd, $text, $text.Capacity) | Out-Null
$activeWindowTitle = $text.ToString()

$process = Get-Process | Where-Object { $_.MainWindowTitle -eq $activeWindowTitle }
$processName = $process.ProcessName
$description = $process.Description

# Attempt to match based on process name and description
$app = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | Where-Object {
    $_.DisplayName -like "*$processName*" -or $_.DisplayName -like "*$description*"
}
if ($app) {
    $app.PSChildName
} else {
    "GUID not found."
}
