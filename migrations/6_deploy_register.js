/* global artifacts */
const Register = artifacts.require('Register')
const ProxyAdmin = artifacts.require('ProxyAdmin')
const Verifier = artifacts.require('WithdrawAssetVerifier')
const Logger = artifacts.require('./SacredTrees.sol')
const Hasher = artifacts.require('Hasher2')

const { confluxTask } = require('./cfx_admin.js')

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    const verifier = await Verifier.deployed()
    const hasher = await Hasher.deployed()
    const logger = await Logger.deployed()
    const admin = await ProxyAdmin.deployed()

    const register = await deployer.deploy(
      Register,
      verifier.address,
      hasher.address,
      logger.address,
      admin.address,
    )

    await confluxTask(register, deployer)
  })
}
