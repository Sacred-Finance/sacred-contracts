/* global artifacts */
require('dotenv').config({ path: '../.env' })
const ERC20Sacred = artifacts.require('ERC20Sacred')
const Verifier = artifacts.require('./verifiers/WithdrawAssetVerifier.sol')
const Logger = artifacts.require('./SacredTrees.sol')
const hasherContract = artifacts.require('Hasher2')
const ERC20Mock = artifacts.require('ERC20Mock')
const { toWei } = require('web3-utils')
const { confluxTask } = require('./cfx_admin.js')

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    const { MERKLE_TREE_HEIGHT, ERC20_TOKEN, TOKEN_AMOUNT } = process.env
    const verifier = await Verifier.deployed()
    const hasherInstance = await hasherContract.deployed()
    const logger = await Logger.deployed()
    await ERC20Sacred.link(hasherContract, hasherInstance.address)
    let token = ERC20_TOKEN
    if (token === '') {
      const tokenInstance = await deployer.deploy(ERC20Mock)
      token = tokenInstance.address
      await tokenInstance.mint(accounts[0], toWei('10000'))
      await confluxTask(deployer, tokenInstance)
    }
    const sacred = await deployer.deploy(
      ERC20Sacred,
      verifier.address,
      hasherInstance.address,
      logger.address,
      TOKEN_AMOUNT,
      MERKLE_TREE_HEIGHT,
      accounts[0],
      token,
    )
    await logger.setSacredAddresses(sacred.address)
    await confluxTask(deployer, sacred)
    console.log("ERC20Sacred's address ", sacred.address)
  })
}
