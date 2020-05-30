#!/bin/bash

# Ref: <https://download.geonames.org/export/dump/>

{

curl --silent 'https://download.geonames.org/export/dump/countryInfo.txt' \
	| grep -v '^#' \
	| cut -d $'\t' -f 1,5

echo

curl --silent 'https://download.geonames.org/export/dump/cities15000.zip' \
	| funzip \
	| awk -F '\t' '{printf($2 FS); if ($2 != $3) printf(tolower($3)); print FS $9 FS $18}'

} > "src/cities.txt"
