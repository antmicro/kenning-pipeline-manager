import base64
import argparse


def html_to_svg():
    template = """
<svg version="1.1" xmlns="http://www.w3.org/2000/svg">
    <style>
    iframe {{
        border: none;
    }}
    </style>
    <foreignObject x="0" y="0" width="100%" height="100%">
        <iframe id="app" width="100%" height="100%" xmlns="http://www.w3.org/1999/xhtml"></iframe>
        <script type="text/javascript"><![CDATA[
        let i = document.getElementById('app');
        i.contentWindow.document.open();
        i.contentWindow.document.write(atob('{}'));
        i.contentWindow.document.close();
        ]]></script>
    </foreignObject>
</svg>
"""

    if __name__ == "__main__":
        parser = argparse.ArgumentParser(description="Converter from html to svg")
        parser.add_argument(
            "build_html",
            help="Input html",
        )
        parser.add_argument("--output-path", help="Output svg", default="output.svg")

        args = parser.parse_args()

        with open(args.build_html, "br") as f:
            b = base64.b64encode(f.read())
        with open(args.output_path, "w") as f:
            f.write(template.format(b.decode()))


if __name__ == '__main__':
    html_to_svg()
