/* global artifacts */
const { confluxTask,CFXtoDrip, isZeroAddress } = require('./conflux_utils.js')

const Register = artifacts.require('Register')
const SRDToken = artifacts.require('SacredTokenMock')


module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    const register = await Register.deployed()

    if (isZeroAddress(await register.roles('gov-token'))) {
      const token = await deployer.deploy(SRDToken)
      await register.setRole('gov-token', token.address)
      await confluxTask(token, deployer)
    }
  })
}
