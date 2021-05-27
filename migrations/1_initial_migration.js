/* global artifacts */
const Migrations = artifacts.require('Migrations')
const { confluxTask } = require('./cfx_admin.js')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    if (deployer.network === 'mainnet') {
      return
    }
    const migration = await deployer.deploy(Migrations)

    await confluxTask(migration, deployer)
  })
}
