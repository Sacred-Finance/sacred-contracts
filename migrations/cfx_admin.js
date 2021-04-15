const { Conflux, format } = require('js-conflux-sdk')
const { announce_abi, announce_addr } = require('./announce.js')
const { gzip } = require('pako')

const version_suffix = '(test)'

async function confluxTask(deployer, instance) {
  try {
    if (deployer.network.substr(0, 3) !== 'cfx') {
      return
    }
    var network_id = deployer.network_id
    var rpc = deployer.provider.host
    const conflux = new Conflux({ url: rpc, networkId: network_id })
    const PRIVATE_KEY = deployer.networks[deployer.network].privateKeys[0]
    const account = conflux.wallet.addPrivateKey(PRIVATE_KEY)

    if (network_id === 1) {
      var name = instance.constructor['_json'].contractName
      var abi = instance.constructor['_json'].abi
      await registerScan(name, abi, instance.address, conflux, account)
    }
    await clearAdmin(instance.address, conflux, account)
  } catch (e) {
    console.error('Error: Conflux Task for ', instance.address, e)
  }
}

async function clearAdmin(instanceAddr, conflux, account) {
  var zeroAddr = format.address('0x0000000000000000000000000000000000000000', conflux.networkId)
  await conflux
    .InternalContract('AdminControl')
    .setAdmin(instanceAddr, zeroAddr)
    .sendTransaction({ from: account })
    .executed()
  console.log('Clear Admin for ', instanceAddr)
}

async function registerScan(name, abi, instanceAddr, conflux, account) {
  const announcement = conflux.Contract({ abi: announce_abi, address: announce_addr })

  var address = format.hexAddress(instanceAddr)

  var data = [
    {
      key: `contract/list/${address}`,
      value: instanceAddr,
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
  await announcement.announce(group).sendTransaction({ from: account }).executed()
  console.log('Register functions on Scan for ', instanceAddr)
}

module.exports = { confluxTask }
