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
const { getEncryptionPublicKey } = require('eth-sig-util')
const buildGroth16 = require('websnark/src/groth16')
const websnarkUtils = require('websnark/src/utils')
const toBN = format.bigInt
const newBN = format.bigInt
const { toWei } = require('web3-utils')
const config = require('./config')
const program = require('commander')
const { poseidonHash2, getExtWithdrawAssetArgsHash } = require('./src/utils')
const Note = require('./src/note')
const Controller = require('./src/controller')
const Account = require('./src/account')
const { fetchLeaves } = require('./src/leaves')

const provingKeys = {
  rewardCircuit: require('./build/circuits/Reward.json'),
  withdrawRewardCircuit: require('./build/circuits/WithdrawReward.json'),
  withdrawAssetCircuit: require('./build/circuits/WithdrawAsset.json'),
  treeUpdateCircuit: require('./build/circuits/TreeUpdate.json'),
  rewardProvingKey: fs.readFileSync('./build/circuits/Reward_proving_key.bin').buffer,
  withdrawRewardProvingKey: fs.readFileSync('./build/circuits/WithdrawReward_proving_key.bin').buffer,
  WithdrawAssetProvingKey: fs.readFileSync('./build/circuits/WithdrawAsset_proving_key.bin').buffer,
  treeUpdateProvingKey: fs.readFileSync('./build/circuits/TreeUpdate_proving_key.bin').buffer,
}

const MerkleTree = require('fixed-merkle-tree')

let sacred, register, miner, swap, logger
let proving_key, groth16, erc20, erc20_decimals, senderAccount, chainId, networkId
let MERKLE_TREE_HEIGHT, CFX_AMOUNT, TOKEN_AMOUNT, PRIVATE_KEY, PUBLIC_KEY, controller
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
  let txReceipt
  if (currency === 'cfx') {
    await printCFXBalance({ address: sacred.address, name: 'Sacred' })
    await printCFXBalance({ address: senderAccount, name: 'Sender account' })
    const value = isLocalRPC ? CFX_AMOUNT : fromDecimals({ amount, decimals: 18 })
    console.log('Submitting deposit transaction')
    txReceipt = await sacred
      .deposit(format.hexBuffer(deposit.commitment))
      .sendTransaction({ value, from: senderAccount })
      .executed()
    await printCFXBalance({ address: sacred.address, name: 'Sacred' })
    await printCFXBalance({ address: senderAccount, name: 'Sender account' })
  } else {
    // a token
    await printERC20Balance({ address: sacred.address, name: 'Sacred' })
    await printERC20Balance({ address: senderAccount, name: 'Sender account' })
    const decimals = isLocalRPC ? 18 : erc20_decimals
    const tokenAmount = isLocalRPC ? TOKEN_AMOUNT : fromDecimals({ amount, decimals })
    if (isLocalRPC) {
      console.log('Minting some test tokens to deposit')
      await erc20.mint(senderAccount, tokenAmount).sendTransaction({ from: senderAccount })
    }

    const allowance = await erc20.allowance(senderAccount, sacred.address).call({ from: senderAccount })
    console.log('Current allowance is', Drip(allowance).toCFX())
    if (toBN(allowance).lt(toBN(tokenAmount))) {
      console.log('Approving tokens for deposit')
      await erc20.approve(sacred.address, tokenAmount).sendTransaction({ from: senderAccount }).executed()
    }

    console.log('Submitting deposit transaction')

    txReceipt = await sacred
      .deposit(format.hexBuffer(deposit.commitment))
      .sendTransaction({ from: senderAccount })
      .executed()
    await printERC20Balance({ address: sacred.address, name: 'Sacred' })
    await printERC20Balance({ address: senderAccount, name: 'Sender account' })
  }

  if (networkId === 1029 || networkId === 1) {
    console.log(
      `View transaction on confluxscan https://${getCurrentNetworkName()}confluxscan.io/transaction/${
        txReceipt.transactionHash
      }`,
    )
  } else {
    console.log(`The transaction hash is ${txReceipt.transactionHash}`)
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
  const leaves = await fetchLeaves(sacred)

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

  const isValidRoot = await sacred.isKnownRoot(format.hexBuffer(toHex(root))).call()
  const isSpent = await sacred.isSpent(format.hexBuffer(deposit.nullifierHash)).call()
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
  const proofData = await websnarkUtils.genWitnessAndProve(
    groth16,
    input,
    provingKeys.withdrawAssetCircuit,
    proving_key,
  )
  const { proof } = websnarkUtils.toSolidityInput(proofData)
  console.timeEnd('Proof time')

  const args = [
    format.hexBuffer(toHex(input.root)),
    format.hexBuffer(input.nullifierHash),
    toHex(recipient, 20),
    toHex(relayerAddress, 20),
    toHex(fee),
    toHex(refund),
  ]

  return { proof: Buffer.from(proof.substr(2), 'hex'), args }
}

async function withdraw({ deposit, currency, amount, recipient, relayerURL, refund = '0' }) {
  if (currency === 'cfx' && refund !== '0') {
    throw new Error('The ETH purchase is supposted to be 0 for ETH withdrawals')
  }
  refund = toWei(refund)
  if (relayerURL) {
    throw new Error('Relayer is not supported')
  } else {
    // using private key
    const depositBlock = await sacred.commitments(format.hexBuffer(deposit.commitment))
    const withdrawBlock = await sacred.nullifierHashes(format.hexBuffer(deposit.nullifierHash))

    if (format.any(depositBlock) == 0) {
      throw new Error('Can not fine your note')
    }

    if (format.any(withdrawBlock) != 0) {
      throw new Error('Your note has been withdrawled at block ', format.any(withdrawBlock))
    }

    const { proof, args } = await generateProof({ deposit, recipient, refund })

    console.log('Submitting withdraw transaction')
    try {
      const txReceipt = await sacred
        .withdraw(proof, ...args)
        .sendTransaction({
          from: senderAccount,
          value: refund.toString(),
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
      }
    } catch (e) {
      console.log('on transactionHash error', e)
    }
  }
}

async function reward({ noteString, account }) {
  const { deposit } = parseNote(noteString)

  const depositBlock = await sacred.commitments(format.hexBuffer(deposit.commitment))
  const withdrawBlock = await sacred.nullifierHashes(format.hexBuffer(deposit.nullifierHash))

  if (format.any(depositBlock) == 0) {
    throw Error('Can not find you note')
  }

  if (format.any(withdrawBlock) == 0) {
    throw Error('The note has not been withdrawed can not receive reward.')
  }

  if (await miner.rewardNullifiers(format.hexBuffer(deposit.nullifierHash))) {
    throw Error('Reward has been already assigned.')
  }

  if (await miner.accountNullifiers(format.hexBuffer(toHex(account.nullifierHash)))) {
    throw Error('Outdated account state')
  }

  console.log('Your deposit last ', withdrawBlock - depositBlock, ' blocks')

  const note = Note.fromString(
    noteString,
    sacred.address,
    format.hex(depositBlock),
    format.hex(withdrawBlock),
  )

  var { proof, args, account } = await controller.reward({ account, note, publicKey: PUBLIC_KEY })

  proof = format.hexBuffer(proof)

  args.rewardNullifier = format.hexBuffer(args.rewardNullifier)
  args.extDataHash = format.hexBuffer(args.extDataHash)
  args.withdrawalRoot = format.hexBuffer(args.withdrawalRoot)
  args.depositRoot = format.hexBuffer(args.depositRoot)
  args.extData.encryptedAccount = format.hexBuffer(args.extData.encryptedAccount)
  args.account.inputRoot = format.hexBuffer(args.account.inputRoot)
  args.account.inputNullifierHash = format.hexBuffer(args.account.inputNullifierHash)
  args.account.outputRoot = format.hexBuffer(args.account.outputRoot)
  args.account.outputCommitment = format.hexBuffer(args.account.outputCommitment)

  console.log('Submitting reward transaction')

  var txReceipt = await miner.reward(proof, args).sendTransaction({ from: senderAccount }).executed()

  if (networkId === 1029 || networkId === 1) {
    console.log(
      `View transaction on confluxscan https://${getCurrentNetworkName()}confluxscan.io/transaction/${
        txReceipt.transactionHash
      }`,
    )
  } else {
    console.log(`The transaction hash is ${txReceipt.transactionHash}`)
  }
  console.log('Your current balance is ', account.amount.toString(), ' IC')
  console.log('Remember your recent account: ', account.encode())
  return account
}

async function swapReward({ account, amount, recipient }) {
  amount = amount || account.amount
  recipient = recipient || senderAccount
  recipient = format.hexAddress(recipient)
  var { proof, args, account } = await controller.withdraw({
    account,
    amount,
    recipient,
    publicKey: PUBLIC_KEY,
  })

  proof = format.hexBuffer(proof)

  args.extDataHash = format.hexBuffer(args.extDataHash)
  args.extData.encryptedAccount = format.hexBuffer(args.extData.encryptedAccount)
  args.account.inputRoot = format.hexBuffer(args.account.inputRoot)
  args.account.inputNullifierHash = format.hexBuffer(args.account.inputNullifierHash)
  args.account.outputRoot = format.hexBuffer(args.account.outputRoot)
  args.account.outputCommitment = format.hexBuffer(args.account.outputCommitment)

  var txReceipt = await miner.withdraw(proof, args).sendTransaction({ from: senderAccount }).executed()

  console.log('You will get ', Drip(await swap.getExpectedReturn(amount)).toCFX(), ' SRD')
  console.log('Sending swap tranaction')
  if (networkId === 1029 || networkId === 1) {
    console.log(
      `View transaction on confluxscan https://${getCurrentNetworkName()}confluxscan.io/transaction/${
        txReceipt.transactionHash
      }`,
    )
  } else {
    console.log(`The transaction hash is ${txReceipt.transactionHash}`)
  }

  console.log('Your current balance is ', account.amount.toString(), ' IC')
  console.log('Remember your recent account: ', account.encode())

  return account
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

/**
 * Init js-conflux-sdk, contracts, and snark
 */
async function init({ rpc, noteChainId, currency = 'cfx', amount = '1' }) {
  const contractJson = require('./build/contracts/CFXSacredUpgradeable.json')
  const registerJson = require('./build/contracts/Register.json')
  const erc20ContractJson = require('./build/contracts/ERC20Mock.json')
  const erc20sacredJson = require('./build/contracts/ERC20SacredUpgradeable.json')
  const minerJson = require('./build/contracts/Miner.json')
  const loggerJson = require('./build/contracts/SacredTrees.json')
  const swapJson = require('./build/contracts/RewardSwap.json')
  const loggerTreeJson = require('./build/contracts/OwnableMerkleTree.json')

  let register_addr

  // Initialize from local node
  conflux = new Conflux({ url: rpc })
  await conflux.updateNetworkId()

  noteChainId = noteChainId || conflux.networkId
  if (noteChainId != conflux.networkId) {
    throw Error('Inconsistent chain id')
  }

  proving_key = fs.readFileSync('build/circuits/WithdrawAsset_proving_key.bin').buffer
  MERKLE_TREE_HEIGHT = process.env.MERKLE_TREE_HEIGHT || 20
  PRIVATE_KEY = process.env.PRIVATE_KEY
  PUBLIC_KEY = getEncryptionPublicKey(PRIVATE_KEY.substr(2))

  if (PRIVATE_KEY) {
    let priv_key = PRIVATE_KEY
    if (!priv_key.startsWith('0x')) priv_key = '0x' + PRIVATE_KEY
    senderAccount = conflux.wallet.addPrivateKey(priv_key).address
  } else {
    console.log('Warning! PRIVATE_KEY not found. Please provide PRIVATE_KEY in .env file if you deposit')
  }

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
    let senderAccounts = await conflux.provider.call('accounts')
    if (senderAccounts.length > 0) {
      senderAccount = senderAccounts[0]
    }
    register_addr = registerJson.networks[networkId].address
  } else if (chainId == 1) {
    register_addr = process.env.CFXTEST_REGISTER
  } else if ((chainId = 1029)) {
    register_addr = process.env.CFXMAIN_REGISTER
  }

  register = conflux.Contract({ abi: registerJson.abi, address: register_addr })
  contract_name = `${amount}-${currency}`

  sacredAddress = await register.pools(contract_name)

  if (format.hexAddress(sacredAddress) == '0x0000000000000000000000000000000000000000') {
    throw new Error('No Sacred is depolyed')
  }

  if (currency !== 'cfx') {
    sacred = conflux.Contract({ abi: erc20sacredJson.abi, address: sacredAddress })
    tokenAddress = await sacred.token()
  }

  sacred = conflux.Contract({ abi: contractJson.abi, address: sacredAddress })
  erc20 = currency !== 'cfx' ? conflux.Contract({ abi: erc20ContractJson.abi, address: tokenAddress }) : {}
  erc20_decimals = currency !== 'cfx' ? await erc20.decimals() : {}

  const ContractMaker = (abi, address) => conflux.Contract({ abi, address })

  miner = ContractMaker(minerJson.abi, await register.roles('miner'))
  logger = ContractMaker(loggerJson.abi, await register.roles('logger'))
  controller = new Controller({
    contract: miner,
    sacredTreesContract: logger,
    merkleTreeHeight: MERKLE_TREE_HEIGHT,
    provingKeys,
    ContractMaker,
  })
  await controller.init()

  var swapAddr = await register.roles('swap')
  swap = conflux.Contract({ abi: swapJson.abi, address: swapAddr })
}

async function main() {
  program.option('-r, --rpc <URL>', 'The RPC, CLI should interact with', 'https://test.confluxrpc.com/')
  program
    .command('deposit <currency> <amount> [size]')
    .description(
      'Submit a deposit of specified currency and amount from default cfx account and return the resulting note. The currency is one of (CFX|cUSDT|FC|?). The amount depends on currency, see config.js file.',
    )
    .action(async (currency, amount, size) => {
      currency = currency.toLowerCase()
      size = size || 1
      await init({ rpc: program.rpc, currency, amount })
      for (var i = 0; i < size; i++) {
        try {
          console.log('Index: ', i)
          await deposit({ currency, amount })
        } catch (e) {
          console.log(e)
        }
      }
    })
  program
    .command('withdraw <note> [recipient] [CFX_purchase]')
    .description(
      'Withdraw a note to a recipient account using relayer or specified private key. You can exchange some of your deposit`s tokens to CFX during the withdrawal by specifing CFX_purchase (e.g. 0.01) to pay for gas in future transactions. Also see the --relayer option.',
    )
    .action(async (noteString, recipient, refund) => {
      const { currency, amount, networkId, deposit } = parseNote(noteString)
      await init({ rpc: program.rpc, noteNetworkId: networkId, currency, amount })
      recipient = recipient || senderAccount
      await withdraw({ deposit, currency, amount, recipient, refund, relayerURL: program.relayer })
    })
  program
    .command('reward <note> [account]')
    .description(
      'Withdraw a note to a recipient account using relayer or specified private key. You can exchange some of your deposit`s tokens to CFX during the withdrawal by specifing CFX_purchase (e.g. 0.01) to pay for gas in future transactions. Also see the --relayer option.',
    )
    .action(async (noteString, accountString) => {
      const { currency, amount, networkId } = parseNote(noteString)
      await init({ rpc: program.rpc, noteNetworkId: networkId, currency, amount })

      var account = accountString === undefined ? new Account() : Account.decode(accountString)

      await reward({ account, noteString })
    })
  program
    .command('swap <account> [amount] [recipient]')
    .description('some thing')
    .action(async (accountString, amount, recipient) => {
      var account = Account.decode(accountString)

      await init({ rpc: program.rpc, noteNetworkId: 1 })
      await swapReward({ account, amount, recipient })
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
      let account = new Account()

      console.log('Start performing CFX deposit-withdraw test')
      let currency = 'cfx'
      let amount = '1'
      await init({ rpc: program.rpc, currency, amount })
      let noteString = await deposit({ currency, amount })
      let parsedNote = parseNote(noteString)

      await withdraw({
        deposit: parsedNote.deposit,
        currency,
        amount,
        recipient: senderAccount,
      })

      account = await reward({ account, noteString })

      console.log('Start performing CFX deposit-withdraw test')
      amount = '10'
      await init({ rpc: program.rpc, currency, amount })
      noteString = await deposit({ currency, amount })
      parsedNote = parseNote(noteString)

      await withdraw({
        deposit: parsedNote.deposit,
        currency,
        amount,
        recipient: senderAccount,
      })

      account = await reward({ account, noteString })

      console.log('\nStart performing DAI deposit-withdraw test')
      currency = 'daim'
      amount = '1'
      await init({ rpc: program.rpc, currency, amount })
      noteString = await deposit({ currency, amount })
      parsedNote = parseNote(noteString)
      await withdraw({
        deposit: parsedNote.deposit,
        currency,
        amount,
        recipient: senderAccount,
      })

      account = await swapReward({ account, amount: 5, recipient: senderAccount })
      account = await swapReward({ account, amount: 5, recipient: senderAccount })
      account = await swapReward({ account, recipient: senderAccount })
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
