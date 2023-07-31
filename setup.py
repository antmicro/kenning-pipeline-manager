from setuptools import setup

import distutils.command.build


# Override build command
class BuildCommand(distutils.command.build.build):
    def initialize_options(self):
        distutils.command.build.build.initialize_options(self)
        self.build_base = 'build-dir'


setup(
    cmdclass={"build": BuildCommand}
)
