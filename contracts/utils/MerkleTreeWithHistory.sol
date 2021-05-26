// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
import "../interfaces/IHasher.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

contract MerkleTreeWithHistoryUpgradeable is Initializable {
  uint256 public constant FIELD_SIZE = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
  uint256 public constant ZERO_VALUE = 18057714445064126197463363025270544038935021370379666668119966501302555028628; // = keccak256("sacred") % FIELD_SIZE

  uint32 public levels;
  IHasher public hasher; // todo immutable

  bytes32[] public filledSubtrees;
  bytes32[] public zeros;
  bytes32[] public commitmentHistory;

  uint32 public currentRootIndex;
  uint32 public nextIndex;
  uint32 public constant ROOT_HISTORY_SIZE = 10;
  bytes32[ROOT_HISTORY_SIZE] public roots;

  function initialize(uint32 _treeLevels, IHasher _hasher) public initializer {
    currentRootIndex = 0;
    nextIndex = 0;

    require(_treeLevels > 0, "_treeLevels should be greater than zero");
    require(_treeLevels < 32, "_treeLevels should be less than 32");
    levels = _treeLevels;
    hasher = _hasher;

    bytes32 currentZero = bytes32(ZERO_VALUE);
    zeros.push(currentZero);
    filledSubtrees.push(currentZero);

    for (uint32 i = 1; i < _treeLevels; i++) {
      currentZero = hashLeftRight(currentZero, currentZero);
      zeros.push(currentZero);
      filledSubtrees.push(currentZero);
    }

    filledSubtrees.push(hashLeftRight(currentZero, currentZero));
    roots[0] = filledSubtrees[_treeLevels];

    commitmentHistory = new bytes32[](0);
  }

  /**
    @dev Hash 2 tree leaves, returns poseidon(_left, _right)
  */
  function hashLeftRight(bytes32 _left, bytes32 _right) public view returns (bytes32) {
    return hasher.poseidon([_left, _right]);
  }

  function _insert(bytes32 _leaf) internal returns (uint32 index) {
    commitmentHistory.push(_leaf);
    return _insertWithoutStorage(_leaf);
  }

  function _insertWithoutStorage(bytes32 _leaf) internal returns (uint32 index) {
    uint32 currentIndex = nextIndex;
    require(currentIndex != uint32(2)**levels, "Merkle tree is full. No more leaves can be added");
    nextIndex = currentIndex + 1;
    bytes32 currentLevelHash = _leaf;
    bytes32 left;
    bytes32 right;

    for (uint32 i = 0; i < levels; i++) {
      if (currentIndex % 2 == 0) {
        left = currentLevelHash;
        right = zeros[i];
        filledSubtrees[i] = currentLevelHash;
      } else {
        left = filledSubtrees[i];
        right = currentLevelHash;
      }

      currentLevelHash = hashLeftRight(left, right);
      currentIndex /= 2;
    }

    currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
    roots[currentRootIndex] = currentLevelHash;
    return nextIndex - 1;
  }

  function _bulkInsert(bytes32[] memory _leaves) internal {
    uint32 insertIndex = nextIndex;
    require(insertIndex + _leaves.length <= uint32(2)**levels, "Merkle doesn't have enough capacity to add specified leaves");

    bytes32[] memory subtrees = new bytes32[](levels);
    bool[] memory modifiedSubtrees = new bool[](levels);
    for (uint32 j = 0; j < _leaves.length - 1; j++) {
      uint256 index = insertIndex + j;
      bytes32 currentLevelHash = _leaves[j];

      for (uint32 i = 0; ; i++) {
        if (index % 2 == 0) {
          modifiedSubtrees[i] = true;
          subtrees[i] = currentLevelHash;
          break;
        }

        if (subtrees[i] == bytes32(0)) {
          subtrees[i] = filledSubtrees[i];
        }
        currentLevelHash = hashLeftRight(subtrees[i], currentLevelHash);
        index /= 2;
      }
    }

    for (uint32 i = 0; i < levels; i++) {
      // using local map to save on gas on writes if elements were not modified
      if (modifiedSubtrees[i]) {
        filledSubtrees[i] = subtrees[i];
      }
    }

    nextIndex = uint32(insertIndex + _leaves.length - 1);
    _insert(_leaves[_leaves.length - 1]);
  }

  /**
    @dev Whether the root is present in the root history
  */
  function isKnownRoot(bytes32 _root) public view returns (bool) {
    if (_root == 0) {
      return false;
    }
    uint32 i = currentRootIndex;
    do {
      if (_root == roots[i]) {
        return true;
      }
      if (i == 0) {
        i = ROOT_HISTORY_SIZE;
      }
      i--;
    } while (i != currentRootIndex);
    return false;
  }

  /**
    @dev Returns the last root
  */
  function getLastRoot() external view returns (bytes32) {
    return roots[currentRootIndex];
  }

  function getCommitmentHistory(uint256 _start, uint256 _end) external view returns (bytes32[] memory) {
    uint256 start = Math.min(commitmentHistory.length, _start);
    uint256 end = Math.min(commitmentHistory.length, _end);
    if (start >= end) {
      return new bytes32[](0);
    }
    bytes32[] memory leaves = new bytes32[](end - start);
    for (uint256 i = start; i < end; i++) {
      leaves[i - start] = commitmentHistory[i - start];
    }
    return leaves;
  }
}
