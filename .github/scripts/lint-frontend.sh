#!/bin/bash

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

# Runs linting job on the frontend, installing dependencies if necessary

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
PROJECT_DIR=$(dirname $(dirname $SCRIPT_DIR))
FRONTEND_DIR=$PROJECT_DIR/pipeline_manager/frontend

cd $FRONTEND_DIR

npx --no-install eslint --version >/dev/null 2>&1

if [ $? -eq 1 ]; then
    npm install
fi

npm run lint
