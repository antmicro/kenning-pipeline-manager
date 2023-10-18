# Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
#
# SPDX-License-Identifier: Apache-2.0


import os

from flask import Flask, render_template
from flask_cors import CORS

from pipeline_manager import frontend

dist_path = os.path.join(os.path.dirname(frontend.__file__), "dist")


def create_app() -> Flask:
    """
    Creates and configures an instance of flask application that can be run
    to start the HTTP server
    """

    app = Flask(
        "Pipeline Manager",
        static_url_path="",
        static_folder=dist_path,
        template_folder=dist_path,
    )

    CORS(app)

    @app.errorhandler(404)
    def default_handler(e):
        """
        Handler that returns the same thing as the default GET endpoint.

        Because it is a single page application the routing is managed by the
        frontend side. Every requests to the backend returns the
        same html page and only then the route is handled by the browser.

        Responses
        ---------
        HTTPStatus.OK :
            The response contains entry HTML for the frontend application
        """
        return render_template("/index.html")

    @app.route("/", methods=["GET"])
    def index():
        """
        Default GET enpoint that returns a simple frontend html file which
        works as a single page application.

        Responses
        ---------
        HTTPStatus.OK :
            Request was successful and the response contains
            entry HTML for the frontend application
        """
        return render_template("/index.html")

    return app
