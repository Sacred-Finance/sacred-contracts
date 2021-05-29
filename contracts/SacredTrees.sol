// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./utils/FakeCNS.sol";
import "./utils/OwnableMerkleTree.sol";
import "./interfaces/ISacredTrees.sol";
import "./interfaces/IHasher.sol";

contract SacredTrees is ISacredTrees {
  OwnableMerkleTree public immutable depositTree;
  OwnableMerkleTree public immutable withdrawalTree;
  OwnableMerkleTree public immutable accountTree;

  IHasher public immutable hasher;

  event DepositData(address instance, bytes32 indexed hash, uint256 block, uint256 index);
  event WithdrawalData(address instance, bytes32 indexed hash, uint256 block, uint256 index);
  event AccountData(bytes32 indexed hash, uint256 block, uint256 index);

  event ChangeOperator(address operator);

  struct TreeLeaf {
    address instance;
    bytes32 hash;
    uint256 block;
  }

  address public operator;
  mapping(address => bool) public sacredAddresses;

  modifier onlyOperator {
    require(msg.sender == operator, "Only operator can call this function.");
    _;
  }

  // Here we do not revert the contract in case the sender is not in known sacred address.
  // Because we don't want the operator of this contract can block the withdraw of sacred address.
  modifier onlySacred {
    if (sacredAddresses[msg.sender] || msg.sender == operator) {
      _;
    }
  }

  constructor(
    address _operator,
    address _hasher2,
    address _hasher3,
    uint32 _levels
  ) public {
    operator = _operator;
    hasher = IHasher(_hasher3);
    depositTree = new OwnableMerkleTree(_levels, IHasher(_hasher2));
    withdrawalTree = new OwnableMerkleTree(_levels, IHasher(_hasher2));
    accountTree = new OwnableMerkleTree(_levels, IHasher(_hasher2));
  }

  function registerDeposit(address _instance, bytes32 _commitment) external override onlySacred {
    bytes32 leaf = hasher.poseidon([bytes32(uint256(_instance)), _commitment, bytes32(blockNumber())]);
    uint32 index = depositTree.insert(leaf);
    emit DepositData(_instance, _commitment, blockNumber(), uint256(index));
  }

  function registerWithdrawal(address _instance, bytes32 _nullifier) external override onlySacred {
    bytes32 leaf = hasher.poseidon([bytes32(uint256(_instance)), _nullifier, bytes32(blockNumber())]);
    uint32 index = withdrawalTree.insert(leaf);
    emit WithdrawalData(_instance, _nullifier, blockNumber(), uint256(index));
  }

  function registerAccount(bytes32 _commitment) external override {
    bytes32 leaf = _commitment;
    uint32 index = accountTree.insert(leaf);
    emit AccountData(_commitment, blockNumber(), uint256(index));
  }

  function setSacredAddresses(address sacred) public onlyOperator {
    sacredAddresses[sacred] = true;
  }

  // Should we allow the operator unset some sacred addresses?
  function unsetSacredAddresses(address sacred) public onlyOperator {
    sacredAddresses[sacred] = false;
  }

  function validateRoots(bytes32 _depositRoot, bytes32 _withdrawalRoot, bytes32 _accountRoot) public view {
    require(depositTree.isKnownRoot(_depositRoot), "Incorrect deposit tree root");
    require(withdrawalTree.isKnownRoot(_withdrawalRoot), "Incorrect withdrawal tree root");
    require(accountTree.isKnownRoot(_accountRoot), "Incorrect account tree root");
  }

  function depositRoot() external view returns (bytes32) {
    return depositTree.getLastRoot();
  }

  function withdrawalRoot() external view returns (bytes32) {
    return withdrawalTree.getLastRoot();
  }

  function withdrawalTreeSize() external view returns (uint32) {
    return withdrawalTree.nextIndex();
  }

  function depositTreeSize() external view returns (uint32) {
    return depositTree.nextIndex();
  }

  function blockNumber() public view virtual returns (uint256) {
    return block.number;
  }

  /** @dev operator can change his address */
  function changeOperator(address _newOperator) external onlyOperator {
    require(_newOperator != address(0), "The operator can not be set to ZERO address");
    operator = _newOperator;
    emit ChangeOperator(_newOperator);
  }
}
