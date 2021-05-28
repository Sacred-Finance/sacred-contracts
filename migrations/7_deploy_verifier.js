/* global artifacts */
const Verifier0 = artifacts.require('./verifiers/RewardVerifier.sol')
const Verifier1 = artifacts.require('./verifiers/WithdrawRewardVerifier.sol')
const Verifier2 = artifacts.require('./verifiers/TreeUpdateVerifier.sol')

const { format } = require('js-conflux-sdk')
const zero_address = '0x0000000000000000000000000000000000000000'

const { confluxTask } = require('./cfx_admin.js')
const Register = artifacts.require('Register')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    const register = await Register.deployed()

    if (format.hexAddress(await register.roles('treeUpdateVerifier')) != zero_address) {
      return
    }

    const verifier0 = await deployer.deploy(Verifier0)
    const verifier1 = await deployer.deploy(Verifier1)
    const verifier2 = await deployer.deploy(Verifier2)

    await register.setRole('rewardVerifier', verifier0.address)
    await register.setRole('withdrawRewardVerifier', verifier1.address)
    await register.setRole('treeUpdateVerifier', verifier2.address)

    await confluxTask(verifier0, deployer)
    await confluxTask(verifier1, deployer)
    await confluxTask(verifier2, deployer)
  })
}
