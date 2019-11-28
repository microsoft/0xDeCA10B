# For deployment to an Azure Web Service
# First get permission to push 0xdeca10bcontainerreg.azurecr.io, then:
# docker login 0xdeca10bcontainerreg.azurecr.io
# docker build --file service.Dockerfile -t 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo-prod .
# docker push 0xdeca10bcontainerreg.azurecr.io/public/samples/blockchain-ai/0xdeca10b-demo-prod:latest
# The deployment is set up to happen automatically in Azure.
FROM appsvc/node:10-lts

LABEL maintainer="Justin D. Harris (justin.harris@microsoft.com)"

# Already set:
# WORKDIR /home/site/wwwroot

RUN apt-get update && apt-get install --fix-missing --yes build-essential git locales locales-all

COPY client ./client
COPY package.json server.js setup.sh setup_libs.sh yarn.lock ./

RUN bash setup.sh

# Override the port the blockchain uses (just for this command).
# Test also builds the contracts.
# FIXME Only build necessary stuff.
RUN cd client && PORT=7545 yarn test

RUN cd client && yarn build
