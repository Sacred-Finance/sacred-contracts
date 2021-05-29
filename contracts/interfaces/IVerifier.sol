// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

interface IVerifier {
  function verifyProof(bytes calldata proof, uint256[4] calldata input) external view returns (bool);

  // WithdrawAsset
  function verifyProof(bytes calldata proof, uint256[3] calldata input) external view returns (bool);

  function verifyProof(bytes calldata proof, uint256[5] calldata input) external view returns (bool);

  function verifyProof(bytes calldata proof, uint256[10] calldata input) external view returns (bool);
}
