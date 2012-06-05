#!/usr/bin/env sh
JS=js
IMAGES=images
STYLE=style
SITE=site
BUILD=build

STYLE_DEPS=$(shell find $(STYLE)/ -type f -name '*.styl')
JS_DEPS=$(filter-out %.min.js, $(shell find $(JS)/ -type f -name '*.js'))

# JS files should be placed in the BUILD dir
JS_BUILD=$(addprefix $(BUILD)/, $(JS_DEPS))

all:	clean stylus minify copy-site
test:	stylus copy-js copy-site

clean:
	rm -rf "${BUILD}/*"
  
copy-js:
	cp -R "${JS}" "${BUILD}"

copy-site:
	cp -R $(wildcard $(SITE)/*) "${BUILD}"
	cp -R "${IMAGES}" "${BUILD}"

# generate CSS from stylus
stylus: ${STYLE_DEPS}
	rm -rf "${BUILD}/${STYLE}"
	cp -R "${STYLE}" "${BUILD}/${STYLE}"
	stylus "${BUILD}/${STYLE}"

# minify all JS and write back to the *original* filename
minify: ${JS_DEPS}
	rm -rf "${BUILD}/${JS}"
	cp -R "${JS}" "${BUILD}/${JS}"
	
	for J in ${JS_BUILD}; do \
		minifyjs --output "$$J" "$$J" > /dev/null; \
	done
