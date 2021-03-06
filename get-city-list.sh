#!/bin/bash

# Ref: <https://download.geonames.org/export/dump/>

{

curl --silent 'https://download.geonames.org/export/dump/countryInfo.txt' \
	| grep --invert-match '^#' \
	| cut -d $'\t' -f 1,5 \
	| sed $'s/\t//'

echo

# Columns in cities file:
# 01 geonameid         : integer id of record in geonames database
# 02 name              : name of geographical point (utf8) varchar(200)
# 03 asciiname         : name of geographical point in plain ascii characters, varchar(200)
# 04 alternatenames    : alternatenames, comma separated, ascii names automatically transliterated, convenience attribute from alternatename table, varchar(10000)
# 05 latitude          : latitude in decimal degrees (wgs84)
# 06 longitude         : longitude in decimal degrees (wgs84)
# 07 feature class     : see http://www.geonames.org/export/codes.html, char(1)
# 08 feature code      : see http://www.geonames.org/export/codes.html, varchar(10)
# 09 country code      : ISO-3166 2-letter country code, 2 characters
# 10 cc2               : alternate country codes, comma separated, ISO-3166 2-letter country code, 200 characters
# 11 admin1 code       : fipscode (subject to change to iso code), see exceptions below, see file admin1Codes.txt for display names of this code; varchar(20)
# 12 admin2 code       : code for the second administrative division, a county in the US, see file admin2Codes.txt; varchar(80)
# 13 admin3 code       : code for third level administrative division, varchar(20)
# 14 admin4 code       : code for fourth level administrative division, varchar(20)
# 15 population        : bigint (8 byte int)
# 16 elevation         : in meters, integer
# 17 dem               : digital elevation model, srtm3 or gtopo30, average elevation of 3''x3'' (ca 90mx90m) or 30''x30'' (ca 900mx900m) area in meters, integer. srtm processed by cgiar/ciat.
# 18 timezone          : the iana timezone id (see file timeZone.txt) varchar(40)
# 19 modification date : date of last modification in yyyy-MM-dd format

city_csv="$(
	curl --silent 'https://download.geonames.org/export/dump/cities15000.zip' \
		| funzip \
		| cut -d $'\t' -f 2,9,15,18 \
		| sort --numeric-sort --reverse --field-separator=$'\t' --key=3 --unique \
		| cut -d $'\t' -f 1,2,4
)"

zone_map="$(
	echo "$city_csv" | cut -d $'\t' -f3 | sort -u | awk -F $'\t' '{ print NR FS $1 }'
)"

#echo "$zone_map"
#echo

#echo "$city_csv" | while read line; do
#	prefix="$(echo "$line" | cut -d $'\t' -f 1,2)"
#	timezone="$(echo "$line" | cut -d $'\t' -f 3)"
#	number="$(echo "$zone_map" | grep -F "$timezone" | cut -d $'\t' -f 1)"
#	echo -n "$prefix"
#	echo -n $'\t'
#	echo "$number"
#done

echo "$city_csv"

} > "src/cities.txt"
