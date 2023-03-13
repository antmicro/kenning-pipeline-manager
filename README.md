# Pipeline manager

Copyright (c) 2022-2023 [Antmicro](https://www.antmicro.com>)

The aim of this project is to create a web editor for managing and visualizing processing pipelines.

## Install prerequisites

The frontend of the application requires `npm` in order to be built - use package manager to install it.
The backend of the application has a list of requirements in `requirements.txt`.
They can be installed using `pip`:

```
sudo pip install -r requirements.txt
```

## Build

To build the frontend application to work with an external application (like Kenning) run `./build server-app` in the root directory.
To build the frontend as a static application run `./build static-html` in the root directory.

## Running pipeline manager.

**NOTE**: Building application first is required.

The application can be run both as a static HTML and as a dynamic application with Flask backend.

### Static application

To run the application statically open `./pipeline_manager/frontend/dist/index.html` in a preferred browser.
Part of the functionality that requires the backend to work is disabled.
After opening the browser you can use sample specification under `./examples/sample-specification.json` to check the visualization and editing of pipelines.

### Dynamic application

To run the server application run `./run` in the root directory.
By default, server runs on `http://127.0.0.1:5000`.
In addition to using the sample specification you can also connect the third-party app (e.g. [Kenning](https://github.com/antmicro/kenning)), edit its pipeline, validate it and run it.

## Clean

To remove installed npm dependencies and built project run `./cleanup` in the root directory.
