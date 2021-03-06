// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../utils/MerkleTreeWithHistory.sol";

contract MerkleTreeWithHistoryMock is MerkleTreeWithHistoryUpgradeable {
  constructor(uint32 _treeLevels, IHasher _hasher) public {
    MerkleTreeWithHistoryUpgradeable.initialize(_treeLevels, _hasher);
  }

  function insert(bytes32 _leaf) external returns (uint32 index) {
    return _insert(_leaf);
  }

  function bulkInsert(bytes32[] memory _leaves) external {
    _bulkInsert(_leaves);
  }
}
