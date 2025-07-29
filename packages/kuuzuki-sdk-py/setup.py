from setuptools import setup, find_packages

NAME = "kuuzuki-sdk"
VERSION = "0.1.0"
PYTHON_REQUIRES = ">=3.7"
REQUIRES = [
    "urllib3>=1.25.3",
    "python-dateutil",
    "pydantic>=2",
    "typing-extensions>=4.7.1",
]

setup(
    name=NAME,
    version=VERSION,
    description="Kuuzuki SDK for Python",
    author="Kuuzuki Community",
    author_email="support@kuuzuki.dev",
    url="https://github.com/moikas-code/kuuzuki",
    keywords=["Kuuzuki", "AI SDK", "API"],
    python_requires=PYTHON_REQUIRES,
    install_requires=REQUIRES,
    packages=find_packages(exclude=["test", "tests"]),
    include_package_data=True,
    license="MIT",
    long_description="""\
    Kuuzuki SDK for Python
    
    This library provides convenient access to the Kuuzuki REST API from Python.
    Generated from the OpenAPI specification using OpenAPI Generator.
    """
)