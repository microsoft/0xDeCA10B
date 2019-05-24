FROM node:10.15

MAINTAINER Justin Harris (justin.harris@microsoft.com)

WORKDIR /root/workspace/demo

COPY setup.sh .
COPY package.json .
COPY client/package.json client/package.json
RUN bash setup.sh
