// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./Sacred.sol";
import "../conflux/AutoStaking.sol";

contract CFXSacredV1 is AutoStaking, SacredV1 {
  function _processDeposit() internal virtual override autoStaking {
    require(msg.value == denomination, "Please send `mixDenomination` CFX along with transaction");
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal virtual override autoStaking {
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

  function withdraw_interest(address payable _to, uint256 _balance) external onlyOperator autoStaking {
    require(address(this).balance >= deposited_balance.add(_balance));
    (bool success, ) = _to.call{ value: _balance }("");
    require(success, "payment to _to did not go thru");
  }

  function withdraw_all_interest(address payable _to) external onlyOperator autoStaking {
    require(deposited_balance == 0, "This function can be call only if all the commitments are withdrawal");

    (bool success, ) = _to.call{ value: address(this).balance }("");

    require(success, "payment to _to did not go thru");
  }
}
