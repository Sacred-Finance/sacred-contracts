/* global artifacts */
const Verifier = artifacts.require('./verifiers/WithdrawAssetVerifier.sol')
const { confluxTask } = require('./cfx_admin.js')

module.exports = async function (deployer) {
  return deployer.then(async () => {
    const verifier = await deployer.deploy(Verifier)
    await confluxTask(deployer, verifier)
  })
}
