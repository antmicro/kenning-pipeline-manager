# Front-end features

## Graph manipulation

![Node palette](img/node-palette.png)

On the left side there is a node palette (which can be turned off or on using the green icon in the upper left corner).
To add a new node to the graph, click the node in the palette and drag it to the editor.
You can also select existing nodes and copy and paste them using `ctrl-c` and `ctrl-v` keyboard shortcuts.

After loading a specification, the palette will contain all the nodes defined in it and will be divided into hierarchical categories.
Additionally, a graph node named `New Graph Node` is always available under a `Graphs` category and can be used to design custom graphs.

![Node context menu](img/node-context-menu.png)

In the upper right corner of each node there is a context menu toggle. It contains the following options:
* `Rename` - Changes instanceName of the node. More details regarding node naming can be found in the ['instanceName' field of dataflow format](project:dataflow-format.md#node)
* `Delete` - Deletes the node from the dataflow. Another way of deleting nodes is to select and press the `Delete` key.
* Additional, user defined URLs. More details in the [URL specification](project:specification-format.md#url-class)

Scroll lets you to zoom in and out.
Left-clicking and dragging the editor background allows you to move around the editor area.

Left-clicking on a node allows you to select and drag the node within the editor area. Pressing the `ctrl` key while moving a node allows you to align the node with another one along some axis.

To create a connection, left-click a node's connector and connect it to a connector (of a matching type, see [Specification format](specification-format)) on another node.
Double left-click on an existing connection removes it.

## Settings

![Settings tab](img/settings-tab.png)

On the upper right corner of {{project}} window there is a gear icon toggling settings tab. In the tab following options can be found:
* `Connection style` - Switch the style of the connection between `orthogonal` and `curved`
* `AutoLayout algorithm` - Choose the algorithm for automatic node placement. Autolayout algorithm is triggered in the following situations:
  * When loading the dataflow autolayout is used to place nodes without the `position` parameter set. Dataflow load can be triggered either via external application or
  choosing the `Load graph file` option. In this case autolayout is applied to both the main graph and the nodes in the subgraphs.
  * By pressing the `Apply autolayout` button in the settings tab. In this case autolayout is applied to the entire graph.
* `Background grid size` - Sets the size of single grid cell visible in the background
* `Node movement step` - Sets the minimum step size which can be taken along each axis when moving node.
* `Center` - Pressing this buttons moves the viewport to the center of graph and sets the zoom level so that whole dataflow is visible
* `Hide layers` - [Metadata](project:specification-format.md#layer) allows to specify layers for a certain set of interface types and connections. Toggling this checkbox allows to hide
connections belonging to said layer

## Notifications

![Notifications](img/notifications.png)

{{project}} provides notifications describing errors occurring in:

* The front end, such as invalid input specification, or invalid dataflow
* The back end (see [Communication with an external application](external-app-communication))

During pipeline development or execution, notifications can display various messages to the user.

## Full screen

![Full screen button](img/fullscreen.png)

Near the settings tab, there is a full screen icon. Clicking it will expand the {{project}} window to full screen.
Note that this feature may be disabled during embedding {{project}} in an external application, make sure to allow full screen mode.

For example, in the case of embedding {{project}} in an iframe, the `allow="fullscreen"` attribute must be set:
```html
<iframe src="https://url" allow="fullscreen">
  <p>Your browser does not support iframes.</p>
</iframe>
```

## Editor menu

![Front end menu](img/frontend-menu.png)

Depending the application's mode (`static-html` or `server-app`), the following options will be available in the {{project}} menu:

* `Load specification` - lets the user load a specification file describing the nodes that can appear in the graph (see [Specification format](specification-format))
  ```{note}
  It appears only in the `static-html` build mode, where a specification is not delivered by a third-party app.
  ```
* `Load graph file` - lets the user load a graph specification in {{project}}'s internal format (see [Dataflow specification](dataflow-format)).
* `Save graph file` - Saves the graph currently stored in the editor into JSON using {{project}}'s internal format.
* `Export graph to PNG` - Saves the graph currently stored in the editor as PNG image
* `Load file` - lets the user load a file describing a graph in the native format supported by the third-party application using {{project}} for visualization.
  ```{note}
  It appears only in the `server-app` build mode, since the third-party app performs conversion from its native format to the [Dataflow format](dataflow-format)
  ```
* `Save file` - saves the current graph in a native format supported by the third-party application using {{project}} for visualization.
  ```{note}
  It appears only in the `server-app` build mode, since the third-party app performs conversion from the [Dataflow format](dataflow-format) received from the editor to its native format.
  ```

## Working with the server

When {{project}} works in the `server-app` mode, it is connected to an external application, making it possible to manipulate or execute a graph as well as save and load files in the application's native format.

![Server status](img/frontend-server-status.png)

Status of the connection is displayed in the upper right corner of the editor.
The color of the icon indicates the status of the connection with the server:

* `Red` - No connection with the server.
* `Green` - Connection with the server is established.

Extrnal application may deliver additional features by providing additional buttons in the editor menu.
More details can be found in the [Specification format](project:specification-format.md#navbar-item) section.

## URL parameters for the frontend

The frontend of Pipeline Manager provides a set of URL parameters that can be used to change the specification, graph or default behavior of the application.
Those arguments need to be encoded - we need to escape all URL-specific characters.
This can be achieved either with `urllib.parse.urlencode` in Python:

```python
import urllib.parse

urllib.parse.urlencode({
    "spec": "https://github.com/antmicro/kenning-pipeline-manager/blob/main/examples/sample-specification.json",
    "graph": "https://github.com/antmicro/kenning-pipeline-manager/blob/main/examples/sample-dataflow.json"
})

# RESULT: 'spec=https%3A%2F%2Fgithub.com%2Fantmicro%2Fkenning-pipeline-manager%2Fblob%2Fmain%2Fexamples%2Fsample-specification.json&graph=https%3A%2F%2Fgithub.com%2Fantmicro%2Fkenning-pipeline-manager%2Fblob%2Fmain%2Fexamples%2Fsample-dataflow.json'
```

or with `encodeURIComponent` in Javascript:

```javascript
encodeURIComponent("https://github.com/antmicro/kenning-pipeline-manager/blob/main/examples/sample-specification.json")

// RESULT: 'https%3A%2F%2Fgithub.com%2Fantmicro%2Fkenning-pipeline-manager%2Fblob%2Fmain%2Fexamples%2Fsample-specification.json'
```

Available parameters are as follows:

* `spec` - URL to the specification, by default it can be a HTTP/HTTPS URL.
* `graph` - URL to the graph, by default it can be a HTTP/HTTPS URL.
* `preview` - starts Pipeline Manager in read only mode, without HUD
* `include` - allows to provide includes for the specification.

When it comes to `spec` and `graph`, by default we can use following URI schemes:

* `http://`, `https://`
* `relative://` - picks a path relative to the Pipeline Manager URL

To add more URI schemes, we need to define `VUE_APP_JSON_URL_SUBSTITUTES` variable holding a dictionary mapping scheme name to appropriate template/prefix.

The JSON for URL substitutes can look as follows:

```json
{
    "examples": "https://github.com/antmicro/kenning-pipeline-manager/examples/{}"
}
```

And be later be referred to as `examples://sample-specification.json` in URL.

```{note}
The URI schemes can be passed to `pipeline_manager build` via `--json_url_specification` argument.
```

## Passing JSON objects directly

There is also a possibility to pass JSON objects directly to the frontend, without having to save them to a file and add to URL.

This can be done by sending [POST requests](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) from an external app opening Pipeline Manager, e.g:

```javascript
const iframe = document.getElementById({PipelineManagerIframe});
iframe.contentWindow.postMessage({"type": "specification", "content": data}, {PipelineManagerURL});
```

This piece of code opens Pipeline Manager in an iframe and provides it with a `data` JSON object containing the requested specification.

The following message types are supported:

* `specification`
* `dataflow`

The requested JSON object has to be included in the `content` field.


## Testing the front-end features

The best way to test the front-end features is to use the `pipeline_manager.frontend_tester.tester_client`, [Third-party server example](example-server).
