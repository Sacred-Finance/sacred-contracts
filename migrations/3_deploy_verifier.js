/* global artifacts */
const Verifier = artifacts.require('./verifiers/WithdrawAssetVerifier.sol')
const { confluxTask } = require('./conflux_utils.js')
const Register = artifacts.require('Register')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    const verifier = await deployer.deploy(Verifier)

    const register = await Register.deployed()
    await register.setRole('withdrawAssetVerifier', verifier.address)

    await confluxTask(verifier, deployer)
  })
}
