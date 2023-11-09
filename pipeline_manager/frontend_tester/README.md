# Mirror Pipeline Manager application

Build Pipeline Manager and run it.

```bash
./build server-app && ./run
```

Run Mirror Pipeline Manager, it will automatically start the second instance that will mirror changes from first the Pipeline Manager.

```bash
python -m pipeline_manager.frontend_tester.tester_mirror
```

By default application will be available at:
* [http://localhost:5000/](http://localhost:5000/) -- original Pipeline Manager
* [http://localhost:5001/](http://localhost:5001/) -- mirrored Pipeline Manager

