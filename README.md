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

To build the frontend application run `./build` in the root directory.

## Run

To run the server application run `./run` in the root directory.
Building first is required.

By default, server runs on `http://127.0.0.1:5000`.
After opening the browser with given link, you can:

* Use sample specification under `./pipeline_manager/examples/sample_specification.json` to check the visualization and editing of pipelines
* Connect the third-party app (e.g. [Kenning](https://github.com/antmicro/kenning)), edit its pipeline, validate it and run it.
