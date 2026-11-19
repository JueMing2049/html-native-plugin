# hnp-scaffold / publish.ps1
# Create a GitHub repository, push the local commit, optionally enable GitHub Pages.
#
# This file is intentionally ASCII-only. PowerShell 5.1 reads .ps1 as ANSI when there is no BOM,
# so any non-ASCII byte in a comment or string can corrupt tokenization. All non-ASCII text
# (repo description and the like) travels through the UTF-8 payload JSON instead.
# ASCII-only source on purpose: the payload JSON carries any non-ASCII text and is read as UTF-8.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File publish.ps1 -Payload <path-to-json>
#
# Payload keys: dir, name, description, private (bool), pages (bool)

param(
  [Parameter(Mandatory = $true)][string]$Payload
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Fail([string]$reason) {
  Write-Output ('RESULT=fail')
  Write-Output ('REASON=' + $reason)
  exit 1
}

# git "failures" are normal branches here (no remote yet, no commit yet). Under Stop policy a
# native command writing to stderr becomes a terminating error, so route every git call through
# this wrapper and judge by exit code only. $argv excludes the "git" executable itself.
function Invoke-Git([string[]]$argv) {
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $out = & git @argv 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
  return @{ code = $code; out = (($out | Out-String).Trim()) }
}

if (-not (Test-Path -LiteralPath $Payload)) { Fail 'payload file not found' }

$json = [IO.File]::ReadAllText($Payload, [Text.Encoding]::UTF8)
$cfg = $json | ConvertFrom-Json

$dir = $cfg.dir
$name = $cfg.name
$desc = $cfg.description
$isPrivate = [bool]$cfg.private
$wantPages = [bool]$cfg.pages

if (-not (Test-Path -LiteralPath $dir)) { Fail 'target dir not found' }
if (-not (Test-Path -LiteralPath (Join-Path $dir '.git'))) { Fail 'target is not a git repo; rerun scaffold with --git' }

# --- 1. token from Windows Credential Manager, kept in memory only ---
$src = @'
using System;
using System.Runtime.InteropServices;
public class HnpCredReader {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags; public uint Type; public string TargetName; public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize; public IntPtr CredentialBlob;
    public uint Persist; public uint AttributeCount; public IntPtr Attributes;
    public string TargetAlias; public string UserName;
  }
  [DllImport("advapi32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool CredReadW(string target, uint type, uint flags, out IntPtr credential);
  [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr cred);
  public static string Get(string target) {
    IntPtr p;
    if (!CredReadW(target, 1, 0, out p)) return null;
    try {
      CREDENTIAL c = (CREDENTIAL)Marshal.PtrToStructure(p, typeof(CREDENTIAL));
      if (c.CredentialBlobSize == 0) return "";
      return Marshal.PtrToStringUni(c.CredentialBlob, (int)(c.CredentialBlobSize / 2));
    } finally { CredFree(p); }
  }
}
'@
Add-Type -TypeDefinition $src -Language CSharp

$token = [HnpCredReader]::Get('git:https://github.com')
if ([string]::IsNullOrWhiteSpace($token)) { Fail 'no github token found in credential manager (target: git:https://github.com)' }
Write-Output 'STEP=token ok'

$headers = @{
  Authorization = 'token ' + $token
  Accept = 'application/vnd.github+json'
  'User-Agent' = 'hnp-scaffold'
}

# --- 2. identify the account ---
try {
  $me = Invoke-WebRequest -Uri 'https://api.github.com/user' -Headers $headers -UseBasicParsing
} catch {
  Fail ('token rejected by github: ' + $_.Exception.Message)
}
$owner = ($me.Content | ConvertFrom-Json).login
Write-Output ('LOGIN=' + $owner)

# --- 3. existing repo: reuse only if it is still empty.
# An empty repo is what an interrupted earlier run leaves behind, so reusing it is safe and keeps
# the user from being stranded with a half-created repository. A repo with commits may be someone
# else's project: refuse, never force-push over history.
$exists = $false
try {
  $null = Invoke-WebRequest -Uri ('https://api.github.com/repos/' + $owner + '/' + $name) -Headers $headers -UseBasicParsing
  $exists = $true
} catch {
  if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404) { $exists = $false }
  else { Fail ('repo lookup failed: ' + $_.Exception.Message) }
}
if ($exists) {
  $commitCount = -1
  try {
    $commits = Invoke-WebRequest -Uri ('https://api.github.com/repos/' + $owner + '/' + $name + '/commits?per_page=1') -Headers $headers -UseBasicParsing
    $commitCount = @($commits.Content | ConvertFrom-Json).Count
  } catch {
    # 409 means "git repository is empty" on this endpoint
    if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 409) { $commitCount = 0 }
    else { Fail ('repo inspection failed: ' + $_.Exception.Message) }
  }
  if ($commitCount -gt 0) {
    Fail ('repository ' + $owner + '/' + $name + ' already exists and has commits; choose another --repo-name')
  }
  Write-Output 'REUSE=empty repo'
  $cloneUrl = 'https://github.com/' + $owner + '/' + $name + '.git'
  Write-Output ('REPO=https://github.com/' + $owner + '/' + $name)
} else {
  $body = @{
    name = $name
    description = $desc
    private = $isPrivate
    auto_init = $false
    has_issues = $true
    has_wiki = $false
  } | ConvertTo-Json
  try {
    $created = Invoke-WebRequest -Uri 'https://api.github.com/user/repos' -Method Post -Headers $headers `
      -Body ([Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json; charset=utf-8' -UseBasicParsing
  } catch {
    Fail ('create repository failed: ' + $_.Exception.Message)
  }
  $repo = $created.Content | ConvertFrom-Json
  $cloneUrl = $repo.clone_url
  Write-Output ('REPO=' + $repo.html_url)
}

# --- 5. push. token goes through env-provided git config, never into argv or .git/config ---
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('x-access-token:' + $token))

$head = Invoke-Git @('-C', $dir, 'rev-parse', '--verify', 'HEAD')
if ($head.code -ne 0) { Fail 'no commit to push; rerun scaffold with --git' }

$null = Invoke-Git @('-C', $dir, 'branch', '-M', 'main')
$remotes = Invoke-Git @('-C', $dir, 'remote')
if ($remotes.out -split "`n" | Where-Object { $_.Trim() -eq 'origin' }) {
  $null = Invoke-Git @('-C', $dir, 'remote', 'remove', 'origin')
}
$added = Invoke-Git @('-C', $dir, 'remote', 'add', 'origin', $cloneUrl)
if ($added.code -ne 0) { Fail ('add remote failed: ' + $added.out) }

$oldCount = $env:GIT_CONFIG_COUNT
$oldK = $env:GIT_CONFIG_KEY_0
$oldV = $env:GIT_CONFIG_VALUE_0
$env:GIT_CONFIG_COUNT = '1'
$env:GIT_CONFIG_KEY_0 = 'http.extraHeader'
$env:GIT_CONFIG_VALUE_0 = 'Authorization: Basic ' + $b64

try {
  $push = Invoke-Git @('-C', $dir, 'push', '-u', 'origin', 'main')
} finally {
  $env:GIT_CONFIG_COUNT = $oldCount
  $env:GIT_CONFIG_KEY_0 = $oldK
  $env:GIT_CONFIG_VALUE_0 = $oldV
}
$pushOut = $push.out -replace [regex]::Escape($b64), '<redacted>'
if ($push.code -ne 0) { Fail ('push failed: ' + $pushOut) }
Write-Output 'PUSH=ok'

# --- 6. GitHub Pages ---
if ($wantPages) {
  $pagesBody = '{"source":{"branch":"main","path":"/"}}'
  try {
    $pages = Invoke-WebRequest -Uri ('https://api.github.com/repos/' + $owner + '/' + $name + '/pages') `
      -Method Post -Headers $headers -Body ([Text.Encoding]::UTF8.GetBytes($pagesBody)) `
      -ContentType 'application/json; charset=utf-8' -UseBasicParsing
    $pagesJson = $pages.Content | ConvertFrom-Json
    Write-Output ('PAGES=' + $pagesJson.html_url)
  } catch {
    Write-Output 'PAGES=request-failed'
    Write-Output ('PAGES_REASON=' + $_.Exception.Message)
  }
}

Write-Output 'RESULT=ok'
exit 0
