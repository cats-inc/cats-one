<#
.SYNOPSIS
    Synchronizes and checks all developer workspace skills.
.DESCRIPTION
    With no parameters, syncs .agents/skills and .claude/skills plus root guidance
    and ownership, then checks the result. The workspace is the parent of this
    cats-one checkout, regardless of the caller's working directory.
    Prepare dependencies once with npm ci --include=dev in cats-one.
.PARAMETER Check
    Check both targets without writing. Exit 1 means the workspace needs a sync.
.PARAMETER WhatIf
    Preview both targets without writing or recovering interrupted work.
.PARAMETER Help
    Show usage without requiring Node.js or installed developer dependencies.
.EXAMPLE
    .\scripts\windows\Sync-WorkspaceSkills.ps1
.EXAMPLE
    .\scripts\windows\Sync-WorkspaceSkills.ps1 -WhatIf
#>
[CmdletBinding(PositionalBinding = $false)]
param(
    [switch]$Check,
    [switch]$WhatIf,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'
# Preserve the Node command's exit code even in hosts that opt into native errors.
$PSNativeCommandUseErrorActionPreference = $false

if ($Help) {
    Get-Help -Name $PSCommandPath
    exit 0
}
if ($Check -and $WhatIf) {
    [Console]::Error.WriteLine('Choose either -Check or -WhatIf.')
    exit 2
}

$ScriptsDirectory = Split-Path -Parent $PSScriptRoot
$CheckoutRoot = Split-Path -Parent $ScriptsDirectory
$WorkspaceRoot = Split-Path -Parent $CheckoutRoot
$WorkspaceCommand = Join-Path $ScriptsDirectory 'workspace.mjs'
$NodeCommand = Get-Command node -CommandType Application -ErrorAction SilentlyContinue
if (-not $NodeCommand) {
    [Console]::Error.WriteLine('Node.js 22+ is required. Install it and reopen your terminal.')
    exit 2
}

$Operation = 'sync'
if ($Check) { $Operation = 'check' }
$NodeArguments = @($WorkspaceCommand, $Operation, '--root', $WorkspaceRoot, '--agent', 'all')
if ($WhatIf) { $NodeArguments += '--dry-run' }
& $NodeCommand.Source @NodeArguments
$OperationExitCode = $LASTEXITCODE
if ($OperationExitCode -ne 0 -or $Check -or $WhatIf) {
    exit $OperationExitCode
}

& $NodeCommand.Source $WorkspaceCommand check --root $WorkspaceRoot --agent all
exit $LASTEXITCODE
