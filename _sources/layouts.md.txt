# Layouts

In Pipeline Manager it is possible to export active graph layout, without overhead in form of node definitions and metadata.
It stores basic information about nodes position, style and underlying interfaces states.

## Format description

The layout is stored in JSON file, which consists of entries like:

``` json
"<node-id>": {
        "position": {
            "x": 100,
            "y": -100
        },
        "style": "basic",
        "interfaces": {
            "<interface-name>": {
                "side": "right",
                "sidePosition": 0
            }
        }
    },
```

* `node-id` - id of node to which layout's data will be applied to id, it is in `UUIDv4` format
* `position` - it defines position of the node in the graph, defined in 2D `x` and `y` coordinates
* `style` - it is a name of the style that will be applied to a node. Multiple styles can be provided using array. More about node's [styles](./specification-format.md#node-style)
* `interfaces` - it is an entry defining states for node's interfaces
    * `interface-name` - a name of the interface that state will be applied to
    * `side` - a side of the interface
    * `sidePosition` - a position of the interface

## Layout saving and loading

It is possible to save and load the layout of graph.
After graph is selected in editor you can use `Save layout` or `Save layout as file as...` to save current graph to file, then you can load it using `Load layout` option in editor menu.

## Layout and views

Layouts are compatible with views and it is possible to save and load layout into selected view.
All it is necessary is just to select desired view in settings and then use `Save layout` and `Load layout` options.

## Example layout

Part of the layout exported from `sample-specification` and `sample-dataflow` example.

```json
{
    "f50b4f2a-a2e2-4409-a5c9-891a8de44a5b": {
        "position": {
            "x": 100,
            "y": -100
        },
        "interfaces": {
            "frames": {
                "side": "right",
                "sidePosition": 0
            }
        }
    },
    "3f16d8b0-8bf4-411c-9b61-286fde9035be": {
        "position": {
            "x": 100,
            "y": 200
        },
        "interfaces": {
            "kernel": {
                "side": "right",
                "sidePosition": 0
            }
        }
    },
    "75800d41-a534-4dae-9133-2fabb0c98e31": {
        "position": {
            "x": 600,
            "y": 0
        },
        "interfaces": {
            "kernel": {
                "side": "left",
                "sidePosition": 1
            },
            "input 1": {
                "side": "left",
                "sidePosition": 0
            },
            "output 1": {
                "side": "right",
                "sidePosition": 0
            }
        }
    }
}
```