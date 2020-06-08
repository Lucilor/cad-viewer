$commitMsg = $args[0]
git add .
git commit -m"'$commitMsg'"
git pull
git push
