const { toBN, toHex } = require('web3-utils')
const { format } = require('js-conflux-sdk')
const Web3 = require('web3')
const {
  bitsToNumber,
  toFixedHex,
  poseidonHash,
  poseidonHash2,
  getExtRewardArgsHash,
  getExtWithdrawRewardArgsHash,
  packEncryptedMessage,
  RewardArgs,
} = require('./utils')
const { methods, address } = require('./adapter')
const Account = require('./account')
const MerkleTree = require('fixed-merkle-tree')
const websnarkUtils = require('websnark/src/utils')
const buildGroth16 = require('websnark/src/groth16')
const fetchLeavesJson = require('../build/contracts/IFetchLeaves.json')
const { fetchLeaves } = require('./leaves')

const web3 = new Web3()

class Controller {
  constructor({ contract, sacredTreesContract, merkleTreeHeight, provingKeys, groth16, ContractMaker }) {
    this.merkleTreeHeight = Number(merkleTreeHeight)
    this.provingKeys = provingKeys
    this.contract = contract
    this.sacredTreesContract = sacredTreesContract
    this.groth16 = groth16
    this.ContractMaker = ContractMaker
  }

  async init() {
    this.groth16 = await buildGroth16()

    this.depositTree = this.ContractMaker(
      fetchLeavesJson.abi,
      await methods(this.sacredTreesContract).depositTree().call(),
    )
    this.withdrawalTree = this.ContractMaker(
      fetchLeavesJson.abi,
      await methods(this.sacredTreesContract).withdrawalTree().call(),
    )
    this.accountTree = this.ContractMaker(
      fetchLeavesJson.abi,
      await methods(this.sacredTreesContract).accountTree().call(),
    )
  }

  async _fetchAccountCommitments() {
    return (await fetchLeaves(this.accountTree)).map((e) => toBN(e))
  }

  async _fetchDepositLeaves() {
    return await fetchLeaves(this.depositTree)
  }

  async _fetchWithdrawalLeaves() {
    return await fetchLeaves(this.withdrawalTree)
  }

  // _fetchDepositDataEvents() {
  //   return this._fetchEvents('DepositData')
  // }

  // _fetchWithdrawalDataEvents() {
  //   return this._fetchEvents('WithdrawalData')
  // }

  // async _fetchEvents(eventName) {
  //   const events = await this.sacredTreesContract.getPastEvents(eventName, {
  //     fromBlock: 0,
  //     toBlock: 'latest',
  //   })
  //   return events
  //     .sort((a, b) => a.returnValues.index - b.returnValues.index)
  //     .map((e) => ({
  //       instance: toFixedHex(e.returnValues.instance, 20),
  //       hash: toFixedHex(e.returnValues.hash),
  //       block: Number(e.returnValues.block),
  //       index: Number(e.returnValues.index),
  //     }))
  // }

  _updateTree(tree, element) {
    const oldRoot = tree.root()
    tree.insert(element)
    const newRoot = tree.root()
    const { pathElements, pathIndices } = tree.path(tree.elements().length - 1)
    return {
      oldRoot,
      newRoot,
      pathElements,
      pathIndices: bitsToNumber(pathIndices),
    }
  }

  async batchReward({ account, notes, publicKey, fee = 0, relayer = 0 }) {
    const accountCommitments = await this._fetchAccountCommitments()
    let lastAccount = account
    const proofs = []
    for (const note of notes) {
      const proof = await this.reward({
        account: lastAccount,
        note,
        publicKey,
        fee,
        relayer,
        accountCommitments: accountCommitments.slice(),
      })
      proofs.push(proof)
      lastAccount = proof.account
      accountCommitments.push(lastAccount.commitment)
    }
    const args = proofs.map((x) => web3.eth.abi.encodeParameters(['bytes', RewardArgs], [x.proof, x.args]))
    return { proofs, args }
  }

  async reward({ account, note, publicKey, fee = 0, relayer = 0, accountCommitments = null }) {
    var rate = await methods(this.contract).rates(note.instance).call()

    if (typeof rate === 'string' || rate instanceof String) {
      rate = toHex(rate)
    } else {
      rate = format.hex(rate)
    }

    const newAmount = account.amount.add(
      toBN(toHex(rate))
        .mul(toBN(note.withdrawalBlock).sub(toBN(note.depositBlock)))
        .sub(toBN(fee)),
    )
    const newAccount = new Account({ amount: newAmount })

    // const depositDataEvents = await this._fetchDepositDataEvents()
    const depositLeaves = await this._fetchDepositLeaves()
    // depositDataEvents.map((x) => poseidonHash([x.instance, x.hash, x.block]))
    const depositTree = new MerkleTree(this.merkleTreeHeight, depositLeaves, {
      hashFunction: poseidonHash2,
      zeroElement: '18057714445064126197463363025270544038935021370379666668119966501302555028628',
    })
    const depositLeaf = poseidonHash([
      toFixedHex(note.instance, 20),
      toFixedHex(note.commitment),
      Number(note.depositBlock),
    ])
    const depositIndex = depositLeaves.findIndex((x) => x === toFixedHex(depositLeaf))
    if (depositIndex === -1) {
      throw new Error(
        'The deposits tree does not contain such note commitment. Please check if your note is deposited before enabling Incognito Mining.',
      )
    }
    const depositPath = depositTree.path(depositIndex)

    // const withdrawalDataEvents = await this._fetchWithdrawalDataEvents()
    const withdrawalLeaves = await this._fetchWithdrawalLeaves()
    const withdrawalTree = new MerkleTree(this.merkleTreeHeight, withdrawalLeaves, {
      hashFunction: poseidonHash2,
      zeroElement: '18057714445064126197463363025270544038935021370379666668119966501302555028628',
    })
    const withdrawalLeaf = poseidonHash([
      toFixedHex(note.instance, 20),
      toFixedHex(note.nullifierHash),
      Number(note.withdrawalBlock),
    ])
    const withdrawalIndex = withdrawalLeaves.findIndex((x) => x === toFixedHex(withdrawalLeaf))
    if (withdrawalIndex === -1) {
      throw new Error('The withdrawals tree does not contain such note nullifier')
    }
    const withdrawalPath = withdrawalTree.path(withdrawalIndex)

    accountCommitments = accountCommitments || (await this._fetchAccountCommitments())
    const accountTree = new MerkleTree(this.merkleTreeHeight, accountCommitments, {
      hashFunction: poseidonHash2,
      zeroElement: '18057714445064126197463363025270544038935021370379666668119966501302555028628',
    })
    const zeroAccount = {
      pathElements: new Array(this.merkleTreeHeight).fill(0),
      pathIndices: new Array(this.merkleTreeHeight).fill(0),
    }
    const accountIndex = accountTree.indexOf(account.commitment, (a, b) => a.eq(b))
    const accountPath = accountIndex !== -1 ? accountTree.path(accountIndex) : zeroAccount
    // const accountTreeUpdate = this._updateTree(accountTree, newAccount.commitment)

    const encryptedAccount = packEncryptedMessage(newAccount.encrypt(publicKey))
    const extDataHash = getExtRewardArgsHash({ relayer, encryptedAccount })

    const input = {
      rate,
      fee,
      instance: note.instance,
      rewardNullifier: note.rewardNullifier,
      extDataHash,

      noteSecret: note.secret,
      noteNullifier: note.nullifier,

      inputAmount: account.amount,
      inputSecret: account.secret,
      inputNullifier: account.nullifier,
      inputRoot: accountTree.root(),
      inputPathElements: accountPath.pathElements,
      inputPathIndices: bitsToNumber(accountPath.pathIndices),
      inputNullifierHash: account.nullifierHash,

      outputAmount: newAccount.amount,
      outputSecret: newAccount.secret,
      outputNullifier: newAccount.nullifier,
      // outputRoot: accountTreeUpdate.newRoot,
      // outputPathIndices: accountTreeUpdate.pathIndices,
      // outputPathElements: accountTreeUpdate.pathElements,
      outputCommitment: newAccount.commitment,

      depositBlock: note.depositBlock,
      depositRoot: depositTree.root(),
      depositPathIndices: bitsToNumber(depositPath.pathIndices),
      depositPathElements: depositPath.pathElements,

      withdrawalBlock: note.withdrawalBlock,
      withdrawalRoot: withdrawalTree.root(),
      withdrawalPathIndices: bitsToNumber(withdrawalPath.pathIndices),
      withdrawalPathElements: withdrawalPath.pathElements,
    }

    const proofData = await websnarkUtils.genWitnessAndProve(
      this.groth16,
      input,
      this.provingKeys.rewardCircuit,
      this.provingKeys.rewardProvingKey,
    )
    const { proof } = websnarkUtils.toSolidityInput(proofData)

    const args = {
      rate: toFixedHex(input.rate),
      fee: toFixedHex(input.fee),
      instance: toFixedHex(input.instance, 20),
      rewardNullifier: toFixedHex(input.rewardNullifier),
      extDataHash: toFixedHex(input.extDataHash),
      depositRoot: toFixedHex(input.depositRoot),
      withdrawalRoot: toFixedHex(input.withdrawalRoot),
      extData: {
        relayer: toFixedHex(relayer, 20),
        encryptedAccount,
      },
      account: {
        inputRoot: toFixedHex(input.inputRoot),
        inputNullifierHash: toFixedHex(input.inputNullifierHash),
        // outputRoot: toFixedHex(input.outputRoot),
        // outputPathIndices: toFixedHex(input.outputPathIndices),
        outputCommitment: toFixedHex(input.outputCommitment),
      },
    }

    return {
      proof,
      args,
      account: newAccount,
    }
  }

  async withdraw({ account, amount, recipient, publicKey, fee = 0, relayer = 0 }) {
    const newAmount = account.amount.sub(toBN(amount)).sub(toBN(fee))
    const newAccount = new Account({ amount: newAmount })

    const accountCommitments = await this._fetchAccountCommitments()
    const accountTree = new MerkleTree(this.merkleTreeHeight, accountCommitments, {
      hashFunction: poseidonHash2,
      zeroElement: '18057714445064126197463363025270544038935021370379666668119966501302555028628',
    })
    const accountIndex = accountTree.indexOf(account.commitment, (a, b) => a.eq(b))
    if (accountIndex === -1) {
      throw new Error('The accounts tree does not contain such account commitment')
    }
    const accountPath = accountTree.path(accountIndex)
    // const accountTreeUpdate = this._updateTree(accountTree, newAccount.commitment)

    const encryptedAccount = packEncryptedMessage(newAccount.encrypt(publicKey))
    const extDataHash = getExtWithdrawRewardArgsHash({ fee, recipient, relayer, encryptedAccount })

    const input = {
      amount: toBN(amount).add(toBN(fee)),
      extDataHash,

      inputAmount: account.amount,
      inputSecret: account.secret,
      inputNullifier: account.nullifier,
      inputNullifierHash: account.nullifierHash,
      inputRoot: accountTree.root(),
      inputPathIndices: bitsToNumber(accountPath.pathIndices),
      inputPathElements: accountPath.pathElements,

      outputAmount: newAccount.amount,
      outputSecret: newAccount.secret,
      outputNullifier: newAccount.nullifier,
      // outputRoot: accountTreeUpdate.newRoot,
      // outputPathIndices: accountTreeUpdate.pathIndices,
      // outputPathElements: accountTreeUpdate.pathElements,
      outputCommitment: newAccount.commitment,
    }

    const proofData = await websnarkUtils.genWitnessAndProve(
      this.groth16,
      input,
      this.provingKeys.withdrawRewardCircuit,
      this.provingKeys.withdrawRewardProvingKey,
    )
    const { proof } = websnarkUtils.toSolidityInput(proofData)

    const args = {
      amount: toFixedHex(input.amount),
      extDataHash: toFixedHex(input.extDataHash),
      extData: {
        fee: toFixedHex(fee),
        recipient: toFixedHex(recipient, 20),
        relayer: toFixedHex(relayer, 20),
        encryptedAccount,
      },
      account: {
        inputRoot: toFixedHex(input.inputRoot),
        inputNullifierHash: toFixedHex(input.inputNullifierHash),
        // outputRoot: toFixedHex(input.outputRoot),
        // outputPathIndices: toFixedHex(input.outputPathIndices),
        outputCommitment: toFixedHex(input.outputCommitment),
      },
    }

    return {
      proof,
      args,
      account: newAccount,
    }
  }

  async treeUpdate(commitment, accountTree = null) {
    if (!accountTree) {
      const accountCommitments = await this._fetchAccountCommitments()
      accountTree = new MerkleTree(this.merkleTreeHeight, accountCommitments, {
        hashFunction: poseidonHash2,
        zeroElement: '18057714445064126197463363025270544038935021370379666668119966501302555028628',
      })
    }
    const accountTreeUpdate = this._updateTree(accountTree, commitment)

    const input = {
      oldRoot: accountTreeUpdate.oldRoot,
      newRoot: accountTreeUpdate.newRoot,
      leaf: commitment,
      pathIndices: accountTreeUpdate.pathIndices,
      pathElements: accountTreeUpdate.pathElements,
    }

    const proofData = await websnarkUtils.genWitnessAndProve(
      this.groth16,
      input,
      this.provingKeys.treeUpdateCircuit,
      this.provingKeys.treeUpdateProvingKey,
    )
    const { proof } = websnarkUtils.toSolidityInput(proofData)

    const args = {
      oldRoot: toFixedHex(input.oldRoot),
      newRoot: toFixedHex(input.newRoot),
      leaf: toFixedHex(input.leaf),
      pathIndices: toFixedHex(input.pathIndices),
    }

    return {
      proof,
      args,
    }
  }
}

module.exports = Controller
