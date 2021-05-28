// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleTreeWithHistory.sol";

contract OwnableMerkleTree is Ownable, MerkleTreeWithHistoryUpgradeable {
  bool contractStorage;
  event UpdateContractStorage(bool value);

  constructor(uint32 _treeLevels, IHasher _hasher) public {
    MerkleTreeWithHistoryUpgradeable.initialize(_treeLevels, _hasher);
    contractStorage = true;
  }

  function insert(bytes32 _leaf) external onlyOwner returns (uint32 index) {
    if (contractStorage) {
      return _insert(_leaf);
    } else {
      return _insertWithoutStorage(_leaf);
    }
  }

  function bulkInsert(bytes32[] calldata _leaves) external onlyOwner {
    _bulkInsert(_leaves);
  }

  function setContractStorage(bool value) external onlyOwner {
    contractStorage = value;
    emit UpdateContractStorage(value);
  }
}
