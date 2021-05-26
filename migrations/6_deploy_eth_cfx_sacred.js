/* global artifacts */
require('dotenv').config({ path: '../.env' })
const { deployProxy } = require('@openzeppelin/truffle-upgrades')
const CFXSacred = artifacts.require('CFXSacredUpgradeable')
const ETHSacred = artifacts.require('ETHSacredUpgradeable')
const Verifier = artifacts.require('./verifiers/WithdrawAssetVerifier.sol')
const Logger = artifacts.require('./SacredTrees.sol')
const hasherContract = artifacts.require('Hasher2')
const { toWei } = require('web3-utils')
const { confluxTask } = require('./cfx_admin.js')

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT, ETH_AMOUNT } = process.env
    const verifier = await Verifier.deployed()
    const logger = await Logger.deployed()
    const hasherInstance = await hasherContract.deployed()
    if (network.substr(0, 3) === 'cfx') {
      await CFXSacred.link(hasherContract, hasherInstance.address)
      const sacred = await deployer.deploy(
        CFXSacred,
        verifier.address,
        hasherInstance.address,
        logger.address,
        ETH_AMOUNT,
        MERKLE_TREE_HEIGHT,
        accounts[0],
        { value: toWei('1') },
      )
      await logger.setSacredAddresses(sacred.address)
      await confluxTask(deployer, sacred)
      console.log("CFXSacred's address ", sacred.address)
    } else {
      await ETHSacred.link(hasherContract, hasherInstance.address)
      const sacred = await deployProxy(
        ETHSacred,
        [
          verifier.address,
          hasherInstance.address,
          logger.address,
          ETH_AMOUNT,
          MERKLE_TREE_HEIGHT,
          accounts[0],
        ],
        { deployer },
      )
      await logger.setSacredAddresses(sacred.address)
      console.log("ETHSacred's address ", sacred.address)
    }
  })
}
