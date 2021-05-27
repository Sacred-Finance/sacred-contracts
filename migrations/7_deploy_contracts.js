/* global artifacts */
const { deploySacred } = require('./deploy_sacred.js')
const { Drip } = require('js-conflux-sdk')

const token_address = 'CFXTEST:TYPE.CONTRACT:ACBA39P65HTM82Y90UJCA50YSKV5R7PDDP0Y1PKHRP'

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    await deploySacred('1-cfx', undefined, Drip.fromCFX(1), accounts[0], deployer, true)
    await deploySacred('10-cfx', undefined, Drip.fromCFX(10), accounts[0], deployer)
    await deploySacred('100-cfx', undefined, Drip.fromCFX(100), accounts[0], deployer)

    await deploySacred('1-daim', token_address, Drip.fromCFX(1), accounts[0], deployer, true)
    await deploySacred('10-daim', token_address, Drip.fromCFX(10), accounts[0], deployer)
    await deploySacred('100-daim', token_address, Drip.fromCFX(100), accounts[0], deployer)
  })
}
