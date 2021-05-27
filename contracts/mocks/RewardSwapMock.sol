// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
import "../RewardSwap.sol";

contract RewardSwapMock is RewardSwap {
  uint256 public timestamp;

  constructor(
    address _sacred,
    address _miner,
    uint256 _miningCap,
    uint256 _initialLiquidity,
    uint256 _poolWeight
  ) public {
    RewardSwap.initialize();
    RewardSwap.setup(_sacred, _miner, _miningCap, _initialLiquidity, _poolWeight);
    timestamp = block.timestamp;
  }

  function setTimestamp(uint256 _timestamp) public {
    timestamp = _timestamp;
  }

  function getTimestamp() public view override returns (uint256) {
    if (timestamp == 0) {
      return block.timestamp;
    }
    return timestamp;
  }
}
