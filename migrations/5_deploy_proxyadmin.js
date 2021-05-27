/* global artifacts */
const ProxyAdmin = artifacts.require('ProxyAdmin')
const { confluxTask } = require('./cfx_admin.js')

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    const admin = await deployer.deploy(ProxyAdmin)
    await confluxTask(admin, deployer)
  })
}
