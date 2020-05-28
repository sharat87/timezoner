dist: clean
	npx parcel build --no-source-maps --no-autoinstall index.html

deploy: dist
	npx ghpages --dist dist --message "Deploy from $$(hostname)" # --user "$(git config user.name) <$(git config user.email)>"

clean:
	rm -rf dist

start:
	npx parcel --no-autoinstall index.html


.PHONY: dist start
