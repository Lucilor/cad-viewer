copy-item "C:\Users\91197\Documents\ng-cad2\src\app\cad-viewer\*" ".\src" -Force -Recurse
Write-Host -NoNewLine 'Press any key to continue...';
$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown');
yarn lib && yarn dist
remove-item ".\dist\*.LICENSE.*"
copy-item ".\dist\*" "C:\Softwares\XAMPP\htdocs\n\static\js\jichu" -Force -Recurse