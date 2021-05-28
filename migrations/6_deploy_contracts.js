/* global artifacts */
const { deploySacred, overwrite_mode, upgrade_mode } = require('./deploy_sacred.js')
const { Drip, format } = require('js-conflux-sdk')

const token_address = 'CFXTEST:TYPE.CONTRACT:ACBA39P65HTM82Y90UJCA50YSKV5R7PDDP0Y1PKHRP'
const CFXtoDrip = (x) => format.bigUIntHex(Drip.fromCFX(x))

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    await deploySacred('1-cfx', undefined, CFXtoDrip(1), accounts[0], deployer)
    await deploySacred('10-cfx', undefined, CFXtoDrip(10), accounts[0], deployer)
    await deploySacred('100-cfx', undefined, CFXtoDrip(100), accounts[0], deployer)
    await deploySacred('1000-cfx', undefined, CFXtoDrip(1000), accounts[0], deployer)

    await deploySacred('1-daim', token_address, CFXtoDrip(1), accounts[0], deployer)
    // await deploySacred('10-daim', token_address, CFXtoDrip(10), accounts[0], deployer)
    // await deploySacred('100-daim', token_address, CFXtoDrip(100), accounts[0], deployer)

    // await deploySacred('1-cfx', undefined, CFXtoDrip(1), accounts[0], deployer, upgrade_mode)
  })
}

// const tokenInstance = await deployer.deploy(ERC20Mock)
// token = tokenInstance.address
// await tokenInstance.mint(accounts[0], toWei('10000'))
// await confluxTask(tokenInstance, deployer)
