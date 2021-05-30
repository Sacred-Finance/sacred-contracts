/* global artifacts */
const Migrations = artifacts.require('Migrations')
const Register = artifacts.require('Register')
const Memo = artifacts.require('Memo')

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
    const memo = await deployer.deploy(Memo)
    await confluxTask(register, deployer)
    await register.setRole('memo', memo.address)
  })
}
