require('dotenv').config({ path: '../.env' })
const { format } = require('js-conflux-sdk')

const ERC20Sacred = artifacts.require('ERC20SacredUpgradeable')
const CFXSacred = artifacts.require('CFXSacredUpgradeable')
const Register = artifacts.require('Register')
const Proxy = artifacts.require('TransparentUpgradeableProxy')
const zero_address = '0x0000000000000000000000000000000000000000'
const { confluxTask } = require('./cfx_admin.js')

async function deploySacred(name, token_address, denomination, account, deployer, enforce = false) {
  const { MERKLE_TREE_HEIGHT } = process.env

  let register = await Register.deployed()
  let deployed_address = format.address(await register.pools(name), deployer.network_id)
  let cfx_zero = format.address(zero_address, deployer.network_id)

  if (!enforce && deployed_address != cfx_zero) {
    console.log(`${name} has been depolyed at `, deployed_address)
    return
  }

  if (token_address == undefined) {
    token_address = format.address(zero_address, deployer.network_id)
  }

  let impl
  let sacred

  if (token_address == format.address(zero_address, deployer.network_id)) {
    impl = await deployer.deploy(CFXSacred)
    let calldata = impl.contract.methods
      .initialize(
        await register.verifier(),
        await register.hasher(),
        await register.logger(),
        denomination,
        MERKLE_TREE_HEIGHT,
        format.hexAddress(account),
      )
      .encodeABI()
    let proxy = await deployer.deploy(Proxy, impl.address, await register.admin(), calldata)
    sacred = await CFXSacred.at(proxy.address)
  } else {
    impl = await deployer.deploy(ERC20Sacred)
    let calldata = impl.contract.methods
      .initialize(
        await register.verifier(),
        await register.hasher(),
        await register.logger(),
        denomination,
        MERKLE_TREE_HEIGHT,
        format.hexAddress(account),
        format.hexAddress(token_address),
      )
      .encodeABI()

    let proxy = await deployer.deploy(Proxy, impl.address, await register.admin(), calldata)
    sacred = await ERC20Sacred.at(proxy.address)
  }
  console.log(`Deploy ${name} at `, sacred.address)

  await register.registerPool(token_address, denomination, sacred.address, name, enforce)

  console.log(`Register ${name}`)

  await confluxTask(deployer, sacred, `Sacred:${name}`, impl.address)
}

module.exports = { deploySacred }
