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


# Use Pipeline Manager API from frontend

Build pipeline_manager:

```bash
./build server-app
```

Run backend with a sample frontend wrapper in the background:

```bash
./run --frontend-directory pipeline_manager/frontend_tester/tester_api --relative-pm-url pipeline-manager &
```

Start any external application, e.g.:

```bash
python -m pipeline_manager.frontend_tester.tester_client
```
