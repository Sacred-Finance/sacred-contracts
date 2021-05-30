/* global artifacts */
const Swap = artifacts.require('RewardSwap')
const Register = artifacts.require('Register')
const SRDToken = artifacts.require('SacredTokenMock')

const { deployUpgradeable, overwrite_mode, upgrade_mode, skip_mode } = require('./deploy_sacred.js')
const { format } = require('js-conflux-sdk')
const { CFXtoDrip } = require('./conflux_utils.js')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }

    const register = await Register.deployed()

    const swap = await deployUpgradeable('swap', [], Swap, deployer, overwrite_mode)
    token = await SRDToken.at(format.address(await register.roles('gov-token'), deployer.network_id))

    if ((await token.balanceOf(swap.address)) == 0) {
      await token.mint(swap.address, CFXtoDrip('1000000'))
    }
  })
}
