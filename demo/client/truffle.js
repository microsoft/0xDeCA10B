const path = require('path')

// Use NODE_ENVIRONMENT if set but remove . before it if production.
const env = process.env.NODE_ENVIRONMENT;
let suffix = '.development';
if (env === 'production') {
  suffix = ''
} else if (env !== undefined) {
  suffix = `.${env}`
}
require('dotenv').config({ path: path.resolve(__dirname, `.env${suffix}`) })

module.exports = {
  // See <https://truffleframework.com/docs/truffle/reference/configuration>
  // for more about customizing your Truffle configuration!

  // Following the directory structure for solidity (juanblanco.solidity) VS Code extension.
  contracts_directory: path.join(__dirname, 'src/contracts'),
  contracts_build_directory: path.join(__dirname, 'src/contracts/compiled'),
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*" // Match any network id
    },
    skipMigrations: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    }
  },
  mocha: {
    enableTimeouts: false,
  }
}
