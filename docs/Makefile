# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

DOCS_DIR      = $(realpath $(CURDIR))
SPHINXOPTS    ?=
SPHINXBUILD   ?= sphinx-build
SOURCEDIR     = $(DOCS_DIR)/source
BUILDDIR      = $(DOCS_DIR)/build
PROJ_DIR      = $(realpath $(DOCS_DIR)/..)

.PHONY: Makefile

%:
	env BUILDDIR=$(BUILDDIR) $(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

# Catch-all target: route all unknown targets to Sphinx using the "make mode" option.
# $(O) is meant as a shortcut for $(SPHINXOPTS).
html: $(BUILDDIR)/html/static-demo
	env BUILDDIR=$(BUILDDIR) $(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

$(BUILDDIR)/html/static-demo:
	echo "Building static page for demo..."
	cd $(PROJ_DIR)
	$(DOCS_DIR)/build-examples $(PROJ_DIR)/examples $(BUILDDIR)/html/static-demo
	cd -
	echo "Building static page for demo... DONE"
