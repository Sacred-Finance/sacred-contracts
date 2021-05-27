// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../Miner.sol";

contract MinerMock is Miner {
  uint256 public timestamp;

  constructor(
    address _rewardSwap,
    address _governance,
    address _sacredTrees,
    address[3] memory verifiers,
    bytes32 _accountRoot,
    Rate[] memory _rates
  ) public {
    Miner.initialize(_rewardSwap, _governance, _sacredTrees, verifiers, _accountRoot, _rates);
  }
}
