/* global artifacts */
const { format } = require('js-conflux-sdk')

const Miner = artifacts.require('Miner')
const Logger = artifacts.require('SacredTrees')
const Register = artifacts.require('Register')

const plans = [
  ['1-cfx', 1],
  ['10-cfx', 2],
  ['100-cfx', 5],
  ['1000-cfx', 10],
]

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }

    const register = await Register.deployed()

    const logger = await Logger.at(format.address(await register.roles('logger'), deployer.network_id))
    const miner = await Miner.at(format.address(await register.roles('miner'), deployer.network_id))

    let rates = []

    for (const plan of plans) {
      var [name, points] = plan
      var instance = await register.pools(name)
      await logger.setSacredAddresses(instance)
      console.log(`Enable mining for ${name} at `, format.address(instance, deployer.network_id))
      rates.push({ instance, value: format.hex(points) })
    }

    await miner.setRates(rates)
    console.log('Set rates in batch', plans)
  })
}
