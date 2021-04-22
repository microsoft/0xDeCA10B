# For deployment to an Azure Web Service
# First get permission to push 0xdeca10bcontainerreg.azurecr.io, then:
# docker login 0xdeca10bcontainerreg.azurecr.io
# docker build --file service.Dockerfile -t 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo-prod .
# docker push 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo-prod:latest
# The deployment is set up to happen automatically in Azure.

# When NODE_ENV='production'
# Set BACK_END_URL in your environment to the address for the back end service.

FROM appsvc/node:10-lts

LABEL maintainer="Justin D. Harris (Microsoft)"
LABEL org.label-schema.vendor="Microsoft"
LABEL org.label-schema.url="https://github.com/microsoft/0xDeCA10B/tree/main/demo"
LABEL org.label-schema.vcs-url="https://github.com/microsoft/0xDeCA10B/tree/main/demo"

# Already set:
# WORKDIR /home/site/wwwroot

RUN apt-get update && apt-get install --fix-missing --yes build-essential git locales locales-all

COPY client ./client
COPY package.json server.js setup.sh setup_libs.sh yarn.lock ./

RUN NODE_ENV='production' bash setup.sh

RUN cd client && npx --no-install truffle compile

RUN cd client && GENERATE_SOURCEMAP=false yarn build

ENV ORYX_AI_INSTRUMENTATION_KEY=
