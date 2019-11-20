# For deployment to an Azure Web Service
# Build with: docker image build --file service.Dockerfile --tag decai-demo-prod .
FROM appsvc/node:10-lts

LABEL maintainer="Justin D. Harris (justin.harris@microsoft.com)"

# Front-end:
EXPOSE 3000
# Back-end:
EXPOSE 5387
# Blockchain:
EXPOSE 7545

WORKDIR /root/workspace/demo

RUN apt-get update && apt-get install --fix-missing --yes build-essential git locales locales-all

COPY client ./client
COPY package.json server.js setup.sh setup_libs.sh yarn.lock ./

RUN bash setup.sh

# Override the port the blockchain uses (just for this command).
# Test also builds the contracts.
RUN cd client && PORT=7545 yarn test && yarn build
