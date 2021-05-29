/* global artifacts */
require('dotenv').config({ path: '../.env' })
const { confluxTask } = require('./conflux_utils.js')

const Logger = artifacts.require('SacredTrees')
const Register = artifacts.require('Register')

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT } = process.env
    const register = await Register.deployed()

    const logger = await deployer.deploy(
      Logger,
      accounts[0],
      await register.roles('hasher2'),
      await register.roles('hasher3'),
      MERKLE_TREE_HEIGHT,
    )
    await register.setRole('logger', logger.address)

    await confluxTask(logger, deployer)
  })
}
