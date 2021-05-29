const { Conflux, format, Drip } = require('js-conflux-sdk')
const { gzip } = require('pako')
const Announcement = artifacts.require('Announcement')

const suffix = '-v1.2'
const announce_addr = 'cfxtest:aca514ancmbdu9u349u4m7d0u4jjdv83py3muarnv1'

const CFXtoDrip = (x) => format.bigUIntHex(Drip.fromCFX(x))

function isZeroAddress(address) {
  return format.hexAddress(address) == '0x0000000000000000000000000000000000000000'
}

function confluxProvider(deployer) {
  var network_id = deployer.network_id
  var rpc = deployer.provider.host
  const conflux = new Conflux({ url: rpc, networkId: network_id })
  const PRIVATE_KEY = deployer.networks[deployer.network].privateKeys[0]
  const account = conflux.wallet.addPrivateKey(PRIVATE_KEY)
  return { conflux, account }
}

function readABI(instance) {
  var name = instance.constructor['_json'].contractName
  var abi = instance.constructor['_json'].abi
  return { name, abi }
}

async function confluxTask(instance, deployer, options = {}) {
  try {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    await registerScan(instance, deployer, options)
    await clearAdmin(instance.address, deployer, options)
  } catch (e) {
    console.error('Error: Conflux Task for ', instance.address, e)
  }
}

async function clearAdmin(instanceAddr, deployer, options = {}) {
  const { conflux, account } = confluxProvider(deployer)
  var zeroAddr = format.address('0x0000000000000000000000000000000000000000', conflux.networkId)
  await conflux
    .InternalContract('AdminControl')
    .setAdmin(instanceAddr, zeroAddr)
    .sendTransaction({ from: account })
    .executed()
  console.log('Clear Admin for ', instanceAddr)
}

async function registerScan(instance, deployer, options = {}) {
  let { name, abi } = readABI(instance)
  name = options.name || name

  if (deployer.network_id !== 1) {
    console.log("This network doesn't have scan register")
    return
  }
  let version_suffix
  if (options.subversion !== undefined) {
    version_suffix = suffix + options.subversion
  } else {
    version_suffix = suffix
  }
  const announcement = await Announcement.at(announce_addr)
  var address = format.hexAddress(instance.address)

  var data = [
    {
      key: `contract/list/${address}`,
      value: instance.address,
    },
    {
      key: `contract/${address}/abi`,
      value: gzip(JSON.stringify(abi)),
    },
    {
      key: `contract/${address}/name`,
      value: `${name}${version_suffix}`,
    },
  ]
  var group = data.map(function ({ key, value }) {
    return { key: format.bytes(key), value: format.bytes(value) }
  })
  await announcement.announce(group)
  console.log('Register functions on Scan for ', instance.address)
}

module.exports = { confluxTask, clearAdmin, registerScan, CFXtoDrip, isZeroAddress }
