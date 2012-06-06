CSS_FILES = $(filter-out %.min.css, $(wildcard \
	style/*.css \
	style/**/*.css \
	style/*.styl \
	style/**/*.styl \
))

STYLUS_FILES = $(wildcard \
	style/*.styl \
	style/**/*.styl \
)

JS_FILES = $(filter-out %.min.js,$(wildcard \
	js/*.js \
	js/**/*.js \
))

CSS_MIN = $(wildcard \
  style/*.min.css \
  style/**/*.min.css \
)

JS_MIN = $(wildcard \
  js/*.min.js \
  js/**/*.min.js \
)

IMAGES = images
SITE = site
BUILD = build

CSS_COMPRESSOR = stylus
CSS_COMPRESSOR_FLAGS = -c

JS_COMPRESSOR = minifyjs
JS_COMPRESSOR_FLAGS = 

CSS_MINIFIED = $(CSS_FILES:.css=.min.css)
STYLUS_MINIFIED = $(STYLUS_FILES:.styl=.min.css)
JS_MINIFIED = $(JS_FILES:.js=.min.js)

all: copy-min-css copy-min-js copy-site minify

minify: minify-stylus minify-css minify-js
minify-css: $(CSS_FILES) $(CSS_MINIFIED)
minify-js: $(JS_FILES) $(JS_MINIFIED)
minify-stylus: $(STYLUS_FILES) $(STYLUS_MINIFIED)

copy-min-css:
	@echo '==> Copying existing minified CSS'
	$(foreach path, $(CSS_MIN),  \
	  test -d $(BUILD)/`dirname $(path)` || mkdir -p $(BUILD)/`dirname $(path)`; \
		cp -R $(path) $(BUILD)/$(path); \
	)

copy-min-js:
	@echo '==> Copying existing minified JS'
	$(foreach path, $(JS_MIN),  \
	  test -d $(BUILD)/`dirname $(path)` || mkdir -p $(BUILD)/`dirname $(path)`; \
		cp -R $(path) $(BUILD)/$(path); \
	)

%.min.css: %.styl
	@echo '==> Generating CSS with stylus for $<'
	@test -d $(BUILD)/`dirname $@` || mkdir -p $(BUILD)/`dirname $@`
	$(CSS_COMPRESSOR) $(CSS_COMPRESSOR_FLAGS) < $< > $(BUILD)/$@ 
	@echo

%.min.css: %.css
	@echo '==> Minifying CSS $<'
	@test -d $(BUILD)/`dirname $@` || mkdir -p $(BUILD)/`dirname $@`
	$(CSS_COMPRESSOR) $(CSS_COMPRESSOR_FLAGS) < $< > $(BUILD)/$@ 
	@echo

%.min.js: %.js
	@echo '==> Minifying javascript file $<'
	@test -d $(BUILD)/`dirname $@` || mkdir -p $(BUILD)/`dirname $@`
	$(JS_COMPRESSOR) $(JS_COMPRESSOR_FLAGS) $< > $(BUILD)/$@
	@echo

copy-site:
	@echo '==> Copying site'
	@cp -R $(wildcard $(SITE)/*) $(BUILD)
	@cp -R $(IMAGES) $(BUILD)

clean:
	rm -rf $(wildcard $(BUILD)/*)

# target: help - Displays help.
help:
	@egrep "^# target:" Makefile
