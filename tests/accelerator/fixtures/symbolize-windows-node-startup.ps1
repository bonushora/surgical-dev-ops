$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$nodeVersion = '24.18.0'
$nodeSha256 = '9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de'
$pdbZipSha256 = 'fe2510a54825d0a60c468fdd6bbff096cb3a5d0bca1c75188ca5d90c064fd68b'
$pdbGuid = 'C119DAF3-9A11-39A5-4C4C-44205044422E'
$probeRoot = Join-Path $env:RUNNER_TEMP ("sdo-node-symbols-" + [Guid]::NewGuid().ToString('N'))

function Assert-Sha256([string]$Target, [string]$Expected) {
  $observed = (Get-FileHash -LiteralPath $Target -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($observed -ne $Expected) {
    throw 'WINDOWS_NODE_SYMBOL_ARTIFACT_HASH_MISMATCH'
  }
}

function Resolve-LlvmTool([string]$Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -ne $command) { return $command.Source }
  $candidate = Join-Path ${env:ProgramFiles} ("LLVM\bin\" + $Name)
  if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  throw 'WINDOWS_NODE_SYMBOL_TOOL_UNAVAILABLE'
}

function Write-SymbolizedFrame(
  [string]$Label,
  [string]$RelativeAddress,
  [string]$Symbolizer,
  [string]$Executable
) {
  $output = @(& $Symbolizer "--obj=$Executable" --relative-address --inlines --demangle $RelativeAddress 2>&1)
  if ($LASTEXITCODE -ne 0) {
    throw 'WINDOWS_NODE_SYMBOLIZATION_FAILED'
  }
  $nonEmptyOutput = @($output | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
  $frameIndex = 0
  for ($index = 0; $index + 1 -lt $nonEmptyOutput.Count; $index += 2) {
    $functionName = [string]$nonEmptyOutput[$index]
    $location = [string]$nonEmptyOutput[$index + 1]
    if ($functionName -eq '??') { continue }
    $locationMatch = [regex]::Match($location, '([^\\/:]+):(\d+):(\d+)$')
    if (-not $locationMatch.Success) {
      throw 'WINDOWS_NODE_SYMBOL_LOCATION_INVALID'
    }
    $safeFunction = [regex]::Replace($functionName, '[^A-Za-z0-9_:<>~+.,() *&-]', '_')
    $safeFunction = [regex]::Replace($safeFunction, '\s+', '_')
    if ($safeFunction.Length -gt 200) { $safeFunction = $safeFunction.Substring(0, 200) }
    $sourceFile = $locationMatch.Groups[1].Value
    $line = $locationMatch.Groups[2].Value
    $column = $locationMatch.Groups[3].Value
    Write-Output "symbolizedFrame=$Label inlineIndex=$frameIndex function=$safeFunction sourceFile=$sourceFile line=$line column=$column"
    $frameIndex += 1
  }
  if ($frameIndex -eq 0) {
    throw 'WINDOWS_NODE_SYMBOLIZATION_EMPTY'
  }
}

New-Item -ItemType Directory -Path $probeRoot | Out-Null
try {
  $downloadRoot = Join-Path $probeRoot 'downloads'
  $symbolRoot = Join-Path $probeRoot 'symbols'
  $extractRoot = Join-Path $probeRoot 'pdb-extracted'
  New-Item -ItemType Directory -Path $downloadRoot, $symbolRoot, $extractRoot | Out-Null
  $downloadedNode = Join-Path $downloadRoot 'node.exe'
  $downloadedPdbZip = Join-Path $downloadRoot 'node_pdb.zip'
  Invoke-WebRequest -Uri "https://nodejs.org/dist/v$nodeVersion/win-x64/node.exe" -OutFile $downloadedNode
  Invoke-WebRequest -Uri "https://nodejs.org/dist/v$nodeVersion/win-x64/node_pdb.zip" -OutFile $downloadedPdbZip
  Assert-Sha256 $downloadedNode $nodeSha256
  Assert-Sha256 $downloadedPdbZip $pdbZipSha256
  Expand-Archive -LiteralPath $downloadedPdbZip -DestinationPath $extractRoot
  $extractedPdb = Get-ChildItem -LiteralPath $extractRoot -Filter 'node.pdb' -File -Recurse |
    Select-Object -First 1
  if ($null -eq $extractedPdb) { throw 'WINDOWS_NODE_SYMBOL_PDB_MISSING' }
  $symbolNode = Join-Path $symbolRoot 'node.exe'
  $symbolPdb = Join-Path $symbolRoot 'node.pdb'
  Copy-Item -LiteralPath $downloadedNode -Destination $symbolNode
  Copy-Item -LiteralPath $extractedPdb.FullName -Destination $symbolPdb

  $pdbUtil = Resolve-LlvmTool 'llvm-pdbutil.exe'
  $symbolizer = Resolve-LlvmTool 'llvm-symbolizer.exe'
  $summary = @(& $pdbUtil dump -summary $symbolPdb 2>&1)
  if ($LASTEXITCODE -ne 0) { throw 'WINDOWS_NODE_SYMBOL_PDB_INVALID' }
  $summaryText = $summary -join "`n"
  $escapedPdbGuid = [regex]::Escape($pdbGuid)
  if ($summaryText -notmatch $escapedPdbGuid -or
      $summaryText -notmatch '(?m)^\s*Age:\s*1\s*$') {
    throw 'WINDOWS_NODE_SYMBOL_PDB_IDENTITY_MISMATCH'
  }
  Write-Output 'symbolArtifactIdentity=PASS nodeVersion=24.18.0 architecture=x64 pdbAge=1'

  Write-SymbolizedFrame 'abort-dump-callsite' '0x1f54d84' $symbolizer $symbolNode
  Write-SymbolizedFrame 'abort-caller-callsite' '0x1f5510c' $symbolizer $symbolNode
  Write-SymbolizedFrame 'caller-parent-callsite' '0x200d221' $symbolizer $symbolNode
} finally {
  if (Test-Path -LiteralPath $probeRoot) {
    Remove-Item -LiteralPath $probeRoot -Recurse -Force
  }
}
