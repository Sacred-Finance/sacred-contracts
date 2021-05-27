// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../SacredTrees.sol";

contract SacredTreesMock is SacredTrees {
  uint256 public timestamp;
  uint256 public currentBlock;

  constructor(
    address _operator,
    address _hasher2,
    address _hasher3,
    uint32 _levels
  ) public SacredTrees(_operator, _hasher2, _hasher3, _levels) {}

  function setBlockNumber(uint256 _blockNumber) public {
    currentBlock = _blockNumber;
  }

  function blockNumber() public view override returns (uint256) {
    return currentBlock == 0 ? block.number : currentBlock;
  }
}
