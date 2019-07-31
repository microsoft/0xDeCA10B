FROM node:10.15

LABEL maintainer="Justin D. Harris (justin.harris@microsoft.com)"
LABEL org.label-schema.vendor="Microsoft"
LABEL org.label-schema.url="https://github.com/microsoft/0xDeCA10B/tree/master/demo"
LABEL org.label-schema.vcs-url="https://github.com/microsoft/0xDeCA10B/tree/master/demo"

WORKDIR /root/workspace/demo

RUN apt-get update && apt-get install --yes byobu locales locales-all

COPY setup.sh setup_libs.sh package.json yarn.lock ./
COPY client/package.json client/yarn.lock client/

RUN bash setup.sh
