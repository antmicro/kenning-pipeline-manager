# Copyright (c) 2026 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0

"""
Provides methods for chunked communication.
"""

import asyncio
import json
from typing import Dict, Iterator, Optional, Union
from uuid import UUID, uuid4

from socketio import AsyncClient, AsyncServer

from pipeline_manager.backend.config import MAX_CHUNK_SIZE


def split_into_chunks(msg: dict, id_: Optional[UUID] = None) -> Iterator:
    """
    Splits json data into smaller chunks,
    suitable for communication.

    Chunk has a chunk_id attribute which
    is the same as id parameter and
    a chunk which holds a fragment of data.
    Final chunk has additional
    property end indicating the end
    of the communication.

    Parameters
    ----------
    msg : dict
        A json message to send through.
    id_ : Optional[UUID]
        An id for chunked communication

    Yields
    ------
    Iterator
        A message chunk to send.
    """
    if id_ is None:
        id_ = uuid4()

    data = json.dumps(msg)

    chunks = [
        data[i : i + MAX_CHUNK_SIZE]
        for i in range(0, len(data), MAX_CHUNK_SIZE)
    ]

    for chunk in chunks[:-1]:
        yield {
            "chunk_id": id_,
            "chunk": chunk,
        }

    yield {"chunk_id": id_, "chunk": chunks[-1], "end": True}


async def send_chunked(
    socket: Union[AsyncServer, AsyncClient],
    endpoint: str,
    data: Dict,
    sid: Optional[str] = None,
):
    """
    Function to send data through
    socketio in chunked manner.

    Parameters
    ----------
    socket : Union[AsyncServer, AsyncClient]
        Socket used for sending messages.
    endpoint : str
        Target endpoint to which
        message will be sent.
    data : Dict
        Message to be sent
        in form of dictionary.
    sid : Optional[str]
        Session id used by socketio.
    """
    chunk_id = str(uuid4())

    kwargs = {}

    if sid is not None:
        kwargs["to"] = sid

    to_emit = [
        socket.emit(endpoint, chunk, **kwargs)
        for chunk in split_into_chunks(data, chunk_id)
    ]

    await asyncio.gather(*to_emit)
