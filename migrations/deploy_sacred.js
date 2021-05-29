require('dotenv').config({ path: '../.env' })
const { MERKLE_TREE_HEIGHT } = process.env
const { format } = require('js-conflux-sdk')

const ERC20Sacred = artifacts.require('ERC20SacredUpgradeable')
const CFXSacred = artifacts.require('CFXSacredUpgradeable')
const Register = artifacts.require('Register')
const ProxyAdmin = artifacts.require('ProxyAdmin')
const Proxy = artifacts.require('TransparentUpgradeableProxy')
const zero_address = '0x0000000000000000000000000000000000000000'
const cip37_zero = (network_id) => format.address(zero_address, network_id)
const { confluxTask, clearAdmin } = require('./conflux_utils.js')

const skip_mode = 0
const upgrade_mode = 1
const overwrite_mode = 2

async function deployCFXSacredV1(denomination, operator, register, deployer) {
  let impl = await deployer.deploy(CFXSacred)
  let calldata = impl.contract.methods
    .initialize(
      await register.roles('withdrawAssetVerifier'),
      await register.roles('hasher2'),
      await register.roles('logger'),
      denomination,
      MERKLE_TREE_HEIGHT,
      format.hexAddress(operator),
    )
    .encodeABI()
  return { impl, calldata, Contract: CFXSacred }
}

async function deployERC20SacredV1(hex_token_address, denomination, operator, register, deployer) {
  let impl = await deployer.deploy(ERC20Sacred)
  let calldata = impl.contract.methods
    .initialize(
      await register.roles('withdrawAssetVerifier'),
      await register.roles('hasher2'),
      await register.roles('logger'),
      denomination,
      MERKLE_TREE_HEIGHT,
      format.hexAddress(operator),
      hex_token_address,
    )
    .encodeABI()
  return { impl, calldata, Contract: ERC20Sacred }
}

async function deploySacredV1(hex_token_address, denomination, operator, register, deployer) {
  if (hex_token_address == zero_address) {
    return await deployCFXSacredV1(denomination, operator, register, deployer)
  } else {
    return await deployERC20SacredV1(hex_token_address, denomination, operator, register, deployer)
  }
}

async function deploySacred(name, token_address, denomination, account, deployer, mode = skip_mode) {
  const register = await Register.deployed()
  token_address = token_address || cip37_zero(deployer.network_id)
  let deployed_address = format.address(await register.pools(name), deployer.network_id)
  let is_deployed = deployed_address != cip37_zero(deployer.network_id)

  if (mode == skip_mode && is_deployed) {
    console.log(`${name} has been depolyed at `, deployed_address)
    return
  }

  const { impl, calldata, Contract } = await deploySacredV1(
    format.hexAddress(token_address),
    denomination,
    account,
    register,
    deployer,
  )

  if (!is_deployed || mode == overwrite_mode) {
    const proxy = await deployer.deploy(Proxy, impl.address, await register.roles('proxyAdmin'), calldata)
    const sacred = await Contract.at(proxy.address)
    console.log(`Deploy ${name} at `, sacred.address)

    await register.registerPool(token_address, denomination, sacred.address, name, mode == overwrite_mode)
    console.log(`Register ${name} for `, sacred.address)

    await confluxTask(sacred, deployer, { name: `Sacred:${name}` })
    await clearAdmin(impl.address, deployer)
  } else {
    // The rest case is deployed + upgrade mode
    const admin = await ProxyAdmin.at(format.address(await register.roles('proxyAdmin'), deployer.network_id))

    // We only support no call_data mode now
    await admin.upgrade(deployed_address, impl.address)
    console.log(`Upgrade ${name} at ${deployed_address} to ${impl.address}`)

    await clearAdmin(impl.address, deployer)
  }
}

async function deployUpgradeable(name, args, Contract, deployer, mode = skip_mode) {
  const register = await Register.deployed()
  let deployed_address = format.address(await register.roles(name), deployer.network_id)
  console.log(deployed_address)
  let is_deployed = deployed_address != cip37_zero(deployer.network_id)

  if (mode == skip_mode && is_deployed) {
    console.log(`${name} has been depolyed at `, deployed_address)
    return
  }

  const impl = await deployer.deploy(Contract)

  if (!is_deployed || mode == overwrite_mode) {
    const calldata = impl.contract.methods.initialize(...args).encodeABI()
    const proxy = await deployer.deploy(Proxy, impl.address, await register.roles('proxyAdmin'), calldata)
    const sacred = await Contract.at(proxy.address)
    console.log(`Deploy ${name} at `, sacred.address)

    await register.setRole(name, sacred.address)
    console.log(`Register ${name} for `, sacred.address)

    await confluxTask(sacred, deployer)
    await clearAdmin(impl.address, deployer)
  } else {
    // The rest case is deployed + upgrade mode
    const admin = await ProxyAdmin.at(format.address(await register.roles('proxyAdmin'), deployer.network_id))

    // We only support no call_data mode now
    await admin.upgrade(deployed_address, impl.address)
    console.log(`Upgrade ${name} at ${deployed_address} to ${impl.address}`)

    await clearAdmin(impl.address, deployer)
  }
  return await Contract.at(impl.address)
}

module.exports = { deploySacred, skip_mode, upgrade_mode, overwrite_mode, deployUpgradeable }
