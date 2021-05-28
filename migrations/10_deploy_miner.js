/* global artifacts */
const { deployUpgradeable, overwrite_mode, upgrade_mode, skip_mode } = require('./deploy_sacred.js')
const MerkleTree = require('fixed-merkle-tree')
const { poseidonHash2, toFixedHex } = require('../src/utils')
const { format } = require('js-conflux-sdk')

const Miner = artifacts.require('Miner')
const Register = artifacts.require('Register')

const LEVELS = 20

module.exports = async function (deployer, network, accounts) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }

    const emptyTree = new MerkleTree(LEVELS, [], {
      hashFunction: poseidonHash2,
      zeroElement: '18057714445064126197463363025270544038935021370379666668119966501302555028628',
    })
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
      toFixedHex(emptyTree.root()),
      [],
    ]

    await deployUpgradeable('miner', init_args, Miner, deployer, overwrite_mode)
  })
}
