import json
import jsonschema2md
from importlib import resources
from typing import List, Dict

from pipeline_manager.resources import api_specification
PARSER = jsonschema2md.Parser()


def _parse_type(schema: Dict):
    """
    Function changing all `type` values from list to string.

    It is done for more consistent types in generated specification.

    Parameters
    ----------
    schema : Dict
        Specification in jsonschema format
    """
    for key, value in schema.items():
        if key == 'type' and isinstance(value, List):
            schema[key] = f"[{', '.join(value)}]"
        elif isinstance(value, Dict):
            _parse_type(value)


def generate_for_endpoints(spec: Dict, reference_prefix: str) -> List[str]:
    """
    Generate Markdown with API specification for endpoints
    from choosen service.

    Parameters
    ----------
    spec : Dict
        Sepcification with endpoints containing `params`,
        `results` and `description`

    Returns
    -------
    List[str]
        Markdown with generated specification divided into lines
    """
    results = []
    for name, schema in spec.items():
        results.append(f'({reference_prefix}-{name.replace("_", "-")})=\n')
        results.append(f'#### {name}\n\n')
        if 'description' in schema:
            results.append(schema['description'] + '\n\n')
        results.extend(PARSER._parse_object(schema['params'], 'params'))
        if 'returns' in schema and schema['returns']:
            results.extend(PARSER._parse_object(schema['returns'], 'result'))

    return results


def generate_schema_md() -> str:
    """
    Generate API specification in Markdown format,
    based on definition from jsonSchema file.

    Returns
    -------
    str
        Markdown with API specification
    """
    results: List[str] = []
    spec_path = resources.files(api_specification) / 'specification.json'
    with open(spec_path, 'r') as fd:
        specification = json.load(fd)
    _parse_type(specification)
    for ref, header, content in (
        ('(frontend-api)=\n', '### Frontend API\n\n',
         generate_for_endpoints(
            specification['frontend_endpoints'], 'frontend')),
        ('(backend-api)=\n', '### Backend API\n\n',
         generate_for_endpoints(
            specification['backend_endpoints'], 'bakend')),
        ('(external-app-api)=\n', '### External App API\n\n',
         generate_for_endpoints(
            specification['external_endpoints'], 'external')),
    ):
        results.append(ref)
        results.append(header)
        results.extend(content)

    types_path = resources.files(api_specification) / 'common_types.json'
    with open(types_path, 'r') as fd:
        common_types = json.load(fd)
    _parse_type(common_types)
    results.append('(api-common-types)=\n')
    results.append('### Common Types\n\n')
    for name, definition in common_types['$defs'].items():
        results.append(f'(mmon_types#/$defs/{name})=\n\n')
        results.append(f'#### {name}\n\n')
        results.extend(PARSER._parse_object(definition, None))

    return ''.join([
        result.replace(':', '', 1) if result.lstrip().startswith('- :')
        else result for result in results
    ])
