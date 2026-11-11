# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

tested_python_versions := "3.11 3.12 3.13 3.14 3.15"

default:
	@just --list

build-frontend:
	#!/usr/bin/env bash
	cd pipeline_manager/frontend && npm install

test version="3.11": build-frontend
	#!/usr/bin/env bash
	set -euo pipefail
	uv venv --clear --python {{version}} .venv-{{version}}
	uv pip install --python .venv-{{version}}/bin/python -e ".[test,backend-communication]"
	source .venv-{{version}}/bin/activate
	python -m pytest -n 8 --retries 2
	deactivate

test-all-python-versions:
	#!/usr/bin/env bash
	set -euo pipefail
	for version in {{tested_python_versions}}; do
		just test "$version"
	done
