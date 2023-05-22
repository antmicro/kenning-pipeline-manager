# Front-end features

## Graph manipulation

![Node menu](img/node-menu.png)

To add a new node in the editor, right-click in the editor area and select your preferred node.
You can also select existing nodes and copy and paste them using `Copy Nodes` and `Paste Nodes`.

It is possible to remove a node either by right-clicking a node and clicking `Delete` or by pressing the `Delete` key after selecting it.

Scroll lets you to zoom in and out. 
Left-clicking and dragging the editor background allows you to move around the editor area.

Left-clicking on a node lets you to select and drag the node within the editor area.

To create a connection, left-click a node's connector and connect it to a connector (of a matching type, see [Specification format](specification-format)) on another node.
To remove a connection, left-click its input connector.

## Notifications

![Notifications](img/notifications.png)

{{project}} provides notifications describing errors occuring in:

* The front end, such as invalid input specification, or invalid dataflow
* The back end (see [Communication with an external application](external-app-communication))

During pipeline development or execution, notifications can display various messages to the user.

## Loading files

![Front end menu](img/frontend-menu.png)

Depending the application's mode (`static-html` or `server-app`), the following options will be available in the {{project}} menu:

* `Load specification` - lets the user load a specification file describing the nodes that can appear in the graph (see [Specification format](specification-format))
  ```{note}
  It appears only in the `static-html` build mode, where a specification is not delivered by a third-party app.
  ```
* `Load graph file` - lets the user load a graph specification in {{project}}'s internal format (see [Dataflow specification](dataflow-format)).
* `Load file` - lets the user load a file describing a graph in the native format supported by the third-party application using {{project}} for visualization.
  ```{note}
  It appears only in the `server-app` build mode, since the third-party app performs conversion from its native format to the [Dataflow format](dataflow-format)
  ```
* `Save file` - saves the current graph in a native format supported by the third-party application using {{project}} for visualization.
  ```{note}
  It appears only in the `server-app` build mode, since the third-party app performs conversion from the [Dataflow format](dataflow-format) received from the editor to its native format.
  ```

## Working with the server

![Run and Validate](img/frontend-run-validation.png) ![Server status](img/frontend-server-status.png)

When {{project}} works in the `server-app` mode, it is connected to an external application, making it possible to run or validate a graph as well as save and load files in the application's native format.

The command executed by the `Play` icon depends on the implementation of the application - for [Kenning](https://github.com/antmicro/kenning), it either compiles and evaluates the model, or runs the Kenning Flow application.

The second icon lets the user validate a graph before running it by allowing the third-party application to run more thorough tests of the visualized pipeline.

The third icon displays the status of the third-party application (red means disconnected, green means connected).

## Testing the front-end features

The best way to test the front-end features is to use the `pipeline_manager.frontend_tester.tester_client`, [Third-party server example](example-server).