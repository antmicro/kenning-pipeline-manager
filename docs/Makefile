DOCS_DIR      = $(realpath $(CURDIR))
SPHINXOPTS    ?=
SPHINXBUILD   ?= sphinx-build
SOURCEDIR     = $(DOCS_DIR)/source
BUILDDIR      = $(DOCS_DIR)/build
PROJ_DIR      = $(realpath $(DOCS_DIR)/..)

.PHONY: Makefile

%:
	$(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

# Catch-all target: route all unknown targets to Sphinx using the "make mode" option.
# $(O) is meant as a shortcut for $(SPHINXOPTS).
html: $(BUILDDIR)/html/static-demo
	$(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

$(BUILDDIR)/html/static-demo:
	echo "Building static page for demo..."
	cd $(PROJ_DIR)
	mkdir -p $(BUILDDIR)/html/static-demo
	$(PROJ_DIR)/build static-html $(PROJ_DIR)/examples/sample-specification.json
	cp -r $(PROJ_DIR)/pipeline_manager/frontend/dist/* $(BUILDDIR)/html/static-demo
	cd -
	echo "Building static page for demo... DONE"
