# For deployment to an Azure Web Service
# Build with: docker image build --file service.Dockerfile --tag decai-demo-prod .
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
RUN cd client && PORT=7545 yarn test

RUN cd client && yarn build --max_old_space_size=1024m
