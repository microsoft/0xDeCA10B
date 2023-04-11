from distutils.core import setup
from setuptools import find_packages

# When publishing the Docker image, a script checks for the first line with "version" and an equals sign to get the version.
version='1.0.0'

# List of packages required by the application
install_requires = [
    'bokeh>=0.13',              # Interactive visualization library
    'expiringdict>=1.1.4',      # Dictionary with auto-expiring values
    'injector>=0.16.2',         # Dependency injection library
    'joblib>=0.13.2',           # Library for parallel processing
    'keras>=2.3',               # High-level neural networks API
    'mmh3~=3.0.0',              # MinHash function implementation
    'numpy',                    # Scientific computing library
    'selenium>=3.141.0',        # Library for browser automation
    'scikit-multiflow>=0.3.0',  # Machine learning library for streaming data
    'spacy>=2.2',               # NLP library for Python
    'tqdm>=4.19',               # Progress bar library
]

# List of packages required for running tests
test_deps = [
    'pytest',                   # Testing framework for Python
]

# Setup function to define the package metadata
setup(
    name='decai',                               # Name of the package
    version=version,                            # Version of the package
    packages=find_packages(),                   # List of packages to include
    url='https://github.com/microsoft/0xDeCA10B',# URL of the package repository
    license='MIT',                              # License type of the package
    author="Justin D. Harris",                  # Author of the package
    author_email='',                            # Author's email address
    description="Simulate Decentralized & Collaborative AI for Sharing Updatable Models.", # Description of the package
    install_requires=install_requires,          # List of packages required for the application
    tests_require=test_deps,                    # List of packages required for running tests
    extras_require=dict(                         # Optional packages for specific features
        test=test_deps,
    ),
)
