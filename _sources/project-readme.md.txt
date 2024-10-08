# Pipeline Manager

Copyright (c) 2022-2024 [Antmicro](https://www.antmicro.com)

Pipeline Manager is a data-based, application-agnostic web application for creating, visualizing and managing dataflows in various applications.
It does not assume any properties of the application it is working with, thanks to which fast integration with various formats is possible.

[Pipeline Manager documentation](https://antmicro.github.io/kenning-pipeline-manager/) | [Demo application](https://antmicro.github.io/kenning-pipeline-manager/static-demo/index.html?spec=relative%3A%2F%2Fgraphs%2Fsample-specification.json&amp;graph=relative%3A%2F%2Fgraphs%2Fsample-dataflow.json)

It provides functionality for:

* visualizing and editing dataflows,
* saving and loading dataflows,
* communicating with an external application to delegate advanced validation, execution of the defined graph and conversions to and from native formats of the graphs.

Pipeline Manager aims to simplify the process of developing graph-based graphical interfaces for applications that are modular and have a graph-like nature.

![Pipeline Manager](img/pipeline_manager_visualisation.png)

## Prerequisites

Pipeline Manager requires `npm` (at least 10.8.2 version is recommended, along with Node.js starting from 20.10.0), `python` and `pip` for installing dependencies, building and (optionally) running - use package manager to install those packages.

The backend of the application has a list of requirements in the `pyproject.toml` file.
They can be installed using `pip`:

```
pip install .
```

All of `npm` modules needed for the frontend of the application are installed automatically during build.
They can be found in the `./pipeline_manager/frontend/node_modules` directory after the application is built.

## Building and running

Pipeline Manager can be built in two different ways as:

* static HTML application, that can be run in a browser, without any additional backend server,
* regular web application that is designated to communicate and cooperate with an external application (like [Kenning](https://github.com/antmicro/kenning)).

### Static HTML application

To build Pipeline Manager as a static HTML application, in the root directory run:

```bash
./build static-html
```

For available flags, run:

```bash
./build static-html -h
```

To run the built application, open `./pipeline_manager/frontend/dist/index.html` in a preferred browser.
As an example, if the browser of your choice is `firefox` you should run:

```bash
firefox ./pipeline_manager/frontend/dist/index.html
```

After running Pipeline Manager you can use sample specification under `./examples/sample_specification.json` to check the visualization and editing of pipelines.
Additionally, `./examples/sample_dataflow.json` can be used to see how dataflows are stored.

The specification can be loaded in the webpage using the `Load specification` option in the main menu.
The dataflow can be loaded in the webpage using the `Load graph file` option in the main menu.

What is more, the specification and the dataflow can be provided as URL arguments:

* `spec` - should contain URL to the specification file,
* `graph` - should contain URL to the dataflow file,
* `preview` - if `true`, the graph is displayed in preview mode (read only, no HUD),
* `include` - to alter the specification from the level of URL, it is possible to provide a URL to additional includes with this field.

For example:

```bash
firefox "https://antmicro.github.io/kenning-pipeline-manager/static-demo/index.html?spec=https%3A%2F%2Fraw.githubusercontent.com%2Fantmicro%2Fkenning-pipeline-manager%2Fmain%2Fexamples%2Fsample-specification.json&graph=https%3A%2F%2Fraw.githubusercontent.com%2Fantmicro%2Fkenning-pipeline-manager%2Fmain%2Fexamples%2Fsample-dataflow.json"
```

Will fetch and use specification and dataflow from the GitHub repository for this project.
The URLs need to be encoded.

It is possible to add a default specification JSON to the generated HTML.
It just needs to be provided as the second argument of the `./build` script:

```bash
./build static-html <path-to-specification-json>
```

It is also possible to add a default dataflow that will be loaded on the start of the application, e.g.:

```bash
./build static-html <path-to-specification> <path-to-dataflow>
```

To be able to use some additional assets, like icons for nodes, run:

```bash
./build --assets-directory <path-to-assets-dir> static-html <path-to-specification> <path-to-dataflow>
```

To change the title of the editor and page, use `--editor-title` flag, e.g.:

```bash
./build --editor-title 'Graph editor' static-html <path-to-specification> <path-to-dataflow>
```

For details on how to write specification, check:

* [Pipeline Manager documentation](https://antmicro.github.io/kenning-pipeline-manager)
* [Specification format](https://antmicro.github.io/kenning-pipeline-manager/specification-format.html)
* [Dataflow format](https://antmicro.github.io/kenning-pipeline-manager/dataflow-format.html)
* [Examples in `examples/` directory](https://github.com/antmicro/kenning-pipeline-manager/tree/main/examples) - in the directory you can find sample specification files (with `-specification.json` suffix), usually paired with supported dataflow files (with `-dataflow.json` suffix)

For example, run:

```bash
./build static-html ./examples/sample-specification.json ./examples/sample-dataflow.json --output-directory ./pipeline-manager-demo
```

After successful build, run:

```bash
firefox ./pipeline-manager-demo/index.html
```

You should get a graph view similar to the one in the [documentation's demo](https://antmicro.github.io/kenning-pipeline-manager/static-demo/index.html?spec=relative%3A%2F%2Fgraphs%2Fsample-specification.json&amp;graph=relative%3A%2F%2Fgraphs%2Fsample-dataflow.json).

### Web application

To build Pipeline Manager to work with an external application (like Kenning), in the root directory run:

```bash
./build server-app
```

For available flags, check:

```bash
./build server-app -h
```

In this scenario, the backend server is expected to serve the Pipeline Manager content.
To do that, in the root directory run:

```
./run
```

By default, the backend server runs on `http://127.0.0.1:5000`.
In addition to using the sample specification you can also connect the third-party application (e.g. [Kenning](https://github.com/antmicro/kenning)), edit its pipeline, validate it and run it.

### Miscellaneous

#### Development

To run a development server which automatically recompiles the project after detecting any changes, in `./pipeline_manager/frontend` directory run:

```
npm run serve-static
```

in case of a static mode, and run:

```
npm run serve
```

in case of a regular web application mode.

#### Validation

Pipeline Manager also includes a validation tool you can use during specification and dataflow development.

To validate an existing specification, run the following in the root directory:

```
./validate <specification-path>
```

To validate an existing specification and one or more dataflows, run the following in the root directory:

```
./validate <specification-path> <dataflow-path> <dataflow-path> ...
```

Replace both `specification-path` and `dataflow-path` with the actual paths to the JSON configuration file you want to validate.
When running the validation tool for the first time, make sure to include the `--instal-dependencies` flag.

#### Cleanup

To remove the installed `npm` dependencies and the built application, run the following in the root directory:

```
./cleanup
```

### Using Pipeline Manager as a Python module

To install Pipeline Manager with `pip`, run:

```
pip install -U git+https://github.com/antmicro/kenning-pipeline-manager.git
```

To work directly with the repository, install the module with:

```
pip install -e .
```

All Pipeline Manager scripts can then be used from the command-line interface:

```
pipeline_manager
usage: pipeline_manager {build,run,validate,cleanup}
```
