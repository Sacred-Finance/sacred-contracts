/* global artifacts */
const { confluxTask } = require('./cfx_admin.js')
const { format, Drip } = require('js-conflux-sdk')

const Register = artifacts.require('Register')
const SRDToken = artifacts.require('SacredTokenMock')

const zero_address = '0x0000000000000000000000000000000000000000'
const CFXtoDrip = (x) => format.bigUIntHex(Drip.fromCFX(x))

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    const register = await Register.deployed()

    if (format.hexAddress(await register.roles('gov-token')) == zero_address) {
      const token = await deployer.deploy(SRDToken)
      await register.setRole('gov-token', token.address)
      await confluxTask(token, deployer)
    }
  })
}
