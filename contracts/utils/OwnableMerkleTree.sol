// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleTreeWithHistory.sol";

contract OwnableMerkleTree is Ownable, MerkleTreeWithHistoryUpgradeable {
  constructor(uint32 _treeLevels, IHasher _hasher) public {
    MerkleTreeWithHistoryUpgradeable.initialize(_treeLevels, _hasher);
  }

  function insertWithoutStorage(bytes32 _leaf) external onlyOwner returns (uint32 index) {
    return _insertWithoutStorage(_leaf);
  }

  function insert(bytes32 _leaf) external onlyOwner returns (uint32 index) {
    return _insert(_leaf);
  }

  function bulkInsert(bytes32[] calldata _leaves) external onlyOwner {
    _bulkInsert(_leaves);
  }
}
