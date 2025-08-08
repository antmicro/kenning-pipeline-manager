# Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

DOCS_DIR      = $(realpath $(CURDIR))
SPHINXOPTS    ?=
SPHINXBUILD   ?= sphinx-build
SOURCEDIR     = $(DOCS_DIR)/source
BUILDDIR      = $(DOCS_DIR)/build
PROJ_DIR      = $(realpath $(DOCS_DIR)/..)
GENERATED_DIR = source/generated

.PHONY: Makefile

API_TESTER_DIR   = $(PROJ_DIR)/pipeline_manager/frontend_tester/tester_api/
API_TESTER_FILES = $(wildcard $(API_TESTER_DIR)/*.json $(API_TESTER_DIR)/*.html)
GENERATED_FILES  = $(patsubst $(API_TESTER_DIR)/%,$(GENERATED_DIR)/tester_api/%,$(API_TESTER_FILES))

$(GENERATED_DIR)/tester_api/%:
	mkdir -p $(GENERATED_DIR)/tester_api
	cp -L $(subst $(GENERATED_DIR)/tester_api,$(API_TESTER_DIR),$@) $@
	sed -i 's|/pipeline-manager|../_static/pipeline-manager.html|' $@

%: $(GENERATED_FILES)
	env BUILDDIR=$(BUILDDIR) $(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)
