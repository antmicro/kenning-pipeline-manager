# Pipeline Manager

Copyright (c) 2022-2023 [Antmicro](https://www.antmicro.com)

Pipeline Manager is a data-based, application-agnostic web application for creating, visualizing and managing dataflows of various applications.
It does not assume any properties of the application it is working with, thanks to which fast integration with various formats is possible.

[Pipeline Manager documentation](https://antmicro.github.io/kenning-pipeline-manager/) | [Demo application](https://antmicro.github.io/kenning-pipeline-manager/static-demo)

It provides functionality for:

* visualizing and editing dataflows,
* saving and loading dataflows,
* communicating with external application to delegate advanced validation, execution of the defined graph and conversions to and from native formats of the graphs.

Pipeline Manager aims to simplify the process of developing graph-based graphical interfaces for applications that are modular and have a graph-like nature.

![Pipeline Manager](img/pipeline_manager_visualisation.png)

## Prerequisites

Pipeline Manager requires `npm`, `python` and `pip` for installing dependencies, building and (optionally) running - use package manager to install those packages.

The backend of the application has a list of requirements in the `requirements.txt` file.
They can be installed using `pip`:

```
pip install -r requirements.txt
```

All of `npm` modules needed for the frontend of the application are installed automatically during build.
They can be found in `./pipeline_manager/frontend/node_modules` directory after the application is built.

## Building and Running

Pipeline Manager can be built in two different ways as:

* static HTML application, that can be run in a browser, without any additional backend server,
* regular web application that is designated to communicate and cooperate with an external application (like [Kenning](https://github.com/antmicro/kenning)).

### Static HTML application
To build Pipeline Manager as a static HTML application run  in the root directory:

```bash
./build static-html
```

To run built application open `./pipeline_manager/frontend/dist/index.html` in a preferred browser.
As an example, if the browser of your choice is `firefox` then you should run:

```bash
firefox ./pipeline_manager/frontend/dist/index.html
```

After running Pipeline Manager you can use sample specification under `./examples/sample_specification.json` to check the visualization and editing of pipelines.
Additionaly `./examples/sample_dataflow.json` can be used to see how dataflows are stored.

It is also possible to add a default specification JSON to the generated HTML.
It just needs to be provided as the second argument of the `./build` script:

```bash
./build static-html <path-to-specification-json>
```

### Web application
To build Pipeline Manager to work with an external application (like Kenning) run in the root directory:

```bash
./build server-app
```

In this scenario, backend server is expected to serve the Pipeline Manager content.
To do that run in the root directory:

```
./run
```

By default, the backend server runs on `http://127.0.0.1:5000`.
In addition to using the sample specification you can also connect the third-party application (e.g. [Kenning](https://github.com/antmicro/kenning)), edit its pipeline, validate it and run it.

### Miscellaneous

To remove installed `npm` dependencies and built application run in the root directory:

```
./cleanup
```