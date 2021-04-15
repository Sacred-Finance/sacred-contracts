/* global artifacts */
require('dotenv').config({ path: '../.env' })
const Logger = artifacts.require('./SacredTrees.sol')
const hasher2Contract = artifacts.require('Hasher2')
const hasher3Contract = artifacts.require('Hasher3')
const { confluxTask } = require('./cfx_admin.js')

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT } = process.env
    const hasher2 = await hasher2Contract.deployed()
    const hasher3 = await hasher3Contract.deployed()
    const logger = await deployer.deploy(
      Logger,
      accounts[0],
      hasher2.address,
      hasher3.address,
      MERKLE_TREE_HEIGHT,
    )
    await confluxTask(deployer, logger)
  })
}
