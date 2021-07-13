const path = require('path')

// Use NODE_ENVIRONMENT if set but remove . before it if production.
const env = process.env.NODE_ENVIRONMENT
let suffix = '.development'
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
	compilers: {
		solc: {
			version: "0.6.2",
		},
	},
	networks: {
		development: {
			host: "127.0.0.1",
			port: 7545,
			// Match any network ID.
			network_id: "*",
			gas: 9E6 - 5000,
		},
		skipMigrations: {
			host: "127.0.0.1",
			port: 7545,
			// Match any network ID.
			network_id: "*",
			gas: 9E6 - 5000,
		}
	},
	mocha: {
		enableTimeouts: false,
	}
}
