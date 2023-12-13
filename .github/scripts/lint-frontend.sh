#!/bin/bash

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

# Runs linting job on the frontend, installing dependencies if necessary

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_DIR=$(dirname $(dirname $SCRIPT_DIR))
FRONTEND_DIR=$PROJECT_DIR/pipeline_manager/frontend

cd $FRONTEND_DIR

LINT_OUTPUT_FILENAME=$(mktemp)

trap "rm $LINT_OUTPUT_FILENAME" EXIT

npm run lint >$LINT_OUTPUT_FILENAME 2>&1

RETURN_VALUE=$?

if [ $RETURN_VALUE -eq 127 ]; then
    npm install
    npm run lint
    exit $?
else
    cat $LINT_OUTPUT_FILENAME
    exit $RETURN_VALUE
fi
