/* global artifacts */
const Migrations = artifacts.require('Migrations')
const Register = artifacts.require('Register')

const { confluxTask } = require('./conflux_utils.js')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network === 'mainnet') {
      return
    }
    const migration = await deployer.deploy(Migrations)
    await confluxTask(migration, deployer)
    const register = await deployer.deploy(Register)
    await confluxTask(register, deployer)
  })
}
