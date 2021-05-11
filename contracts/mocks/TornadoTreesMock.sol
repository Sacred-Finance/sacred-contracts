// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../SacredTrees.sol";

contract SacredTreesMock is SacredTrees {
  uint256 public timestamp;
  uint256 public currentBlock;

  constructor(
    address _operator,
    bytes32 _hasher2,
    bytes32 _hasher3,
    uint32 _levels
  ) public SacredTrees(_operator, resolve(_hasher2), resolve(_hasher3), _levels) {}

  function resolve(bytes32 _addr) public pure override returns (address) {
    return address(uint160(uint256(_addr) >> (12 * 8)));
  }

  function setBlockNumber(uint256 _blockNumber) public {
    currentBlock = _blockNumber;
  }

  function blockNumber() public view override returns (uint256) {
    return currentBlock == 0 ? block.number : currentBlock;
  }
}
