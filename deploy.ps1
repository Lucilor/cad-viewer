copy-item "F:\Lucilor\ng-cad2\src\app\cad-viewer\*" ".\src" -Force -Recurse
yarn lib && yarn dist
copy-item ".\dist\*" "D:\wwwroot\www.n.com\n\static\js\jichu" -Force -Recurse