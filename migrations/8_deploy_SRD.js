/* global artifacts */
const { confluxTask, CFXtoDrip, isZeroAddress, isDeployed } = require('./conflux_utils.js')

const Register = artifacts.require('Register')
const SRDToken = artifacts.require('SacredTokenMock')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    const register = await Register.deployed()

    if (!(await isDeployed('gov-token', register))) {
      const token = await deployer.deploy(SRDToken)
      await register.setRole('gov-token', token.address)
      await confluxTask(token, deployer)
    }
  })
}
