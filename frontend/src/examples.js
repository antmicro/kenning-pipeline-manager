export const dataflow_example = {
    "nodes": [
    	{
            "name": "PetDataset",
            "type": "Dataset",
            "description": "Pet dataset with 37 dogs and cats classes",
            "properties": [
                {
                    "name": "type",
                    "type": "select",
                    "values": ["Cats", "Dogs"]
                },
                {
                    "name": "batch_size",
                    "type": "integer",
                    "default": 1
                },
                {
                    "name": "download_dataset",
                    "type": "checkbox",
                    "default": false
                },
                {
                    "name": "classify_by",
                    "type": "select",
                    "values": ["species", "breeds"]
                },
                {
                    "name": "image_memory_layout",
                    "type": "select",
                    "default": "NHWC",
                    "values": ["NHWC", "NCHW"]
                }
            ],
            "inputs": [],
            "outputs": [
                {
                    "name": "Dataset",
                    "type": "Dataset"
                },
                {
                    "name": "Runtime",
                    "type": "Runtime"
                }
            ]
        },
        {
            "name": "MobileNetModelWrapper",
            "type": "ModelWrapper",
            "description": "MobileNetV2",
            "properties": [
                {
                    "name": "task",
                    "type": "select",
                    "default": "classification",
                    "values": ["segmentation", "classification", "detection"]
                },
                {
                    "name": "Quantization details",
                    "type": "number"
                }
            ],
            "inputs": [
                {
                    "name": "Dataset",
                    "type": "Dataset"
                }
            ],
            "outputs": [
                {
                    "name": "ModelWrapper",
                    "type": "ModelWrapper"
                }
            ]
        }
    ]
}