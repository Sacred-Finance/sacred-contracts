/* global artifacts */
const { deployUpgradeable, overwrite_mode, upgrade_mode, skip_mode } = require('./deploy_sacred.js')
const Swap = artifacts.require('RewardSwap')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    await deployUpgradeable('swap', [], Swap, deployer, overwrite_mode)

    await token.mint(await register.roles('swap'), CFXtoDrip('1000000'))
  })
}
