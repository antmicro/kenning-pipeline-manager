# Sample third-party server

Some front-end features can be tested with the `frontend_tester` application that acts as a third-party application in the `server-app` scenario.
It allows the user to create graph representations of basic front end use cases.

To be able to test the front end, start with building the front end in the `server-app` mode.
In the root of the project, run:

```bash
python -m pipeline_manager build server-app
```

``````{note}
If the specification requires additional assets (e.g. icons), provide them with `--assets-directory <path-to-assets>` flag, for example:

```bash
python -m pipeline_manager build server-app --assets-directory examples/sample-assets
```
``````

Now, start the {{project}} server application:

```bash
python -m pipeline_manager run --verbosity INFO
```

Once the server has started, it waits for the third-party application to connect to.
Let's run the front end tester with:

```bash
python -m pipeline_manager.frontend_tester.tester_client
```

After this, the entire testing setup should be up and running at http://127.0.0.1:5000.
From there, it is possible to add mini scenarios mocking the work of the server to check various front-end features.

The implementation of the [tester_client](https://github.com/antmicro/kenning-pipeline-manager/blob/main/pipeline_manager/frontend_tester/tester_client.py) is documented and quite straightforward.
You can also easily extend it to test other front-end (or back-end) features.
