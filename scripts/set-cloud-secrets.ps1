param([Parameter(Mandatory=$true)][string]$Project)
$ErrorActionPreference = 'Stop'
if ($Project -notmatch '^[a-z][a-z0-9-]{4,61}[a-z0-9]$') { throw 'Invalid project ID.' }
$gcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
$gcloud = if ($gcloudCommand) { $gcloudCommand.Source } else { "$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd" }
if (-not (Test-Path -LiteralPath $gcloud)) { throw 'Install the Google Cloud CLI first.' }
$selected = & $gcloud config get-value project 2>$null
if ($selected -ne $Project) { throw "Selected project does not match $Project. Select the intended project first." }
& $gcloud projects describe $Project --format='value(projectId)' --quiet
if ($LASTEXITCODE -ne 0) { throw 'Project verification failed.' }

Write-Host "Enter the five integration values for $Project. Input is masked and sent directly to Secret Manager over stdin."
Write-Host 'Do not paste values into chat, command arguments, or files.'
$names = @('ONEMAP_ACCESS_TOKEN', 'LTA_ACCOUNT_KEY', 'GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY')
foreach ($name in $names) {
    $secure = Read-Host -Prompt $name -AsSecureString
    if ($secure.Length -eq 0) { throw "Empty value for $name; no version was created." }
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $process = $null
    $bytes = $null
    try {
        $info = New-Object System.Diagnostics.ProcessStartInfo
        $info.FileName = $env:ComSpec
        $info.Arguments = '/d /s /c ""' + $gcloud + '" secrets versions add ' + $name + ' --data-file=- --project=' + $Project + ' --quiet"'
        $info.UseShellExecute = $false
        $info.CreateNoWindow = $true
        $info.RedirectStandardInput = $true
        $info.RedirectStandardOutput = $true
        $info.RedirectStandardError = $true
        $process = [System.Diagnostics.Process]::Start($info)
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        $bytes = [System.Text.Encoding]::UTF8.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
        $process.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length)
        $process.StandardInput.BaseStream.Flush()
        $process.StandardInput.Close()
        $process.WaitForExit()
        # Never print provider/CLI output from a secret-value operation.
        if ($process.ExitCode -ne 0) { throw "Could not store $name. Check authentication and Secret Manager version-add permission." }
        Write-Host "$name stored successfully."
    } finally {
        if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        $secure.Dispose()
        if ($process) { $process.Dispose() }
    }
}
Write-Host 'All five secret versions have been stored. You can close this terminal.'
