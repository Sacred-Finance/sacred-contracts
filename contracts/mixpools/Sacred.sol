// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "../utils/MerkleTreeWithHistory.sol";
import "../interfaces/IVerifier.sol";
import "../interfaces/ISacredTrees.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../utils/FakeCNS.sol";

abstract contract SacredUpgradeable is MerkleTreeWithHistoryUpgradeable, ReentrancyGuardUpgradeable, CnsResolve {
  uint256 public denomination;
  uint256 public deposited_balance;

  using SafeMath for uint256;

  mapping(bytes32 => bool) public nullifierHashes;
  // we store all commitments just to prevent accidental deposits with the same commitment
  mapping(bytes32 => bool) public commitments;
  //
  IVerifier public verifier;
  ISacredTrees public logger;

  event ChangeOperator(address operator);

  struct WithdrawAssetExtData {
    address recipient;
    address relayer;
    uint256 fee;
    uint256 refund;
  }

  // operator can update snark verification key
  // after the final trusted setup ceremony operator rights are supposed to be transferred to zero address
  address public operator;
  modifier onlyOperator {
    require(msg.sender == operator, "Only operator can call this function.");
    _;
  }

  event Deposit(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);
  event Withdrawal(address to, bytes32 nullifierHash, address indexed relayer, uint256 fee);
  event EncryptedNote(address indexed sender, bytes encryptedNote);

  /**
    @dev The constructor
    @param _verifier the address of SNARK verifier for this contract
    @param _denomination transfer amount for each deposit
    @param _merkleTreeHeight the height of deposits' Merkle Tree
    @param _operator operator address (see operator comment above)
  */
  function initialize(
    IVerifier _verifier,
    IHasher _hasher,
    ISacredTrees _logger,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    address _operator
  ) public initializer {
    MerkleTreeWithHistoryUpgradeable.initialize(_merkleTreeHeight, _hasher);
    __ReentrancyGuard_init();
    require(_denomination > 0, "denomination should be greater than 0");
    verifier = _verifier;
    logger = _logger;
    operator = _operator;
    denomination = _denomination;
    deposited_balance = 0;
  }

  /**
    @dev Deposit funds into the contract. The caller must send (for ETH) or approve (for ERC20) value equal to or `denomination` of this instance.
    @param _commitment the note commitment, which is PedersenHash(nullifier + secret)
  */
  function deposit(bytes32 _commitment) public payable nonReentrant {
    require(!commitments[_commitment], "The commitment has been submitted");

    uint32 insertedIndex = _insert(_commitment);
    commitments[_commitment] = true;
    _processDeposit();

    emit Deposit(_commitment, insertedIndex, block.timestamp);
    deposited_balance = deposited_balance.add(denomination);
    logger.registerDeposit(address(this), _commitment);
  }

  /**
    @dev Deposit with encrypt note

    We do not require nonReentrant here because the inner call has such modifier.
   */
  function deposit(bytes32 _commitment, bytes calldata _encryptedNote) external payable {
    deposit(_commitment);
    emit EncryptedNote(msg.sender, _encryptedNote);
  }

  /** @dev this function is defined in a child contract */
  function _processDeposit() internal virtual;

  /**
    @dev Withdraw a deposit from the contract. `proof` is a zkSNARK proof data, and input is an array of circuit public inputs
    `input` array consists of:
      - merkle root of all deposits in the contract
      - hash of unique deposit nullifier to prevent double spends
      - the recipient of funds
      - optional fee that goes to the transaction sender (usually a relay)
  */
  function withdraw(
    bytes calldata _proof,
    bytes32 _root,
    bytes32 _nullifierHash,
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) external payable nonReentrant {
    WithdrawAssetExtData memory extData = WithdrawAssetExtData({
      recipient: _recipient,
      relayer: _relayer,
      fee: _fee,
      refund: _refund
    });
    bytes32 extDataHash = keccak248(abi.encode(extData));

    require(_fee <= denomination, "Fee exceeds transfer value");
    require(!nullifierHashes[_nullifierHash], "The note has been already spent");
    require(isKnownRoot(_root), "Cannot find your merkle root"); // Make sure to use a recent one
    require(
      verifier.verifyProof(_proof, [uint256(_root), uint256(_nullifierHash), uint256(extDataHash)]),
      "Invalid withdraw proof"
    );

    nullifierHashes[_nullifierHash] = true;
    _processWithdraw(_recipient, _relayer, _fee, _refund);
    emit Withdrawal(_recipient, _nullifierHash, _relayer, _fee);

    require(deposited_balance >= denomination, "Not enough balance to withdraw.");
    deposited_balance = deposited_balance.sub(denomination);
    logger.registerWithdrawal(address(this), _nullifierHash);
  }

  /** @dev this function is defined in a child contract */
  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal virtual;

  /** @dev whether a note is already spent */
  function isSpent(bytes32 _nullifierHash) public view returns (bool) {
    return nullifierHashes[_nullifierHash];
  }

  /** @dev whether an array of notes is already spent */
  function isSpentArray(bytes32[] calldata _nullifierHashes) external view returns (bool[] memory spent) {
    spent = new bool[](_nullifierHashes.length);
    for (uint256 i = 0; i < _nullifierHashes.length; i++) {
      if (isSpent(_nullifierHashes[i])) {
        spent[i] = true;
      }
    }
  }

  /**
    @dev allow operator to update SNARK verification keys. This is needed to update keys after the final trusted setup ceremony is held.
    After that operator rights are supposed to be transferred to zero address
  */
  function updateVerifier(address _newVerifier) external onlyOperator {
    verifier = IVerifier(_newVerifier);
  }

  function updateLogger(address _newLogger) external onlyOperator {
    logger = ISacredTrees(_newLogger);
  }

  /** @dev operator can change his address */
  function changeOperator(address _newOperator) external onlyOperator {
    require(_newOperator != address(0), "The operator can not be set to ZERO address");
    operator = _newOperator;
    emit ChangeOperator(_newOperator);
  }

  // -----INTERNAL-------

  function keccak248(bytes memory _data) internal pure returns (bytes32) {
    return keccak256(_data) & 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
  }
}
