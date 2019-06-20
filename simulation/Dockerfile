FROM continuumio/miniconda3:4.6.14

MAINTAINER Justin Harris (justin.harris@microsoft.com)

ENV LC_ALL C.UTF-8

RUN conda create --channel conda-forge --name decai-simulation --yes python=3.7 bokeh ipython mkl mkl-service numpy phantomjs scikit-learn scipy six tensorflow

RUN conda init

RUN conda activate decai-simulation

WORKDIR /root/workspace/0xDeCA10B/simulation
COPY setup.py .

RUN pip install -e .
