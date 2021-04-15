// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./Sacred.sol";
import "./conflux/Staking.sol";

contract CFXSacred is Sacred {
  Staking public constant STAKING = Staking(address(0x0888000000000000000000000000000000000002));

  event NotStaking();

  constructor(
    IVerifier _verifier,
    IHasher _hasher,
    ISacredTrees _logger,
    uint256 _denomination,
    uint32 _merkleTreeHeight,
    address _operator
  ) public payable Sacred(_verifier, _hasher, _logger, _denomination, _merkleTreeHeight, _operator) {
    STAKING.deposit(address(this).balance);
  }

  modifier claimStaking {
    uint256 staking_balance = STAKING.getStakingBalance(address(this));
    STAKING.withdraw(staking_balance);
    _;
    (bool success, ) = address(STAKING).call(
      abi.encodeWithSelector(
        0xb6b55f25, /* deposit */
        address(this).balance
      )
    );
    if (!success) {
      // Throw an event for warning
      NotStaking();
    }
  }

  function _processDeposit() internal virtual override claimStaking {
    require(msg.value == denomination, "Please send `mixDenomination` CFX along with transaction");
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal virtual override claimStaking {
    // sanity checks
    require(msg.value == 0, "Message value is supposed to be zero for CFX instance");
    require(_refund == 0, "Refund value is supposed to be zero for CFX instance");

    (bool success, ) = _recipient.call{ value: denomination.sub(_fee) }("");
    require(success, "payment to _recipient did not go thru");
    if (_fee > 0) {
      (success, ) = _relayer.call{ value: _fee }("");
      require(success, "payment to _relayer did not go thru");
    }
  }

  function withdraw_interest(address payable _to, uint256 _balance) external onlyOperator claimStaking {
    require(address(this).balance >= deposited_balance.add(_balance).add(1 ether));
    (bool success, ) = _to.call{ value: _balance }("");
    require(success, "payment to _to did not go thru");
  }

  function withdraw_all_interest(address payable _to) external onlyOperator claimStaking {
    require(deposited_balance == 0, "This function can be call only if all the commitments are withdrawal");

    (bool success, ) = _to.call{ value: address(this).balance.sub(1 ether) }("");

    require(success, "payment to _to did not go thru");
  }
}
