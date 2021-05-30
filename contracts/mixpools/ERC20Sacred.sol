// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "./Sacred.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract ERC20SacredV1 is SacredV1 {
  using SafeERC20 for IERC20;

  function _processDeposit() internal virtual override {
    require(msg.value == 0, "ETH value is supposed to be 0 for ERC20 instance");
    token.transferFrom(msg.sender, address(this), denomination);
  }

  function _processWithdraw(
    address payable _recipient,
    address payable _relayer,
    uint256 _fee,
    uint256 _refund
  ) internal virtual override {
    require(msg.value == _refund, "Incorrect refund amount received by the contract");

    token.transfer(_recipient, denomination - _fee);

    if (_fee > 0) {
      token.transfer(_relayer, _fee);
    }

    if (_refund > 0) {
      (bool success, ) = _recipient.call{ value: _refund }("");
      if (!success) {
        // let's return _refund back to the relayer
        _relayer.transfer(_refund);
      }
    }
  }
}
