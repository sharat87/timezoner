dist: clean
	npx parcel build --no-source-maps --no-autoinstall index.html

clean:
	rm -rf dist

start:
	npx parcel --no-autoinstall index.html


.PHONY: dist start
