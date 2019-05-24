from distutils.core import setup

from setuptools import find_packages

install_requires = [
    'bokeh>=0.13',
    'expiringdict>=1.1.4',
    'injector>0.13',
    'Keras>=2.1',
    'numpy',
    'pandas>=0.20',

    # Required for saving plots.
    'selenium>=3.141.0',

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
