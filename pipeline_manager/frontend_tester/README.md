# Mirror Pipeline Manager application

Build Pipeline Manager.

```bash
./build server-app
```

Run Mirror Pipeline Manager, it will automatically start both instances and wait until they are open in the browser. Then external application will be started that mirrors changes from the first Pipeline Manager.

```bash
python -m pipeline_manager.frontend_tester.tester_mirror
```

By default application will be available at:
* [http://localhost:5000/](http://localhost:5000/) -- original Pipeline Manager
* [http://localhost:5001/](http://localhost:5001/) -- mirrored Pipeline Manager


# Use Pipeline Manager API from the frontend level

It is possible to deliver and receive JSON RPC requests using [postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage), as described in [Making API requests](https://antmicro.github.io/kenning-pipeline-manager/frontend-features.html#making-api-requests).
An example of such use case is provided in the [frontend API tester](./tester_api/index.html).

To run this example, build Pipeline Manager and save it in `pipeline_manager/frontend_tester/tester_api/pipeline-manager`, e.g.:

```bash
./build static-html examples/sample-specification.json ./examples/sample-dataflow.json --output-directory pipeline_manager/frontend_tester/tester_api/pipeline-manager
```

Go to `pipeline_manager/frontend_tester/tester_api` and run any HTTP server, e.g.:

```bash
cd pipeline_manager/frontend_tester/tester_api
python3 -m http.server
```

In the end, open URL with hosted API tester.

In there, Pipeline Manager is included as an iframe, followed by request and response fields with following actions:

* `Get graph` - gets current graph from the view
* `Set specification` - sets specification to one defined in the request text field
* `Set graph` - sets graph to one defined in the request text field
* `Handle provided request` - allows to pass arbitrary JSON RPC request, e.g. `{"method": "terminal_write", "params": {"name": "Custom terminal", "message": "Hello world"}}`

**NOTE**: For backend API to work, the server needs to be built with `server-app` mode and a backend application needs to run.

For frontend-only use cases, the [Frontend API requests](https://antmicro.github.io/kenning-pipeline-manager/external-app-communication.html#frontend-api) can be tested.
