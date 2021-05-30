/* global artifacts */
const MerkleTree = require('fixed-merkle-tree')
const { format } = require('js-conflux-sdk')

const { poseidonHash2, toFixedHex } = require('../src/utils')
const { deployUpgradeable, overwrite_mode, upgrade_mode, skip_mode } = require('./deploy_sacred.js')

const Miner = artifacts.require('Miner')
const Register = artifacts.require('Register')
const Logger = artifacts.require('SacredTrees')

module.exports = async function (deployer, network, accounts) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }

    const register = await Register.deployed()

    const [rewardSwap, sacredTrees, verifier0, verifier1, verifier2] = await Promise.all([
      register.roles('swap'),
      register.roles('logger'),
      register.roles('rewardVerifier'),
      register.roles('withdrawRewardVerifier'),
      register.roles('treeUpdateVerifier'),
    ])

    const init_args = [
      rewardSwap,
      format.hexAddress(accounts[0]),
      sacredTrees,
      [verifier0, verifier1, verifier2],
      [],
    ]

    const miner = await deployUpgradeable('miner', init_args, Miner, deployer, overwrite_mode)

    const logger = await Logger.at(format.address(sacredTrees, deployer.network_id))
    await logger.setMiner(miner.address)
  })
}
