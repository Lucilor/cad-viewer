$commitMsg = $args[0]
if ($commitMsg -eq $null) {
    Write-Host 'error: missing commit message'
    exit
}
git add .
git status
$decision = $Host.UI.PromptForChoice('', 'Continue?', @('&Yes', '&No'), 0)
if ($decision -eq 0) {
    git commit -m"$commitMsg"
    git pull
    git push
}
