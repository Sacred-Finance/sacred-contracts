require('dotenv').config()

module.exports = {
  // Uncommenting the defaults below
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!
  //
  networks: {
    //You should run an ethereum full node or ganache before activating this network.
    development: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
    },
    // You should run a conflux full node in dev mode before activating this network.
    cfxdev: {
      host: '127.0.0.1',
      port: 12539,
      // A raw conflux node in dev mode will add balance to an account controlled by the following private key.
      privateKeys: ['0x46b9e861b63d3509c88b7817275a30d22d62c8cd8fa6486ddee35ef0d8e0495f'],
      network_id: '*',
    },
    cfxtest: {
      url: 'https://test.confluxrpc.com',
      // Put your own keys here. Claim CFX token on testnet by Conflux Portal https://portal.conflux-chain.org/
      privateKeys: ['0x...'],
      network_id: '*',
    },
    // coverage: {
    //   host: 'localhost',
    //   network_id: '*',
    //   port: 8554, // <-- If you change this, also set the port option in .solcover.js.
    //   gas: 0xfffffffffff, // <-- Use this high gas value
    //   gasPrice: 0x01, // <-- Use this low gas price
    // },
  },
  compilers: {
    solc: {
      version: '0.6.12',
      settings: {
        optimizer: {
          enabled: true,
          runs: 200,
        },
      },
    },
    external: {
      command: 'node ./compileHasher.js',
      targets: [
        {
          path: './build/contracts/Hasher2.json',
        },
        {
          path: './build/contracts/Hasher3.json',
        },
      ],
    },
  },
  plugins: ['truffle-plugin-verify', 'solidity-coverage'],
}
