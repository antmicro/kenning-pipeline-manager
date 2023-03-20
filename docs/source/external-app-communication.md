# Communication with an external application

The communication with an external application is based on a TCP protocol and BSD sockets.
{{project}} implements a TCP server that is listening on a specifed port and waiting for the client to connect.
{{project}} sends requests to the connected client for specific actions described in this chapter.

```{note}
The client should not send any messages to the server without getting a request message first.
```

## Communication protocol

The application layer protocol specifies three blocks:

* `size` - four first bytes form an unsigned integer and tell the size of the content of the message in bytes.
* `type` - two following bytes, which are also an unsinged integer describing the type of the message.
* `content` - the rest of the message holding additional, `type`-specific data.

The `size` and `type` are stored in big-endian.

![Protocol diagram](img/PMProtocol.png)

## Message types

### Response messages - sent by the external application

#### 0 - OK

Message of `type` OK is used to indicate a success and optionally includes an answer to a previous request.
Its `content` may vary depending on the request type.

#### 1 - ERROR

Message of `type` ERROR is used to indicate a failure and optionally includes an answer to a previous request.
Its `content` may vary depending on the answered request.

### Request messages - sent by {{project}}

#### 2 - VALIDATE

Message of `type` `VALIDATE` requests validating dataflow that is in the `content`.
This request expects a return message of `type` `OK` if the validation was successful or `ERROR` otherwise.
Optionally, a feedback message can be put in the `content` encoded in UTF-8.
The feedback will be displayed to the user.

#### 3 - SPECIFICATION

Message of `type` `SPECIFICATION` requests sending back to the {{project}} specification that is in format defined in [Specification format](specification-format).
Specification sent is used to create a new environment in the editor.
This request expects a return messages of `type` `OK` if a specification is sent or `ERROR` otherwise.
If the return message is of `type` `OK` then it must have a specification of nodes encoded in UTF-8 in the `content`.
If the return message is of `type` `ERROR` then it can optionally have a feedback message in the `content`.

#### 4 - RUN

Message of `type` `RUN` requests running a dataflow that is in the `content`.
The executed method depends on the implementation on the client side.
This request expects a return messages of `type` `OK` if the run was successful or `ERROR` otherwise.
Optionally, a feedback message can be put in the `content` encoded in UTF-8.
The feedback will be displayed to the user.

#### 5 - IMPORT

Message of `type` `IMPORT` requests parsing a graph that is in the `content` into a {{project}} format that can be loaded by the editor.
The format of the loaded graph depends on the client application.
The client should parse the graph structure in supported format and convert it to [Dataflow format](dataflow-format).

This request expects a return messages of `type` `OK` if the parsing was successful or `ERROR` otherwise.
If the request was successful, the parsed dataflow should be sent within `content`.

#### 6 - EXPORT

Message of `type` `EXPORT` requests saving the current dataflow in the editor to the filesystem in a format supported by the client application.

In the `content` of the `EXPORT` message, there is a dataflow specification in UTF-8 encoding.
It is in format specified in [Dataflow format](dataflow-format).

This request expects a return message of `type` `OK` if the saving process was successful or `ERROR` otherwise.
Optionally a feedback message can be put in the `content` encoded in UTF-8.
The feedback will be displayed to the user.

## Implementing a python-based client for {{project}}

To integrate an application with {{project}} it needs to implement the communication described above.
The client has to be able to read requests coming from {{project}} and send proper responses.

If the application is written in Python, it can use [kenning-pipeline-manager-backend-communication](https://github.com/antmicro/kenning-pipeline-manager-backend-communication) library.
It implements a simple to use interface that is able to communicate with {{project}} along with helper structures and enumerations.

Main structures that are provided by the `pipeline-manager-backend-communication` library are:

* `CommunicationBackend` - class that implements functionality to receive and send messages.
* `MessageType` - enum that is used to easily distinguish message types.
* `Status` - enum that describes current state of the client.

The following code is an example of how to receive requests and send responses to {{project}}.

```python
host = '127.0.0.1'
port = 5000

# Creating a client instance with host and port specified
client = CommunicationBackend(host, port)
# Connecting to Pipeline Manager
client.initialize_client()
```

First, a TCP client, that connects to {{project}} using `host` and `port` parameters provided has to be created.

```python
while True:
    # Receiving a message from Pipeline Manager
    status, message = client.wait_for_message()

    # Checking whether the message is ready to be read
    if status == Status.DATA_READY:
        # Receiving a message from Pipeline Manager
        message_type, data = message
```

Once the connection is established, the application can start listening for the incoming requests.
Function `wait_for_message()` blocks indefinitely until some data is read from the socket.
It returns a tuple that consists of the `status` of the client and the `message` read.
If the `status` equals `DATA_READY`, a full message was successfully parsed and read.
As described in the [Communication protocol](#communication-protocol) section, a `message` includes a `message_type` and the `data` sent (named there `content`).

{ emphasize-lines="23-33" }
```python
from kenning_pipeline_manager_backend_communication.communication_backend import \
    CommunicationBackend
from kenning_pipeline_manager_backend_communication.misc_structures import \
    MessageType, Status

host = '127.0.0.1'
port = 5000

client = CommunicationBackend(host, port)
client.initialize_client()

while True:
   status, message = client.wait_for_message()

   if status == Status.DATA_READY:
       message_type, data = message

       if message_type == MessageType.SPECIFICATION:
           client.send_message(
               MessageType.OK,
               create_and_encode_specification()
           )
       elif message_type == MessageType.VALIDATE:
            if validation_successful(data):
                client.send_message(
                    MessageType.OK,
                    'Successfully validated'.encode()
                )
            else:
                client.send_message(
                    MessageType.ERROR,
                    'Something went very, very bad...'.encode()
                )
```

The remaining part of the implemenation is sending an appropriate responses based on the [message type](#message-types) of the request.

`MessageType` enum provides all available message types.
In the highlighted part of the code, it is checked whether a validation request was sent.

```{note}
`validation_successful` is just a demonstration method, it needs to be replaced with the actual validation function for the project.
```

The `data` contains the dataflow that has to be validated according to the documentation.
A response message of type `OK` or `ERROR` can be sent to the {{project}} using a `send_message` function with an additional textual message that is be displayed to the user.
