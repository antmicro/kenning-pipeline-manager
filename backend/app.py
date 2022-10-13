from flask import Flask, render_template
app = Flask(
    __name__,
    static_url_path='',
    static_folder='./frontend',
    template_folder='./frontend'
)


@app.route('/', methods=['GET'])
def index():
    """
    Default GET enpoint that returns a simple frontend html file which
    works as a single page application.
    """
    return render_template('/index.html')


@app.errorhandler(404)
def default_handler(e):
    """
    Handler that returns the same thing as the default GET endpoint.

    Because it is a single page application the routing is managed by the
    frontend side. Every requests to the backend returns the same html page and
    only then the route is handled by the browser.
    """
    return render_template('/index.html')


if __name__ == "__main__":
    # for now we have only one thread so the global state can't be corrupted
    app.run(threaded=False)
