FROM node:10.15

LABEL maintainer="Justin Harris (justin.harris@microsoft.com)"
LABEL org.label-schema.vendor="Microsoft"
LABEL org.label-schema.url="https://github.com/microsoft/0xDeCA10B/tree/master/demo"
LABEL org.label-schema.vcs-url="https://github.com/microsoft/0xDeCA10B/tree/master/demo"

WORKDIR /root/workspace/demo

COPY setup.sh .
COPY package.json .
COPY client/package.json client/package.json

RUN apt-get update && apt-get install --yes byobu locales locales-all

RUN bash setup.sh
