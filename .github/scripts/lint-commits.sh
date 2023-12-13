#!/bin/bash

echo -e "Commits to push:\n"

git log --format=format:-------%n%B%n------- $PRE_COMMIT_FROM_REF..$PRE_COMMIT_TO_REF | cat -n

echo -e "\n\nErrors:\n"

git log --format=format:-------%n%B%n------- $PRE_COMMIT_FROM_REF..$PRE_COMMIT_TO_REF | typos -
