const path = require("path");

module.exports = {
  // See <https://truffleframework.com/docs/truffle/reference/configuration>
  // for more about customizing your Truffle configuration!
  contracts_build_directory: path.join(__dirname, "src/contracts"),
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
  }
};
