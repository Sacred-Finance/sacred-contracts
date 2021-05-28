function methods(contract) {
  if (contract.methods === undefined) {
    return contract
  } else {
    return contract.methods
  }
}
function address(contract) {
  if (contract.address === undefined) {
    return contract.options.address
  } else {
    return contract.address
  }
}
module.exports = { methods, address }
