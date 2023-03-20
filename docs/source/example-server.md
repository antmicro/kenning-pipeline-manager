# Example of third-party server

Some of the frontend features can be tested with the `frontend_tester` application that acts as a third-party application in the `server-app` scenario.
It allows the user to create basic frontend use cases in a graph representation.

To be able to test the frontend, let's start with building the frontend in `server-app` mode.
In the root of the project, run:

```bash
./build server-app
```

After this, let's start the {{project}} server application:

```bash
python -m pipeline_manager.backend.app --verbosity INFO
```

Once the server has started, it waits for the third-party application to connect to.
Let's run the frontend tester with:

```bash
python -m pipeline_manager.frontend_tester.tester_client
```

After this, the whole testing setup should be up and running on address http://127.0.0.1:5000.
From there, it is possible to add some mini scenarios mocking the work of the server to check various frontend features.

The implementation of the [tester_client](https://github.com/antmicro/kenning-pipeline-manager/blob/main/pipeline_manager/frontend_tester/tester_client.py) is documented and pretty straightforward.
It can also be easily extended to test other frontend (or backend) features.
