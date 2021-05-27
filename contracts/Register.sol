// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

contract Register is Ownable {
  mapping(string => address) public pools;
  string[] public poolNames;

  mapping(string => address) public roles;

  event NewRole(string indexed _role, address _address);
  event UpdateRole(string indexed _role, address _old, address _new);

  event NewPool(address indexed token, uint256 indexed denomination, address addr, string name);

  function registerPool(
    address _token,
    uint256 _denomination,
    address _address,
    string calldata _name,
    bool _override
  ) external onlyOwner {
    require(pools[_name] == address(0) || _override, "pool name has been registered");

    if (pools[_name] == address(0)) {
      poolNames.push(_name);
    }
    pools[_name] = _address;

    emit NewPool(_token, _denomination, _address, _name);
  }

  function poolSize() public view returns (uint256) {
    return poolNames.length;
  }

  function setRole(string calldata _role, address _address) external onlyOwner {
    if (roles[_role] == address(0)) {
      emit NewRole(_role, _address);
    } else {
      emit UpdateRole(_role, roles[_role], _address);
    }
    roles[_role] = _address;
  }
}
