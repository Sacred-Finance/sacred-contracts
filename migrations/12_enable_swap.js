/* global artifacts */
const { CFXtoDrip } = require('./conflux_utils.js')
const { format } = require('js-conflux-sdk')
const Swap = artifacts.require('RewardSwap')
const Register = artifacts.require('Register')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }

    const register = await Register.deployed()

    const [tokenAddr, swapAddr, minerAddr] = await Promise.all([
      register.roles('gov-token'),
      register.roles('swap'),
      register.roles('miner'),
    ])

    const swap = await Swap.at(format.address(swapAddr, deployer.network_id))

    await swap.setup(tokenAddr, minerAddr, CFXtoDrip('1000000'), CFXtoDrip('25000'), 10000)
  })
}
