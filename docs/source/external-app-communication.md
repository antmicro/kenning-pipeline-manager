# Communication with an external application

The communication with an external application is based on a [JSON-RPC](https://www.jsonrpc.org/specification), BSD sockets and SocketIO.
{{project}} implements a TCP server that is listening on a specified port and waiting for the client to connect.
{{project}} frontend sends JSON-RPC requests to this server through SocketIO, which redirects messages to connected client for specific actions described in this chapter.
External application can also request actions from {{project}} in similar manner. 

## Communication protocol

The application layer protocol specifies two blocks:

* `size` - four first bytes form an unsigned integer and tell the size of the content of the message in bytes.
* `content` - the rest of the message holding additional data in JSON-RPC format described in [API Specification](#api-specification).

The `size` and `content` are stored in big-endian.

### Communication structure

By default, {{project}} in `server-app` mode will wait for an external application to connect and then request the specification.
If connection is established successfully, {{project}} frontend will check if external application is still connected every 0.5 second.
Apart from that, both {{project}} frontend and external application can send requests which pass through {{project}} backend.

```{mermaid}
:caption: Communication sequence diagram 
:alt: Communication sequence diagram
sequenceDiagram
    box Pipeline Manager
        participant Frontend
        participant Backend
    end
    box Pipeline Manager Backend Communication
        participant External App
    end
    Note over Frontend,Backend: SocketIO
    Frontend->>Backend: get_status
    Backend->>Frontend: 
    Frontend->>+Backend: external_app_connect
    Note over Backend,External App: BSD socket
    External App->>Backend: connect_socket
    Backend->>-Frontend: MessageType.OK
    Frontend->>+Backend: request_specification
    Backend->>External App: request_specification
    External App->>Backend: specification
    Backend->>-Frontend: MessageType.OK + specification
    loop Every 0.5s
        Frontend->>Backend: get_status
        Backend->>Frontend: 
    end
    par Frontend request
        Frontend->>+Backend: request
        Backend->>+External App: redirected request
        External App->>-Backend: response
        Backend->>-Frontend: redirected response
    and External App request
        External App->>+Backend: request
        Backend->>+Frontend: redirected request
        Frontend->>-Backend: response
        Backend->>-External App: redirected response
    end
```

As {{project}} part of communication is done with SocketIO, it is based on events, which are precisely defined for both sides and can trigger different actions.

Frontend listens to:

* **api** -- received messages are JSON-RPC requests, they are validated with [specification](#frontend-api), executed and generated responds are resend,
* **api-response** -- received messages are JSON-RPC responses, they are also validated and returned as result of previous request.

Backend implements the following events:

* **backend-api** -- receives all JSON-RPC requests, runs methods and responds,
* **external-api** -- redirects messages to external application through BSD socket.

On the other hand, communication between backend and external application is done through BSD socket.
To manage this, both sides run socket listener in a separate thread, which waits for messages and responds or redirects them.

Following communication structure diagram below, we have:

* blue lines describing [Backend API](backend-api) request from frontend,
* red lines describing [External App API](external-app-api) request from frontend,
* purple lines describing [Frontend API](frontend-api) request from external application.

```{mermaid}
:caption: Communication structure diagram
:alt: Communication structure diagram
C4Deployment
    Deployment_Node(pm, "Pipeline Manager", "") {
        Deployment_Node(front, "Frontend", "") {
            Deployment_Node(socketio, "SocketIO", "") {
                Container(front-socket, "SocketIO")
                Deployment_Node(front-event, "Events", "") {
                    Container(front-api, "api")
                    Container(front-response-api, "api-response")
                }
            }
        }
        Deployment_Node(back, "Backend", "") {
            Deployment_Node(flask, "Python-SocketIO events", "") {
                Container(flask-backend-api, "backend-api")
                Container(flask-external-api, "external-api")
            }
            Deployment_Node(flask-thread, "Separate thread", "") {
                Container(back-socket, "BSD socket listener")
            }
        }
    }
    Deployment_Node(pmbc, "Pipeline Manager Backend Communication", "") {
        Deployment_Node(pmbc-socket, "Socket", "") {
            Container(pmbc-socket, "BSD socket")
            Deployment_Node(pmbc-thread, "Separate thread", "") {
                Container(pmbc-listener, "BSD socket listener")
            }
        }
    }
    %% frontend to backend request
    Rel(front-socket, flask-backend-api, "JSON-RPC request")
    Rel(flask-backend-api, front-response-api, "JSON-RPC response")
    UpdateRelStyle(front-socket, flask-backend-api, $lineColor="var(--md-code-hl-keyword-color)", $textColor="var(--md-code-hl-keyword-color)", $offsetY="-15")
    UpdateRelStyle(flask-backend-api, front-response-api, $lineColor="var(--md-code-hl-keyword-color)", $textColor="var(--md-code-hl-keyword-color)", $offsetX="-50", $offsetY="55")
    %% frontent to external app request
    Rel(front-socket, flask-external-api, "JSON-RPC request")
    Rel(flask-external-api, pmbc-listener, "Redirected requests and responses")
    Rel(pmbc-listener, back-socket, "JSON-RPC response")
    Rel(back-socket, front-response-api, "Redirected response")
    UpdateRelStyle(front-socket, flask-external-api, $lineColor="var(--md-code-hl-number-color)", $textColor="var(--md-code-hl-number-color)")
    UpdateRelStyle(flask-external-api, pmbc-listener, $lineColor="var(--md-code-hl-name-color)", $textColor="var(--md-code-hl-name-color)", $offsetX="-10", $offsetY="-10")
    UpdateRelStyle(pmbc-listener, back-socket, $lineColor="var(--md-code-hl-number-color)", $textColor="var(--md-code-hl-number-color)", $offsetX="25", $offsetY="-25")
    UpdateRelStyle(back-socket, front-response-api, $lineColor="var(--md-code-hl-number-color)", $textColor="var(--md-code-hl-number-color)", $offsetX="-10", $offsetY="20")
    %% external app to frontent request
    Rel(pmbc-socket, back-socket, "JSON-RPC request")
    Rel(back-socket, front-api, "Redirected request")
    Rel(front-api, flask-external-api, "JSON-RPC response")
    Rel(pmbc-listener, pmbc-socket, "Received response")
    UpdateRelStyle(pmbc-socket, back-socket, $textColor="var(--md-code-hl-function-color)", $lineColor="var(--md-code-hl-function-color)", $offsetX="-10", $offsetY="15")
    UpdateRelStyle(back-socket, front-api, $textColor="var(--md-code-hl-function-color)", $lineColor="var(--md-code-hl-function-color)", $offsetX="45", $offsetY="-35")
    UpdateRelStyle(front-api, flask-external-api, $textColor="var(--md-code-hl-function-color)", $lineColor="var(--md-code-hl-function-color)")
    UpdateRelStyle(pmbc-listener, pmbc-socket, $textColor="var(--md-code-hl-function-color)", $lineColor="var(--md-code-hl-function-color)", $offsetX="5", $offsetY="-30")

    UpdateLayoutConfig($c4ShapeInRow="1", $c4BoundaryInRow="2")
```

(message-type)=
## Response messages types - sent by the external application

(message-type-ok)=
### OK

Message of `type` `OK` (0) is used to indicate a success and optionally includes an answer to a previous request.
Its `content` may vary depending on the request type.

(message-type-error)=
### ERROR

Message of `type` `ERROR` (1) is used to indicate a failure and optionally includes an answer to a previous request.
Its `content` may vary depending on the answered request.

(message-type-progress)=
### PROGRESS

Message of optional `type` `PROGRESS` (2) is used to inform {{project}} about the status of a running dataflow.
The `PROGRESS` message type can only be used once a message of type `RUN` is received and can be sent multiple times before sending a final response message of type either `ERROR` or `OK` that indicates the end of the run.
The progress information is conveyed in `content` using a number ranging `0 - 100` encoded in UTF-8 that signals the percentage of completion of the run.
See [RUN](#run-dataflow) for more information.

### WARNING

Message of `type` `WARNING` (3) is used to indicate a success but also alerts of a condition that might cause a problem in the future.
It optionally includes an answer to a previous request.
Its `content` may vary depending on the answered request.


## API Specification

{{api_specification}}


## Implementing a Python-based client for {{project}}

The communication described above is necessary to integrate an application with {{project}}.
The client needs to be able to read requests coming from {{project}} and send proper responses.

For applications written in Python, you can use the [pipeline-manager-backend-communication](https://github.com/antmicro/kenning-pipeline-manager-backend-communication) library.
It implements an easy-to-use interface that is able to communicate with {{project}} along with helper structures and enumerations.

The main structures provided by the `pipeline-manager-backend-communication` library are:

* `CommunicationBackend` - class that implements the functionality for receiving and sending messages.
* `MessageType` - enum used to easily distinguish message types.
* `Status` - enum that describes the current state of the client.

The following code is an example of how to receive requests and send responses to {{project}}:
As {{project}} communication is based on JSON-RPC, application should implement method that can be requested.
They are described in [Backend API](backend-api).

```python
# Class containing all implemented methods
class RPCMethods:
    def request_specification(self) -> Dict:
        # ...
        return {'type': MessageType.OK.value, 'content': specification}

    # ...
```

Defined methods have to have appropriate (matching with specification) name, input and output.

```python
    # Function name matches with the import_dataflow endpoint from External App API
    def import_dataflow(self, external_application_dataflow: Dict) -> Dict:
        # Function will receive one parameter, it's name has to be the same
        # as the one from API specification `params`
        # ...
        return {
            'type': MessageType.OK.value,
            'content': pipeline_manager_dataflow
        }

    def validate_dataflow(self, dataflow: Dict) -> Dict:
        # ...
        # Returned object has to match API specification `returns`
        return {'type': MessageType.OK.value}

    def run_dataflow(self, **kwargs: Dict) -> Dict:
        # All params can also be retreived as one dictionary
        print(kwargs['dataflow'])
        # ...
        return {'type': MessageType.OK.value}
```

Moreover, every uncaught exception will be classified as error.

```python
    def export_dataflow(self, dataflow: Dict) -> Dict:
        # ...
        raise Exception('Something went very, very bad...')
```

Therefore, the following JSON-RPC error message will be returned to frontend application.

```json
{
    "id": 1,
    "jsonrpc": "2.0",
    "error": {
        "code": -3,
        "message": "Something went very, very bad...",
        "data": {}
    }
}
```

TCP client, that connects to {{project}} using `host` and `port` parameters provided has to be created.
It has to be initialized with object containing JSON-RPC methods.
 
```python
host = '127.0.0.1'
port = 5000

# Creating a client instance with host and port specified
client = CommunicationBackend(host, port)
# Registering implemented methods and
# connecting to Pipeline Manager
client.initialize_client(RPCMethods())
```

Once the connection is established, the application can start listening for the incoming requests.
It can be done in two ways:
* listening on active thread -- client will run until the connection is closed and won't be able to send requests,
* listening on separate thread -- client will have the possibility to send and receive requests. 

```python
client.start_json_rpc_client(separate_thread=True)
```

### Sending JSON-RPC requests to {{project}}

To send request, client has to be started on separate thread (with `separate_thread=True`).
Requesting can be done in blocking and non-blocking manner.
First one waits until the response is received and returns it.

```python
response = client.request('get_status', non_blocking=False)
```

Non-blocking option returns request's ID which later can be used to retrieve response.

```python
_id = client.request('get_status', non_blocking=True)
# ...
response = client.response_for_id(_id)
```

Both methods sent [get_status](#frontend-get-status) request to frontend application and receive following response:

```json
{
    "id": 1,
    "jsonrpc": "2.0",
    "result": {
        "status": "healthy"
    }
}
```

