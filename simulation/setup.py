from distutils.core import setup

from setuptools import find_packages

install_requires = [
    'bokeh>=0.13',
    'expiringdict>=1.1.4',
    'injector>=0.16.2',
    'joblib>=0.13.2',


    # Use a specific commit because the latest released version has a bug:
    # https://github.com/keras-team/keras/issues/12729
    # Fix: https://github.com/keras-team/keras/pull/12714
    'keras @ git+https://github.com/keras-team/keras.git@47e1b18c0b7e3ddeef4e9fcded409a55d0479a4f',
    # Used to be: 'Keras>=2.1',
    # We need ''Keras>2.2.4', but it doesn't exist yet.

    'numpy',

    # Required for saving plots.
    'selenium>=3.141.0',
    'scikit-multiflow>=0.3.0',

    'tqdm>=4.19',
]

setup(
    name='decai',
    version='0.1.0',
    packages=find_packages(),
    url='https://github.com/microsoft/0xDeCA10B',
    license='MIT',
    author="Justin Harris",
    author_email='',
    description="Simulate Decentralized & Collaborative AI.",
    install_requires=install_requires,
)
