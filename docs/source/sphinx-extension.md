# Sphinx extension for Pipeline Manager

Pipeline Manager provides [Sphinx](https://github.com/sphinx-doc/sphinx) extension that allows drawing graphs inside documentation.

To use it, first include `pipeline_manager` in your installed packages, with following extra dependencies:

* `docs` - optional, brings Sphinx and basic dependencies (can be skipped if Sphinx is in requirements)
* `to-image` - optional, allows converting Pipeline Manager graphs to images automatically for documentation types other than HTML (e.g. PDF)

Secondly, add `pipeline_manager.sphinxext` to `extensions` in Sphinx's `conf.py` file:

```
extensions = [
    ...,
    "pipeline_manager.sphinxext.draw_graph"
]
```

After these steps you should be able to define Pipeline Manager graph like so:

````markdown
```{pipeline_manager}
:spec: ../examples/sample-specification.json
:graph: ../examples/sample-dataflow.json
```
````

When building the docs, a static single-html `pipeline-manager.html` is created in the static directory of the docs.
Any specification or dataflow referenced by the extension will be copied to downloads subdirectory and automatically linked in the final docs.
If the docs are not built in html, images will be included in the documentation.

## Directive parameters

The `pipeline_manager` directive allows for following parameters:

* `spec` - required, points to specification that should be used for the graph.
* `graph` - optional, points to dataflow that should be used for the graph.
* `preview` - optional, if set, the graph is displayed in preview mode (read only, no HUD).
* `height` - optional, specifies height of the graph in chosen units, `px`/`%`/`em` etc. Unit has to be specified. If height was not set, aspect ratio of 3/2 will be assumed.
* `width` - optional, specifies width of the graph in chosen units, `px`/`%`/`em` etc. Unit has to be specified. If width was not set, 100% will be assumed.
* `alt` - optional, changes alternative text of the graph.

So for example this is a valid directive usage:

````markdown
```{pipeline_manager}
:spec: ../examples/specification.json
:height: 500px
:alt: This is an example of using pipeline manager in documentation
:preview:
```
````


## `draw_graph` extension documentation

### KPMNode

```{eval-rst}
.. autoclass:: pipeline_manager.sphinxext.draw_graph.KPMNode
  :members:
```

### KPMDirective

```{eval-rst}
.. autoclass:: pipeline_manager.sphinxext.draw_graph.KPMDirective
  :members:
```

```{eval-rst}
.. autofunction:: pipeline_manager.sphinxext.draw_graph.build_pipeline_manager
```
