/* global artifacts */
const Hasher2 = artifacts.require('Hasher2')
const Hasher3 = artifacts.require('Hasher3')
const { confluxTask } = require('./cfx_admin.js')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    const hasher2 = await deployer.deploy(Hasher2)
    const hasher3 = await deployer.deploy(Hasher3)

    await confluxTask(hasher2, deployer)
    await confluxTask(hasher3, deployer)
  })
}
