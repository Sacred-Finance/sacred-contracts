#!/usr/bin/env node
// Temporary demo client
// Works both in browser and node.js

require('dotenv').config()
const fs = require('fs')
const axios = require('axios')
const assert = require('assert')
const snarkjs = require('snarkjs')
const crypto = require('crypto')
const circomlib = require('circomlib')
const bigInt = snarkjs.bigInt
const { Conflux, Drip, format } = require('js-conflux-sdk')
const buildGroth16 = require('websnark/src/groth16')
const websnarkUtils = require('websnark/src/utils')
const toBN = format.bigInt
const newBN = format.bigInt
const { toWei } = require('web3-utils')
const config = require('./config')
const program = require('commander')
const { poseidonHash2, getExtWithdrawAssetArgsHash } = require('./src/utils')

const MerkleTree = require('fixed-merkle-tree')

let sacred, circuit, proving_key, groth16, erc20, senderAccount, chainId, networkId
let MERKLE_TREE_HEIGHT, CFX_AMOUNT, TOKEN_AMOUNT, PRIVATE_KEY
let conflux

/** Whether we are in a browser or node.js */
let isLocalRPC = false

/** Generate random number of specified byte length */
const rbigint = (nbytes) => snarkjs.bigInt.leBuff2int(crypto.randomBytes(nbytes))

/** Compute pedersen hash */
const pedersenHash = (data) => circomlib.babyJub.unpackPoint(circomlib.pedersenHash.hash(data))[0]

/** BigNumber to hex string of specified length */
function toHex(number, length = 32) {
  const str = number instanceof Buffer ? number.toString('hex') : bigInt(number).toString(16)
  return '0x' + str.padStart(length * 2, '0')
}

/** Display CFX account balance */
async function printCFXBalance({ address, name }) {
  console.log(`${name} CFX balance is`, Drip(await conflux.getBalance(address)).toCFX())
}

/** Display ERC20 account balance */
async function printERC20Balance({ address, name, tokenAddress }) {
  const erc20ContractJson = require('./build/contracts/ERC20Mock.json')
  erc20 = tokenAddress ? conflux.Contract({ abi: erc20ContractJson.abi, address: tokenAddress }) : erc20
  console.log(`${name} Token Balance is`, await erc20.balanceOf(address))
}

/**
 * Create deposit object from secret and nullifier
 */
function createDeposit({ nullifier, secret }) {
  const deposit = { nullifier, secret }
  deposit.preimage = Buffer.concat([deposit.nullifier.leInt2Buff(31), deposit.secret.leInt2Buff(31)])
  deposit.commitment = pedersenHash(deposit.preimage)
  deposit.commitmentHex = toHex(deposit.commitment)
  deposit.nullifierHash = pedersenHash(deposit.nullifier.leInt2Buff(31))
  deposit.nullifierHex = toHex(deposit.nullifierHash)
  return deposit
}

/**
 * Make a deposit
 * @param currency currency
 * @param amount Deposit amount
 */
async function deposit({ currency, amount }) {
  const deposit = createDeposit({ nullifier: rbigint(31), secret: rbigint(31) })
  const note = toHex(deposit.preimage, 62)
  const noteString = `sacred-${currency}-${amount}-${networkId}-${note}`
  console.log(`Your note: ${noteString}`)
  if (currency === 'cfx') {
    console.log(senderAccount)
    await printCFXBalance({ address: sacred.address, name: 'Sacred' })
    await printCFXBalance({ address: senderAccount, name: 'Sender account' })
    const value = isLocalRPC ? CFX_AMOUNT : fromDecimals({ amount, decimals: 18 })
    console.log('Submitting deposit transaction')
    let txReceipt = await sacred
      .deposit(Buffer.from(toHex(deposit.commitment).substr(2), 'hex'))
      .sendTransaction({ value, from: senderAccount, gas: 2e6, gasPrice: 10, storageLimit: 1000 })
      .executed()
    console.log('txReceipt: ', txReceipt)
    await printCFXBalance({ address: sacred.address, name: 'Sacred' })
    await printCFXBalance({ address: senderAccount, name: 'Sender account' })
  } else {
    // a token
    await printERC20Balance({ address: sacred.address, name: 'Sacred' })
    await printERC20Balance({ address: senderAccount, name: 'Sender account' })
    const decimals = isLocalRPC ? 18 : config.cfx_deployments[`netId${chainId}`][currency].decimals
    const tokenAmount = isLocalRPC ? TOKEN_AMOUNT : fromDecimals({ amount, decimals })
    if (isLocalRPC) {
      console.log('Minting some test tokens to deposit')
      await erc20
        .mint(senderAccount, tokenAmount)
        .sendTransaction({ from: senderAccount, gas: 2e6, gasPrice: 10, storageLimit: 1000 })
    }

    const allowance = await erc20.allowance(senderAccount, sacred.address).call({ from: senderAccount })
    console.log('Current allowance is', Drip(allowance).toCFX())
    if (toBN(allowance).lt(toBN(tokenAmount))) {
      console.log('Approving tokens for deposit')
      await erc20
        .approve(sacred.address, tokenAmount)
        .sendTransaction({ from: senderAccount, gas: 2e6, gasPrice: 10, storageLimit: 1000 })
        .executed()
    }

    console.log('Submitting deposit transaction')

    let txReceipt = await sacred
      .deposit(Buffer.from(toHex(deposit.commitment).substr(2), 'hex'))
      .sendTransaction({ from: senderAccount, gas: 2e6, gasPrice: 10, storageLimit: 1000 })
      .executed()
    console.log('txReceipt: ', txReceipt)
    await printERC20Balance({ address: sacred.address, name: 'Sacred' })
    await printERC20Balance({ address: senderAccount, name: 'Sender account' })
  }

  return noteString
}

/**
 * Generate merkle tree for a deposit.
 * Download deposit events from the sacred, reconstructs merkle tree, finds our deposit leaf
 * in it and generates merkle proof
 * @param deposit Deposit object
 */
async function generateMerkleProof(deposit) {
  // Get all deposit events from smart contract and assemble merkle tree from them
  console.log('Getting current state from sacred contract')

  // const events = await sacred.Deposit(null, null, null).getLogs({
  //   fromEpoch: 1,
  //   toEpoch: "latest_state", // change to latest
  //   // limit: 100,
  // });
  // const leaves = events
  //   .sort((a, b) => Number(a.arguments.leafIndex) - Number(b.arguments.leafIndex)) // Sort events in chronological order
  //   .map(e => e.arguments.commitment)

  const leaves = (await sacred.getCommitmentHistory(0, 100)).map((e) => format.hex(e))

  const tree = new MerkleTree(MERKLE_TREE_HEIGHT, leaves, {
    hashFunction: poseidonHash2,
    zeroElement: '18057714445064126197463363025270544038935021370379666668119966501302555028628',
  })

  // Find current commitment in the tree
  const leafIndex = leaves.findIndex((e) => e === toHex(deposit.commitment))
  assert(leafIndex >= 0, 'The deposit is not found in the tree')

  // Validate that our data is correct
  const root = tree.root()
  const { pathElements, pathIndices } = tree.path(format.uInt(leafIndex))

  const isValidRoot = await sacred.isKnownRoot(Buffer.from(toHex(root).substr(2), 'hex')).call()
  const isSpent = await sacred.isSpent(Buffer.from(toHex(deposit.nullifierHash).substr(2), 'hex')).call()
  assert(isValidRoot === true, 'Merkle tree is corrupted')
  assert(isSpent === false, 'The note is already spent')

  // Compute merkle proof of our commitment
  return { root, pathElements, pathIndices }
}

/**
 * Generate SNARK proof for withdrawal
 * @param deposit Deposit object
 * @param recipient Funds recipient
 * @param relayer Relayer address
 * @param fee Relayer fee
 * @param refund Receive ether for exchanged tokens
 */
async function generateProof({ deposit, recipient, relayerAddress = null, fee = 0, refund = 0 }) {
  // Compute merkle proof of our commitment
  var recipient = format.hexAddress(recipient)
  var relayerAddress = relayerAddress === null ? 0 : format.hexAddress(relayerAddress)
  const { root, pathElements, pathIndices } = await generateMerkleProof(deposit)

  const extData = { recipient, relayer: relayerAddress, fee, refund }
  const extDataHash = getExtWithdrawAssetArgsHash(extData)
  // Prepare circuit input
  const input = {
    // Public snark inputs
    root: root,
    nullifierHash: deposit.nullifierHash,
    extDataHash,

    // Private snark inputs
    nullifier: deposit.nullifier,
    secret: deposit.secret,
    pathElements,
    pathIndices,
  }

  console.log('Generating SNARK proof')
  console.time('Proof time')
  const proofData = await websnarkUtils.genWitnessAndProve(groth16, input, circuit, proving_key)
  const { proof } = websnarkUtils.toSolidityInput(proofData)
  console.timeEnd('Proof time')
  console.log('proof ', proof)

  const args = [
    Buffer.from(toHex(input.root).substr(2), 'hex'),
    Buffer.from(toHex(input.nullifierHash).substr(2), 'hex'),
    toHex(recipient, 20),
    toHex(relayerAddress, 20),
    toHex(fee),
    toHex(refund),
  ]

  console.log('args ', args)

  return { proof: Buffer.from(proof.substr(2), 'hex'), args }
}

/**
 * Do an CFX withdrawal
 * @param noteString Note to withdraw
 * @param recipient Recipient address
 */
async function withdraw({ deposit, currency, amount, recipient, relayerURL, refund = '0' }) {
  if (currency === 'cfx' && refund !== '0') {
    throw new Error('The ETH purchase is supposted to be 0 for ETH withdrawals')
  }
  refund = toWei(refund)
  if (relayerURL) {
    throw new Error('Relayer is not supported')
    /*
    if (relayerURL.endsWith('.eth')) {
      throw new Error('ENS name resolving is not supported. Please provide DNS name of the relayer. See instuctions in README.md')
    }
    const relayerStatus = await axios.get(relayerURL + '/status')
    const { relayerAddress, chainId, gasPrices, ethPrices, relayerServiceFee } = relayerStatus.data
    assert(chainId === await web3.eth.net.getId() || chainId === '*', 'This relay is for different network')
    console.log('Relay address: ', relayerAddress)

    const decimals = isLocalRPC ? 18 : config.deployments[`chainId${chainId}`][currency].decimals
    const fee = calculateFee({ gasPrices, currency, amount, refund, ethPrices, relayerServiceFee, decimals })
    if (fee.gt(fromDecimals({ amount, decimals }))) {
      throw new Error('Too high refund')
    }
    const { proof, args } = await generateProof({ deposit, recipient, relayerAddress, fee, refund })

    console.log('Sending withdraw transaction through relay')
    try {
      const relay = await axios.post(relayerURL + '/relay', { contract: sacred._address, proof, args })
      if (chainId === 1 || chainId === 42) {
        console.log(`Transaction submitted through the relay. View transaction on etherscan https://${getCurrentNetworkName()}etherscan.io/tx/${relay.data.txHash}`)
      } else {
        console.log(`Transaction submitted through the relay. The transaction hash is ${relay.data.txHash}`)
      }

      const receipt = await waitForTxReceipt({ txHash: relay.data.txHash })
      console.log('Transaction mined in block', receipt.blockNumber)
    } catch (e) {
      if (e.response) {
        console.error(e.response.data.error)
      } else {
        console.error(e.message)
      }
    }
    */
  } else {
    // using private key
    const { proof, args } = await generateProof({ deposit, recipient, refund })

    console.log('Submitting withdraw transaction')
    try {
      const txReceipt = await sacred
        .withdraw(proof, ...args)
        .sendTransaction({
          from: senderAccount,
          value: refund.toString(),
          gas: 1.4e7,
          gasPrice: 10,
          storageLimit: 1000,
        })
        .executed()

      if (networkId === 1029 || networkId === 1) {
        console.log(
          `View transaction on confluxscan https://${getCurrentNetworkName()}confluxscan.io/transaction/${
            txReceipt.transactionHash
          }`,
        )
      } else {
        console.log(`The transaction hash is ${txReceipt.transactionHash}`)
        console.log(txReceipt)
      }
    } catch (e) {
      console.log('on transactionHash error', e)
    }
  }
  console.log('Done')
}

function fromDecimals({ amount, decimals }) {
  amount = amount.toString()
  let ether = amount.toString()
  const base = newBN('10').pow(newBN(decimals))
  const baseLength = base.toString(10).length - 1 || 1

  const negative = ether.substring(0, 1) === '-'
  if (negative) {
    ether = ether.substring(1)
  }

  if (ether === '.') {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, invalid value')
  }

  // Split it into a whole and fractional part
  const comps = ether.split('.')
  if (comps.length > 2) {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei,  too many decimal points')
  }

  let whole = comps[0]
  let fraction = comps[1]

  if (!whole) {
    whole = '0'
  }
  if (!fraction) {
    fraction = '0'
  }
  if (fraction.length > baseLength) {
    throw new Error('[ethjs-unit] while converting number ' + amount + ' to wei, too many decimal places')
  }

  while (fraction.length < baseLength) {
    fraction += '0'
  }

  whole = newBN(whole)
  fraction = newBN(fraction)
  let wei = whole.mul(base).add(fraction)

  if (negative) {
    wei = wei.mul(negative)
  }

  return newBN(wei.toString(10), 10)
}

function toDecimals(value, decimals, fixed) {
  const zero = newBN(0)
  const negative1 = newBN(-1)
  decimals = decimals || 18
  fixed = fixed || 7

  value = newBN(value)
  const negative = value.lt(zero)
  const base = newBN('10').pow(newBN(decimals))
  const baseLength = base.toString(10).length - 1 || 1

  if (negative) {
    value = value.mul(negative1)
  }

  let fraction = value.mod(base).toString(10)
  while (fraction.length < baseLength) {
    fraction = `0${fraction}`
  }
  fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1]

  const whole = value.div(base).toString(10)
  value = `${whole}${fraction === '0' ? '' : `.${fraction}`}`

  if (negative) {
    value = `-${value}`
  }

  if (fixed) {
    value = value.slice(0, fixed)
  }

  return value
}

function getCurrentNetworkName() {
  switch (networkId) {
    case 1029:
      return ''
    case 1:
      return 'testnet.'
  }
}

/*
function calculateFee({ gasPrices, currency, amount, refund, ethPrices, relayerServiceFee, decimals }) {
  const decimalsPoint = Math.floor(relayerServiceFee) === Number(relayerServiceFee) ?
    0 :
    relayerServiceFee.toString().split('.')[1].length
  const roundDecimal = 10 ** decimalsPoint
  const total = toBN(fromDecimals({ amount, decimals }))
  const feePercent = total.mul(toBN(relayerServiceFee * roundDecimal)).div(toBN(roundDecimal * 100))
  const expense = toBN(toWei(gasPrices.fast.toString(), 'gwei')).mul(toBN(5e5))
  let desiredFee
  switch (currency) {
  case 'eth': {
    desiredFee = expense.add(feePercent)
    break
  }
  default: {
    desiredFee = expense.add(toBN(refund))
      .mul(toBN(10 ** decimals))
      .div(toBN(ethPrices[currency]))
    desiredFee = desiredFee.add(feePercent)
    break
  }
  }
  return desiredFee
}
*/

/**
 * Waits for transaction to be mined
 * @param txHash Hash of transaction
 * @param attempts
 * @param delay
 */
/*
function waitForTxReceipt({ txHash, attempts = 60, delay = 1000 }) {
  return new Promise((resolve, reject) => {
    const checkForTx = async (txHash, retryAttempt = 0) => {
      const result = await web3.eth.getTransactionReceipt(txHash)
      if (!result || !result.blockNumber) {
        if (retryAttempt <= attempts) {
          setTimeout(() => checkForTx(txHash, retryAttempt + 1), delay)
        } else {
          reject(new Error('tx was not mined'))
        }
      } else {
        resolve(result)
      }
    }
    checkForTx(txHash)
  })
}
*/

/**
 * Parses Sacred.cash note
 * @param noteString the note
 */
function parseNote(noteString) {
  const noteRegex = /sacred-(?<currency>\w+)-(?<amount>[\d.]+)-(?<netId>\d+)-0x(?<note>[0-9a-fA-F]{124})/g
  const match = noteRegex.exec(noteString)
  if (!match) {
    throw new Error('The note has invalid format')
  }

  const buf = Buffer.from(match.groups.note, 'hex')
  const nullifier = bigInt.leBuff2int(buf.slice(0, 31))
  const secret = bigInt.leBuff2int(buf.slice(31, 62))
  const deposit = createDeposit({ nullifier, secret })
  const netId = Number(match.groups.netId)

  return { currency: match.groups.currency, amount: match.groups.amount, netId, deposit }
}

/*
async function loadDepositData({ deposit }) {
  try {
    const eventWhenHappened = await sacred.getPastEvents('Deposit', {
      filter: {
        commitment: deposit.commitmentHex
      },
      fromBlock: 0,
      toBlock: 'latest'
    })
    if (eventWhenHappened.length === 0) {
      throw new Error('There is no related deposit, the note is invalid')
    }

    const { timestamp } = eventWhenHappened[0].returnValues
    const txHash = eventWhenHappened[0].transactionHash
    const isSpent = await sacred.methods.isSpent(deposit.nullifierHex).call()
    const receipt = await web3.eth.getTransactionReceipt(txHash)

    return { timestamp, txHash, isSpent, from: receipt.from, commitment: deposit.commitmentHex }
  } catch (e) {
    console.error('loadDepositData', e)
  }
  return {}
}
async function loadWithdrawalData({ amount, currency, deposit }) {
  try {
    const events = await await sacred.getPastEvents('Withdrawal', {
      fromBlock: 0,
      toBlock: 'latest'
    })

    const withdrawEvent = events.filter((event) => {
      return event.returnValues.nullifierHash === deposit.nullifierHex
    })[0]

    const fee = withdrawEvent.returnValues.fee
    const decimals = config.deployments[`chainId${chainId}`][currency].decimals
    const withdrawalAmount = toBN(fromDecimals({ amount, decimals })).sub(
      toBN(fee)
    )
    const { timestamp } = await web3.eth.getBlock(withdrawEvent.blockHash)
    return {
      amount: toDecimals(withdrawalAmount, decimals, 9),
      txHash: withdrawEvent.transactionHash,
      to: withdrawEvent.returnValues.to,
      timestamp,
      nullifier: deposit.nullifierHex,
      fee: toDecimals(fee, decimals, 9)
    }
  } catch (e) {
    console.error('loadWithdrawalData', e)
  }
}
*/

/**
 * Init js-conflux-sdk, contracts, and snark
 */
async function init({ rpc, noteChainId, currency = 'dai', amount = '100' }) {
  let contractJson, erc20ContractJson, erc20sacredJson, sacredAddress, tokenAddress
  // Initialize from local node
  conflux = new Conflux({ url: rpc })
  await conflux.updateNetworkId()
  contractJson = require('./build/contracts/CFXSacred.json')
  circuit = require('./build/circuits/WithdrawAsset.json')
  proving_key = fs.readFileSync('build/circuits/WithdrawAsset_proving_key.bin').buffer
  MERKLE_TREE_HEIGHT = process.env.MERKLE_TREE_HEIGHT || 20
  CFX_AMOUNT = process.env.CFX_AMOUNT
  TOKEN_AMOUNT = process.env.TOKEN_AMOUNT
  PRIVATE_KEY = process.env.PRIVATE_KEY
  if (PRIVATE_KEY) {
    let priv_key = PRIVATE_KEY
    if (!priv_key.startsWith('0x')) priv_key = '0x' + PRIVATE_KEY
    senderAccount = conflux.wallet.addPrivateKey(priv_key).address
  } else {
    console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit')
  }
  erc20ContractJson = require('./build/contracts/ERC20Mock.json')
  erc20sacredJson = require('./build/contracts/ERC20Sacred.json')
  // groth16 initialises a lot of Promises that will never be resolved, that's why we need to use process.exit to terminate the CLI
  groth16 = await buildGroth16()
  let status = await conflux.getStatus()
  chainId = status['chainId']
  if (noteChainId && Number(noteChainId) !== chainId) {
    throw new Error('This note is for a different network. Specify the --rpc option explicitly')
  }
  isLocalRPC = chainId != 1029 && chainId != 1 // && chainId != 443
  networkId = chainId

  if (isLocalRPC) {
    // networkId += 10000 // dirty hack for current cfx-truffle
    sacredAddress =
      currency === 'cfx'
        ? contractJson.networks[networkId].address
        : erc20sacredJson.networks[networkId].address
    tokenAddress = currency !== 'cfx' ? erc20ContractJson.networks[networkId].address : null
    console.log(sacredAddress)
    let senderAccounts = await conflux.provider.call('accounts')
    if (senderAccounts.length > 0) {
      senderAccount = senderAccounts[0]
    }
  } else {
    try {
      sacredAddress = config.cfx_deployments[`netId${networkId}`][currency].instanceAddress[amount]
      if (!sacredAddress) {
        throw new Error()
      }
      if (currency !== 'cfx') {
        tokenAddress = config.cfx_deployments[`netId${networkId}`][currency].tokenAddress
      }
    } catch (e) {
      console.error('There is no such sacred instance, check the currency and amount you provide')
      process.exit(1)
    }
  }
  sacred = conflux.Contract({ abi: contractJson.abi, address: sacredAddress })
  erc20 = currency !== 'cfx' ? conflux.Contract({ abi: erc20ContractJson.abi, address: tokenAddress }) : {}
}

async function main() {
  program
    .option('-r, --rpc <URL>', 'The RPC, CLI should interact with', 'http://localhost:12537')
    .option('-R, --relayer <URL>', 'Withdraw via relayer')
  program
    .command('deposit <currency> <amount>')
    .description(
      'Submit a deposit of specified currency and amount from default cfx account and return the resulting note. The currency is one of (CFX|cUSDT|FC|?). The amount depends on currency, see config.js file.',
    )
    .action(async (currency, amount) => {
      currency = currency.toLowerCase()
      await init({ rpc: program.rpc, currency, amount })
      await deposit({ currency, amount })
    })
  program
    .command('withdraw <note> <recipient> [CFX_purchase]')
    .description(
      'Withdraw a note to a recipient account using relayer or specified private key. You can exchange some of your deposit`s tokens to CFX during the withdrawal by specifing CFX_purchase (e.g. 0.01) to pay for gas in future transactions. Also see the --relayer option.',
    )
    .action(async (noteString, recipient, refund) => {
      const { currency, amount, networkId, deposit } = parseNote(noteString)
      await init({ rpc: program.rpc, noteNetworkId: networkId, currency, amount })
      await withdraw({ deposit, currency, amount, recipient, refund, relayerURL: program.relayer })
    })
  program
    .command('balance <address> [token_address]')
    .description('Check CFX and ERC20 balance')
    .action(async (address, tokenAddress) => {
      await init({ rpc: program.rpc })
      await printCFXBalance({ address, name: '' })
      if (tokenAddress) {
        await printERC20Balance({ address, name: '', tokenAddress })
      }
    })
  /*
  program
    .command('compliance <note>')
    .description('Shows the deposit and withdrawal of the provided note. This might be necessary to show the origin of assets held in your withdrawal address.')
    .action(async (noteString) => {
      const { currency, amount, networkId, deposit } = parseNote(noteString)
      await init({ rpc: program.rpc, noteNetworkId: networkId, currency, amount })
      const depositInfo = await loadDepositData({ deposit })
      const depositDate = new Date(depositInfo.timestamp * 1000)
      console.log('\n=============Deposit=================')
      console.log('Deposit     :', amount, currency)
      console.log('Date        :', depositDate.toLocaleDateString(), depositDate.toLocaleTimeString())
      console.log('From        :', `https://${getCurrentNetworkName()}confluxscan.io/address/${depositInfo.from.toLowerCase()}`)
      console.log('Transaction :', `https://${getCurrentNetworkName()}confluxscan.io/transaction/${depositInfo.txHash.toLowerCase()}`)
      console.log('Commitment  :', depositInfo.commitment)
      if (deposit.isSpent) {
        console.log('The note was not spent')
      }

      const withdrawInfo = await loadWithdrawalData({ amount, currency, deposit })
      const withdrawalDate = new Date(withdrawInfo.timestamp * 1000)
      console.log('\n=============Withdrawal==============')
      console.log('Withdrawal  :', withdrawInfo.amount, currency)
      console.log('Relayer Fee :', withdrawInfo.fee, currency)
      console.log('Date        :', withdrawalDate.toLocaleDateString(), withdrawalDate.toLocaleTimeString())
      console.log('To          :', `https://${getCurrentNetworkName()}confluxscan.io/address/${withdrawInfo.to.toLowerCase()}`)
      console.log('Transaction :', `https://${getCurrentNetworkName()}confluxscan.io/transaction/${withdrawInfo.txHash.toLowerCase()}`)
      console.log('Nullifier   :', withdrawInfo.nullifier)
    })
*/
  program
    .command('test')
    .description(
      'Perform an automated test. It deposits and withdraws one CFX and one ERC20 note. Uses conflux-rust docker.',
    )
    .action(async () => {
      console.log('Start performing CFX deposit-withdraw test')
      let currency = 'cfx'
      let amount = '0.1'
      await init({ rpc: program.rpc, currency, amount })
      let noteString = await deposit({ currency, amount })
      let parsedNote = parseNote(noteString)

      await withdraw({
        deposit: parsedNote.deposit,
        currency,
        amount,
        recipient: senderAccount,
        relayerURL: program.relayer,
      })

      console.log('\nStart performing DAI deposit-withdraw test')
      currency = 'dai'
      amount = '0.1'
      await init({ rpc: program.rpc, currency, amount })
      noteString = await deposit({ currency, amount })
      parsedNote = parseNote(noteString)
      await withdraw({
        deposit: parsedNote.deposit,
        currency,
        amount,
        recipient: senderAccount,
        refund: '0.02',
        relayerURL: program.relayer,
      })
    })
  try {
    await program.parseAsync(process.argv)
    process.exit(0)
  } catch (e) {
    console.log('Error:', e)
    process.exit(1)
  }
}

main()
