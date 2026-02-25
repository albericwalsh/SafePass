param(
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [string]$TargetRepo = "albericwalsh/SafePass",
    [string]$Branch = "main",
    [string]$SourceUserDocsPath = "docs/user",
    [string]$LicensePath = "LICENCE"
)

$ErrorActionPreference = "Stop"

$workspaceRoot = (Get-Location).Path
$sourceDocs = Join-Path $workspaceRoot $SourceUserDocsPath
$sourceLicense = Join-Path $workspaceRoot $LicensePath
$sourceReadme = Join-Path $sourceDocs "README.md"

if (-not (Test-Path $sourceDocs)) {
    throw "Le dossier de documentation utilisateur est introuvable: $SourceUserDocsPath"
}

if (-not (Test-Path $sourceLicense)) {
    throw "Le fichier de licence est introuvable: $LicensePath"
}

if (-not (Test-Path $sourceReadme)) {
    throw "Le README utilisateur est introuvable: $SourceUserDocsPath/README.md"
}

$tempRoot = if ($env:RUNNER_TEMP) {
    Join-Path $env:RUNNER_TEMP "safepass-public-sync"
} else {
    Join-Path $workspaceRoot ".tmp-public-sync"
}

if (Test-Path $tempRoot) {
    Remove-Item -Path $tempRoot -Recurse -Force
}

$cloneUrl = "https://x-access-token:$Token@github.com/$TargetRepo.git"
git clone --depth 1 $cloneUrl $tempRoot | Out-Null

Push-Location $tempRoot
try {
    Get-ChildItem -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force

    New-Item -ItemType Directory -Path "docs/user" -Force | Out-Null
    Copy-Item -Path $sourceLicense -Destination (Join-Path $tempRoot "LICENCE") -Force
    Copy-Item -Path (Join-Path $sourceDocs "*") -Destination (Join-Path $tempRoot "docs/user") -Recurse -Force

    $rootReadmePath = Join-Path $tempRoot "README.md"
    $rootReadmeContent = Get-Content -Path $sourceReadme -Raw
    $rootReadmeContent = $rootReadmeContent.Replace('(installation.md)', '(docs/user/installation.md)')
    $rootReadmeContent = $rootReadmeContent.Replace('(getting-started.md)', '(docs/user/getting-started.md)')
    $rootReadmeContent = $rootReadmeContent.Replace('(daily-use.md)', '(docs/user/daily-use.md)')
    $rootReadmeContent = $rootReadmeContent.Replace('(browser-extension.md)', '(docs/user/browser-extension.md)')
    $rootReadmeContent = $rootReadmeContent.Replace('(faq.md)', '(docs/user/faq.md)')
    $rootReadmeContent = $rootReadmeContent.Replace('(troubleshooting.md)', '(docs/user/troubleshooting.md)')
    Set-Content -Path $rootReadmePath -Value $rootReadmeContent -Encoding utf8

    git add -A
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Aucun changement à synchroniser vers $TargetRepo"
        exit 0
    }

    git config user.name "github-actions[bot]"
    git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
    git commit -m "chore: sync public user docs and licence"
    git push origin "HEAD:$Branch"
}
finally {
    Pop-Location
}
