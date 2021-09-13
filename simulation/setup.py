from distutils.core import setup

from setuptools import find_packages

# When publishing the Docker image, a script checks for the first line with "version" and an equals sign to get the version.
version='1.0.0'

install_requires = [
    'bokeh>=0.13',
    'expiringdict>=1.1.4',
    'injector>=0.16.2',
    'joblib>=0.13.2',
    'keras>=2.3',
    'mmh3~=3.0.0',
    'numpy',

    # Required for saving plots.
    'selenium>=3.141.0',
    'scikit-multiflow>=0.3.0',
    'spacy>=2.2',

    'tqdm>=4.19',
]

test_deps = [
    'pytest',
]

setup(
    name='decai',
    version=version,
    packages=find_packages(),
    url='https://github.com/microsoft/0xDeCA10B',
    license='MIT',
    author="Justin D. Harris",
    author_email='',
    description="Simulate Decentralized & Collaborative AI for Sharing Updatable Models.",
    install_requires=install_requires,
    tests_require=test_deps,
    extras_require=dict(
        test=test_deps,
    ),
)
