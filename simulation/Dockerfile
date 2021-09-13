FROM continuumio/miniconda3:4.9.2

LABEL maintainer="Justin Harris (https://github.com/juharris)"
LABEL org.label-schema.vendor="Microsoft"
LABEL org.label-schema.url="https://github.com/microsoft/0xDeCA10B/tree/main/simulation"
LABEL org.label-schema.vcs-url="https://github.com/microsoft/0xDeCA10B/tree/main/simulation"

EXPOSE 5006

ENV LC_ALL C.UTF-8

RUN conda create --quiet --channel conda-forge --name decai-simulation --yes python=3.8 bokeh mkl mkl-service numpy pandas phantomjs scikit-learn scipy tensorflow

RUN conda init bash
RUN echo "conda activate decai-simulation" >> ~/.bashrc

WORKDIR /root/workspace/0xDeCA10B/simulation
COPY setup.py .

RUN conda run --name decai-simulation pip install -e .[test]

CMD ["bash"]
