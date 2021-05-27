/* global artifacts */
const ProxyAdmin = artifacts.require('ProxyAdmin')
const { confluxTask } = require('./cfx_admin.js')
const Register = artifacts.require('Register')

module.exports = function (deployer, network, accounts) {
  return deployer.then(async () => {
    const admin = await deployer.deploy(ProxyAdmin)
    const register = await Register.deployed()

    await register.setRole('proxyAdmin', admin.address)

    await confluxTask(admin, deployer)
  })
}
