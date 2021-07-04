set -e

if [ "${1}" == "--fix" ]; then
	is_fix="true"
	eslint . --fix --ext .js,.jsx,.ts,.tsx
	solium --dir client/src/contracts/ --fix
else
	eslint . --ext .js,.jsx,.ts,.tsx
	solium --dir client/src/contracts/ --fix-dry-run
fi

matches=`git grep --name-only '^import .* "' -- *.{js,jsx,ts,tsx}` || true
if [ "${matches}" != "" ]; then
	if [ "${is_fix}" == "true" ]; then
		# Normally I don't like double quotes in strings for machines to read
		# but I couldn't get it working with single quotes.
		sed -i -r -e "s/^(import[^\"]*)\"([^\"]*)\"/\1'\2'/g" ${matches}
	else
		>&2 echo -e "Imports should use single quotes. Check:\n${matches}"
		exit 1
	fi
fi
