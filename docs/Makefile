# Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
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
