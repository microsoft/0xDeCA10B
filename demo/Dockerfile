FROM node:10.17

LABEL maintainer="Justin D. Harris (https://github.com/juharris)"
LABEL org.label-schema.vendor="Microsoft"
LABEL org.label-schema.url="https://github.com/microsoft/0xDeCA10B/tree/main/demo"
LABEL org.label-schema.vcs-url="https://github.com/microsoft/0xDeCA10B/tree/main/demo"

WORKDIR /root/workspace/demo

RUN apt-get update && apt-get install --yes byobu locales locales-all

COPY setup.sh setup_libs.sh package.json yarn.lock ./
COPY client/package.json client/yarn.lock client/

# Avoid issues with pull Git repos during the build.
RUN git config --global url."https://".insteadOf git://

RUN bash setup.sh
