from flask import Flask, render_template
app = Flask(
    __name__,
    static_url_path='',
    static_folder='./frontend',
    template_folder='./frontend'
)


@app.route("/")
def index():
    return render_template('/index.html')


if __name__ == "__main__":
    # for now we have only one thread so the global state can't be corrupted
    app.run(threaded=False)
