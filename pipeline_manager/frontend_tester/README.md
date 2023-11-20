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

