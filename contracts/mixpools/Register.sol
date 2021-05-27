// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IVerifier.sol";
import "../SacredTrees.sol";
import "../interfaces/IHasher.sol";
import "@openzeppelin/contracts/proxy/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/ProxyAdmin.sol";

import "./CFXSacred.sol";
import "./ERC20Sacred.sol";

contract Register is Ownable {
  mapping(string => address) public pools;
  string[] public poolNames;

  event Update(string _type, address _address);

  IVerifier public verifier;
  IHasher public hasher;
  ISacredTrees public logger;
  ProxyAdmin public admin;

  constructor(
    IVerifier _verifier,
    IHasher _hasher,
    ISacredTrees _logger,
    ProxyAdmin _admin
  ) public {
    verifier = _verifier;
    hasher = _hasher;
    logger = _logger;
    admin = _admin;
  }

  event NewPool(address indexed token, uint256 indexed denomination, address addr, string name);

  function registerPool(
    address _token,
    uint256 _denomination,
    address _address,
    string memory _name,
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

  function updateIVerifier(address _verifier) external onlyOwner {
    verifier = IVerifier(_verifier);
    emit Update("verifier", _verifier);
  }

  function updateIHasher(address _hasher) external onlyOwner {
    hasher = IHasher(_hasher);
    emit Update("hasher", _hasher);
  }

  function updateISacredTrees(address _logger) external onlyOwner {
    logger = ISacredTrees(_logger);
    emit Update("logger", _logger);
  }

  function updateProxyAdmin(address _admin) external onlyOwner {
    admin = ProxyAdmin(_admin);
    emit Update("admin", _admin);
  }
}
