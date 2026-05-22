# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides global variables for communication
backend.
"""

MAX_CHUNK_SIZE = 20 * 1024

MAX_HTTP_BUFFER_SIZE = MAX_CHUNK_SIZE * 2

CHUNKED_MESSAGE_TIMEOUT = 60 * 60
