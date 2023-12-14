#!/bin/bash

# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

# Runs linting on commits between FROM_REF and TO_REF

FROM_REF=${1:-$PRE_COMMIT_FROM_REF}
TO_REF=${2:-$PRE_COMMIT_TO_REF}

if [[ "$FROM_REF" == "" || "$TO_REF" == "" ]]; then
    echo "Script accepts two arguments - FROM_REF and TO_REF"
    exit 1
fi

echo -e "Commits to push:\n"

git log --format=format:-------%n%B%n------- $FROM_REF..$TO_REF | cat -n

echo -e "\n\nErrors:\n"

git log --format=format:-------%n%B%n------- $FROM_REF..$TO_REF | typos - && echo "No errors"
