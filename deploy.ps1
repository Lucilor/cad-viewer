copy-item "C:\Users\91197\Documents\ng-cad2\src\app\cad-viewer\*" ".\src" -Force -Recurse
yarn lib && yarn dist
copy-item ".\dist\*" "C:\Softwares\XAMPP\htdocs\n\static\js\jichu" -Force -Recurse