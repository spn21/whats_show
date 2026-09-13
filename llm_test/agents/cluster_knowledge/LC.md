
## [link](https://x.com/DecurityHQ/status/1852634816099053885)

 The vulnerable contract exposed an unprotected function `setMaster` that sets an unlimited allowance from a Pancake pair to any address who calls it first.

``` solidity

function setMaster(address account) external {
    require(master = address(0), "ERC20: master already set");
    _allowances [address(_pair)] [master] = 0;
    master = account;
    _allowances [address(_pair)] [master] = ~uint256(0);
}

function syncPair() external onlyMaster {
    _pair.sync();
}

function includeInReward(address account) external onlyMaster {
    _marketersAndDevs [account] = true;
}

```

## [link] (https://x.com/DecurityHQ/status/1758153796176245220)

The vulnerability exists because the function which  exchanges NFTs for tokens does not validate that a user supplied argument "amount" is not zero.This allowed an attacker to receive free tokens by calling this function in a loop with amount=0 which sent a fixed amount of "loogn" tokens to the attacker on each iteration while not receiving any NFTs back.

``` solidity
    requirelv1 = vargl,Error('caller does not own enough NFTs'); //No validation that v1 and varg1 are not zero!
```

``` solidity

function Oxfbe81135(uint256 varge, uint256 varg1) public nonPayable {
    require(4+(msg.data. lengti4) -4 >= 64);
    0xb57(vargo);
    0xb57(varg1);
    v0,/* uint256 */ v1 = stor_0_0_19.balance0f(msg.sender,vargo).gas(msg.gas);
    require(bool(v0),0, RETURNDATASIZE()); // checks call status, propagates error data on error
    MEM[64] = MEN[64] + (RETURNDATASIZE() + 31 & ~0x1f);
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    0xb57(v1):
    require(v1 = vargl,Error('caller does not own enough NFTs'); //No validation that v1 and varg1 are not zero!
    v2,/* bool */ v3 = stor_0_0_19.isApprovedForAll(msg.sender, address(this)).gas(msg.gas);require(bool(v2),0, RETURNDATASIZE()); // checks call status, propagates error data on error 
    MEM[64] = MEM[64] +(RETURNDATASIZE() + 31 & ~0x1f);
    require(MEM[64] + RETURNDATASIZET) - MEM[64] >= 32);
    require(v3 = bool(v3));
    require(v3, Error("Contract is not authorized to manage caller's NFTs"));
    v4,/* uint256 */ v5 = _erc2@Token.balanceof(address(this)).gas(msg.gas);
    require(bool(v4)，0, RETURNDATASIZE()); // checks call status, propagates error data on error
    MEM[64] = MEN[64] + (RETURNDATASIZE() + 31 & ~0x1f);
    require(MEN[64] + RETURNDATASIZE() - MEM[64] >= 32):
    0xb57(v5);
    requirelv5 >= stor 3, Error('Insufficient ERC2O token balance in contract'11: 
    require(bool(stor 0 0 19.code.size));
    v6 = stor_o_o_19.safeTransferFrom(msg.sender, address(this), vargo, varg1).gas(msg.gas); //We send zero tokens
    require(booL(v6), 0, RETURNDATASIZEO));
    V7, /* bool */ v8 =_erc20Token.transfer(msg.sender,_ stor_3).gas(msg.gas); //And receive free tokens!
    require(booL(v7),o, RETURNDATASIZE()); /I checks call status, propagates error data on error
    MEM[64] = MEM[64] + (RETURNDATASIZE() + 31 & ~0x1f):
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32)8 
    require(v8 == bool(v8));
    require(v8, Error('ERC2o transfer falled'));
}
```