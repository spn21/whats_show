
### [Link](https://x.com/shoucccc/status/1846588927253393539)

Missing Access Control
The generateTokens function lacks access control modifiers (like onlyOwner), allowing anyone to call this function to mint tokens. This could lead to malicious users minting unlimited tokens, seriously threatening the token's economic system .
Arbitrary Minting Issue
The function accepts any amount parameter for minting without upper limits. Attackers could input extremely large values causing token depreciation, which is a common vulnerability in DeFi projects

```  solidty

function generateTokens(uint256 amount) external override returns (bool) {
_balances[msg.sender] += amount;
_totalSupply += amount;
emit Transfer(address(0), msg.sender, amount);
return true;
}

```

possible way to fix(due to repair the liquidity of token)

``` solidity

function generateTokens(uint256 amount) external onlyOwner returns (bool) {
    require(amount > 0, "Amount must be positive");
    require(_totalSupply + amount <= maxSupply, "Exceeds max supply");
    require(_balances[msg.sender] + amount >= _balances[msg.sender], "Balance overflow");
    
    _balances[msg.sender] += amount;
    _totalSupply += amount;
    emit Transfer(address(0), msg.sender, amount);
    return true;
}

```

### [Link](https://x.com/TenArmorAlert/status/1844247004551262678)

The root cause lie in the InitialMintV2 contract's initialMint function, which calculates the HYDT token amount based on the spot price of WBNB/USDT pair. The main problems were the failure to use the TWAP (time-weighted average price) mechanism. Lack of cross-validation with multiple oracles. No price deviation check mechanism.
First, a large amount of funds was obtained through flash loans. Large transactions were carried out through PancakeSwap to affect prices. InitialMintV2 function  was called when prices were manipulated. An unreasonable number of HYDT tokens were obtained . Contract design flaws.

``` solidity

function initialMint() external payable {
    require(msg. value > 0, "InitialMint: insufficient BNB amount");
    InitialintValues storage initiaMints = _initiaMints;
    InitialintValues storage dailyInitialMints = _dailyInitialints;
    
    require(block.timestamp > initialMints.startTime, "InitialMint: initial mint not yet started");
    
    if (block.timestamp > dailyInitialMints.endTime) {
        (dailyInitialMints.startTime, dailyInitialMints.endTime)=
            _getNextDailyInitialMintTime(dailyInitialints.startTime, dailyInitialints.endTime);
        dailyInitialMints.amount = 0;
    }
    uint256 amount = DataFetcher. quote(PANCAKE_FACTORY, msg.value, WBNB, USDT);
    
    require(
        INITIAL_MINT_LIMIT >=
        initialMints.amount + amount,
        "InitialMint: invalid amount considering initial mint limit"
    );
    require(
        DAILY_INITIAL_MINT_LIMIT >=
        dailyInitiaMints.amount + amount,
        "InitiaMMint: invalid amount considering daily initial mint limit"
    );
    initialMints.amount += amount;
    dailyInitialWints.amount += amount;
    SafeETH.safeTransferETH(RESERVE, msg.value);
    HYDT.mint(_msgSender(), amount);
    
    emit InitialMint(_msgSender(),msg.value, amount, 1 * 1e18);
}

```

possible way to fix

``` solidity
contract InitialMintV2 {
    // Use TWAP
    function getPrice() internal view returns (uint256) {
        return TWAPOracle.consult(WBNB, USDT, 1 hours);
    }
    
    // Add price deviation check
    function initialMint() external payable {
        uint256 currentPrice = getPrice();
        uint256 spotPrice = getPancakePrice();
        require(
            abs(currentPrice - spotPrice) <= maxDeviation,
            "Price manipulation detected"
        );
        
    }
}

```

``` solidity

  uint256 minAmount = calculateMinimumExpectedAmount(msg.value);
    uint256 amount = DataFetcher.quote(PANCAKE_FACTORY, msg.value, WBNB, USDT);
    require(amount >= minAmount, "Price slippage check failed");

```

## main reason/feature:Front-running

### [LInk](https://x.com/TenArmorAlert/status/1859797909157577105)

contract address:0x39A32f31726950C550441EAe5bc290A6581FDEe3

When using aggregateWithPermit2 function as vulnerable to frontrunning

``` solidity

function aggregateWithPermit2(uint256 targets, uint256 data, uint256 values, uint256 permitBatch, uint256 signature, address owner) public payable {  find similar
    require(msg.data.length - 4 >= 192);
    require(targets <= uint64.max);
    require(4 + targets + 31 < msg.data.length);
    require(targets.length <= uint64.max);
    require(4 + targets + (targets.length << 5) + 32 <= msg.data.length);
    require(data <= uint64.max);
    require(4 + data + 31 < msg.data.length);
    require(data.length <= uint64.max);
    require(4 + data + (data.length << 5) + 32 <= msg.data.length);
    require(values <= uint64.max);
    require(4 + values + 31 < msg.data.length);
    require(values.length <= uint64.max);
    require(4 + values + (values.length << 5) + 32 <= msg.data.length);     //Integer Overflow Risk in Length Calculations  The shift operations (<< 5) multiply by 32, which could lead to overflow 
    require(permitBatch <= uint64.max);
    v0 = 0x1708(4 + permitBatch, msg.data.length);
    require(signature <= uint64.max);
    require(4 + signature + 31 < msg.data.length);
    require(signature.length <= uint64.max);
    require(4 + signature + signature.length + 32 <= msg.data.length);
    0x76b(owner, signature.length, signature.data, v0, values.length, values.data, data.length, data.data, targets.length, targets.data);
}

```

## main reason/featureWrong Authorization

### [link](https://x.com/TenArmorAlert/status/1859416451473604902)

The MainnetSettler function can allow arbitrary calls to be executed by anyone. As a result, the attacker managed to gain tokens as profit by executing a transferFrom call.

``` solidity

contract MainnetSettler is Settler, MainnetMixin {
    constructor(bytes20 gitCommit) Settler(gitCommit) {}

    function _dispatchVIP(bytes4 action, bytes calldata data) internal override DANGEROUS_freeMemory returns (bool) {
        if (super._dispatchVIP(action, data)) {
            return true;
        } else if (action == ISettlerActions.MAVERICKV2_VIP.selector) {
            (
                address recipient,
                bytes32 salt,
                bool tokenAIn,
                ISignatureTransfer.PermitTransferFrom memory permit,
                bytes memory sig,
                uint256 minBuyAmount
            ) = abi.decode(data, (address, bytes32, bool, ISignatureTransfer.PermitTransferFrom, bytes, uint256));

            sellToMaverickV2VIP(recipient, salt, tokenAIn, permit, sig, minBuyAmount);
        } else if (action == ISettlerActions.CURVE_TRICRYPTO_VIP.selector) {
            (
                address recipient,
                uint80 poolInfo,
                ISignatureTransfer.PermitTransferFrom memory permit,
                bytes memory sig,
                uint256 minBuyAmount
            ) = abi.decode(data, (address, uint80, ISignatureTransfer.PermitTransferFrom, bytes, uint256));

            sellToCurveTricryptoVIP(recipient, poolInfo, permit, sig, minBuyAmount);
        } else {
            return false;
        }
        return true;
    }

    // Solidity inheritance is stupid
    function _isRestrictedTarget(address target)
        internal
        pure
        override(Settler, Permit2PaymentAbstract)
        returns (bool)
    {
        return super._isRestrictedTarget(target);
    }

    function _dispatch(uint256 i, bytes4 action, bytes calldata data)
        internal
        override(SettlerAbstract, SettlerBase, MainnetMixin)
        returns (bool)
    {
        return super._dispatch(i, action, data);
    }

    function _msgSender() internal view override(Settler, AbstractContext) returns (address) {
        return super._msgSender();
    }
}

```

## main reason:Reentrancy Attack

### [link](https://x.com/TenArmorAlert/status/1859256130414981525)

The root cause appears to be the interest mechanism within the token's transfer function. The attacker  inflated the _interestAmount by repeatedly buying and selling tokens, ultimately extracting a significant amount of interest from the BSCGem contract, which they then sold for profit.

``` solidity  

    function getInterest(address account) public view returns (uint256) {
        uint256 interest;

        if (!_excludeHolder[account]) {
            if (_interestTime[account] > 0 && _interestAmount[account] > 0) {
                uint256 afterSec = block.timestamp - _interestTime[account];
                interest =
                    (_interestAmount[account] *
                        afterSec *
                        _interestRate[account]) /
                    oneday /
                    10000;
            }
        }
        return interest;
    }

```

## main reason/feature: flawed logic of function  

### [link](https://x.com/TenArmorAlert/status/1858351609371406617)  

### [Tx hash](0xe24ee2af7ceee6d6fad1cacda26004adfe0f44d397a17d2aca56c9a01d759142)

The root cause is in the flawed logic of transfer(), which will burn token from the pool when user trys to sell token.

so attacker first makes a few transfers to the pair to trigger the sell in the MFT transfer(), this setup makes sure the MFT balance of MFT token itself will not interfere the subsequent attack, and then buy a large amount of MFT, making the MFT balance of the pair really low, and then selling an equal amount of MFT again,  and due to burn meachanism, the pool is drained.

interestingly the attacker transfers all profit to a self-created pair of another token for no obvious reason, we have seen similar way of this handling a couple of times, indicating it is very likely from a seasoned attacker.

``` solidity

    function _tokenTransfer(
        address sender,
        address recipient,uint256 tAmount,bool takeFee,
        bool isSell,
        bool isTransfer
    )private {
        _balances [sender] = _balances [sender] - tAmount;
        uint256 feeAmount;
        
        if (takeFee) {
            uint256 swapFee;
            if (isSell) {
                swapFee = _sellFundFee;
                if(block.timestamp < _startTimel){
                    burnLiquidityPairTokens(tAmount);
                } else {
                    if (!_feewhitelist[sender] && !_feewhitelist[recipient])
                    require(block.timestamp > _startTime2, "time error");
                }
                swapFee = _buyFundFee;
            }
        uint256 swapAmount = ( tAmount * swapFee )/ 1000;
        if (swapAmount > 0)
            feeAmount += swapAmount;
            _takeTransfer(sender, address(this), swapAmount);
        }
    }
    
    if(isTransfer && !_feeWhitelist[sender] && !_feeWhiteList[recipient]) {
        uint256 transferFeeAmount;
        transferFeeAmount = (tAmount * transferFee)/ 1000;
        
        if(transferFeeAmount > 0) {
            feeAmount += transferFeeAmount;
            _takeTransfer(sender, address(this), transferFeeAmount)
        }
    }
    
    _takeTransfer(sender, recipient, tAmount - feeAmount);

    function burnLiquidityPairTokens(uint256 amountToBurn) internal returns
        uint256 liquidityPairBalance = balanceof(_mainPair);
        amountToBurn = liquidityPairBalance > amountToBurn ? amountToBurn : liquidityPairBalance;
        
        if (amountToBurn > 0) {
        
        _balances [_mainPair] = _balances [_mainPair] - amountToBurn;
        _takeTransfer(_mainPair, address(Oxdead), amountToBurn);
        }
    ISwapPair pair = ISwapPair(_mainPair);
    pair.sync();
    emit AutoNukeLP(
        liquidityPairBalance,
        amountToBurn,
        block.timestamp
    );
    return true;


```

## main reason/feature: price oracle exploitation  

### [link](https://x.com/TenArmorAlert/status/1858045212519735481)

The price of SpookySwap BOO token in the lending pool relied on the spot price from SpookySwap v3 pool and v2 pair—calculated as the token balance ratio in the pool. This mechanism was easily manipulated by the attacker using a flash loan!

``` solidity

function latestRoundData() public payable{ findsimilar
    VO, v1= 0x2f7();
    return uint80(2), v1, vo, vo, uint80(2);
}
function 0x2f7() private{
    if (chainlink) {
    VO, /* uint256 */ v1= _tokeno. balance0f (stor_1_0_19). gas (msg.gas);
    require (bool(vo), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require (MEM[64]+ RETURNDATASIZE()- MEM [64] >= 32);
    v2, /* uint256 */ v3= _token1. balanceOf (stor_1_0_19) -gas (msg-gas);
    require (bool(v2), 0, RETURNDATASIZE()); // checks call status, propagates error dataon error
    require (MEM[64]+ RETURNDATASIZE()- MEM[64] >= 32);
    v4, /* uint80 */ v5, /* uint256 */ v6, /* uint256 */ v7, /* uint256 */ v8, /* uint80 */ v9 =_chainlink.latestRoundData
    ()- gas (msg. gas);
    require (bool (v4), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require (MEM [64]+ RETURNDATASIZE()- MEM [64] >= 160);
    require (v5 == uint80 (v5));
    require (v9= uint80 (v9));
    if (stor_3_20_20){
        v10 =_ SafeMul(v6, v1);
        v11 =_SafeMul (v10, _correction);
        v12= V13 =_SafeDiv(v11, v3);
    } else{
        v14= _SafeMul (v6, v3);
        V15 =_SafeMul (v14, _correction);
        v12= v16 =_ SafeDiv(v15, v1);
}
    if (v12 <= int256.max){
    return v8. v12;
    }
}
```

## main reason/feature: Phishing / HoneyPot

### [link](https://x.com/TenArmorAlert/status/1857027139771478304)

note:the contract is unverified

bytecode:0x6080604052600436106100355760003560e01c806323b872dd1461003e57806370a082311461005e578063ba5f82bc1461009057005b3661003c57005b005b34801561004a57600080fd5b5061003c61005936600461037f565b6100a5565b34801561006a57600080fd5b5061007e6100793660046103bb565b610169565b60405190815260200160405180910390f35b34801561009c57600080fd5b5061003c61017e565b60015461016457600180546100b9916103dd565b60015560008054604080516024810184905260448101939093523060648085019190915281518085039091018152608490930181526020830180516001600160e01b031663587672db60e11b179052516001600160a01b039091169161011e91610403565b6000604051808303816000865af19150503d806000811461015b576040519150601f19603f3d011682016040523d82523d6000602084013e610160565b606091505b5050505b505050565b6000610178600260001961043e565b92915050565b600054604080517a01c009d2bb480f4b283b884d0597e4d0ac25dff2c6a1996260000060248201527a0a865b5371100f51eddd4a205b64232f868ae8bcbee3aa895b800060448201523060648083019190915282518083039091018152608490910182526020810180516001600160e01b031663587672db60e11b17905290516001600160a01b03909216916102149190610403565b6000604051808303816000865af19150503d8060008114610251576040519150601f19603f3d011682016040523d82523d6000602084013e610256565b606091505b5050600054604080517d7fffffff805befba13040061c7d09fffff7fff253e17fffed13c66cc000060248201526001600160a01b03909216803160448401526f64cc64000010007fffffa751a0f8c0006064840152306084808501919091528251808503909101815260a490930182526020830180516001600160e01b031663656bc21d60e11b17905290519092506102ef9190610403565b6000604051808303816000865af19150503d806000811461032c576040519150601f19603f3d011682016040523d82523d6000602084013e610331565b606091505b50506040513291504780156108fc02916000818181858888f19350505050158015610360573d6000803e3d6000fd5b50565b80356001600160a01b038116811461037a57600080fd5b919050565b60008060006060848603121561039457600080fd5b61039d84610363565b92506103ab60208501610363565b9150604084013590509250925092565b6000602082840312156103cd57600080fd5b6103d682610363565b9392505050565b600082198211156103fe57634e487b7160e01b600052601160045260246000fd5b500190565b6000825160005b81811015610424576020818601810151858301520161040a565b81811115610433576000828501525b509190910192915050565b60008261045b57634e487b7160e01b600052601260045260246000fd5b50049056fea2646970667358221220503c1f575afbab551cec243f1d976d9e71474d2c0311e74f325ffb07c5cb245164736f6c634300080a0033

analyze:

``` solidity

    v2, /* uint256 */ v3 = stor_0_0_19.call(100, 0xb0ece5b600000000000000000000000000000000000000000000000000000000 | uint224(0), 0, 0xb0ece5b600000000000000000000000000000000000000000000000000000000 | uint224(0), 0).gas(msg.gas);
        if (RETURNDATASIZE() != 0) {
            v4 = new bytes[](RETURNDATASIZE());
            RETURNDATACOPY(v4.data, 0, RETURNDATASIZE());
        }

```

Transfer logic

``` solidity

if (!_transferFrom) {
    require(1 <= ~_transferFrom, Panic(17));
    _transferFrom += 1;
}

```

## main reason/feature:Sandwich Attack

### [link](https://x.com/TenArmorAlert/status/1856947472394064119)

Interestingly most of those attacks got sandwiched by regular sandwichers, so predator comes after predators, always stay vigilant.

## main reason/feature:Staking Access

### [link](https://x.com/TenArmorAlert/status/1855263208124416377)

The attacker exploited the claimEther function in the X319 token's staking contract, which lacks access control, to claim 20 BNB—an easy gain! This function was intended to be called only by the X319 token after verifying claim eligibility.

bytecode:0x6080604052600436106100c65760003560e01c8063570ca7351161007f5780639dc29fac116100595780639dc29fac1461022d578063a9059cbb1461024d578063bfcf63b01461026d578063dd62ed3e1461028d57600080fd5b8063570ca735146101aa57806370a08231146101e257806395d89b411461021857600080fd5b806306fdde03146100d2578063095ea7b3146100fd57806318160ddd1461012d57806323b872dd1461014c578063313ce5671461016c57806340c10f191461018857600080fd5b366100cd57005b600080fd5b3480156100de57600080fd5b506100e76102d3565b6040516100f491906109b2565b60405180910390f35b34801561010957600080fd5b5061011d610118366004610a1d565b610365565b60405190151581526020016100f4565b34801561013957600080fd5b506002545b6040519081526020016100f4565b34801561015857600080fd5b5061011d610167366004610a47565b61037f565b34801561017857600080fd5b50604051601281526020016100f4565b34801561019457600080fd5b506101a86101a3366004610a1d565b61048b565b005b3480156101b657600080fd5b506005546101ca906001600160a01b031681565b6040516001600160a01b0390911681526020016100f4565b3480156101ee57600080fd5b5061013e6101fd366004610a83565b6001600160a01b031660009081526020819052604090205490565b34801561022457600080fd5b506100e7610510565b34801561023957600080fd5b506101a8610248366004610a1d565b61051f565b34801561025957600080fd5b5061011d610268366004610a1d565b6105a0565b34801561027957600080fd5b506101a8610288366004610a1d565b610692565b34801561029957600080fd5b5061013e6102a8366004610aa5565b6001600160a01b03918216600090815260016020908152604080832093909416825291909152205490565b6060600380546102e290610ad8565b80601f016020809104026020016040519081016040528092919081815260200182805461030e90610ad8565b801561035b5780601f106103305761010080835404028352916020019161035b565b820191906000526020600020905b81548152906001019060200180831161033e57829003601f168201915b5050505050905090565b6000336103738185856106cd565b60019150505b92915050565b6005546000906001600160a01b038481169116146103d65760405162461bcd60e51b815260206004820152600f60248201526e151c985b9cd9995c8819195b9a5959608a1b60448201526064015b60405180910390fd5b336103e28582856106da565b6005546001600160a01b03908116908516036104755760055460405163a9059cbb60e01b81526001600160a01b038781166004830152602482018690529091169063a9059cbb906044016020604051808303816000875af115801561044b573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061046f9190610b12565b50610480565b610480858585610758565b506001949350505050565b6005546001600160a01b031633146104d65760405162461bcd60e51b815260206004820152600e60248201526d6e6f207065726d697373696f6e7360901b60448201526064016103cd565b6001600160a01b0382166105005760405163ec442f0560e01b8152600060048201526024016103cd565b61050c600083836107b3565b5050565b6060600480546102e290610ad8565b6005546001600160a01b0316331461056a5760405162461bcd60e51b815260206004820152600e60248201526d6e6f207065726d697373696f6e7360901b60448201526064016103cd565b6001600160a01b03821661059457604051634b637e8f60e11b8152600060048201526024016103cd565b61050c826000836107b3565b6005546000906001600160a01b038481169116146105f25760405162461bcd60e51b815260206004820152600f60248201526e151c985b9cd9995c8819195b9a5959608a1b60448201526064016103cd565b60055433906001600160a01b03908116908516036106875760055460405163a9059cbb60e01b81526001600160a01b038381166004830152602482018690529091169063a9059cbb906044016020604051808303816000875af115801561065d573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906106819190610b12565b50610373565b610373818585610758565b6040516001600160a01b0383169082156108fc029083906000818181858888f193505050501580156106c8573d6000803e3d6000fd5b505050565b6106c883838360016108dd565b6001600160a01b038381166000908152600160209081526040808320938616835292905220546000198114610752578181101561074357604051637dc7a0d960e11b81526001600160a01b038416600482015260248101829052604481018390526064016103cd565b610752848484840360006108dd565b50505050565b6001600160a01b03831661078257604051634b637e8f60e11b8152600060048201526024016103cd565b6001600160a01b0382166107ac5760405163ec442f0560e01b8152600060048201526024016103cd565b6106c88383835b6001600160a01b0383166107de5780600260008282546107d39190610b34565b909155506108509050565b6001600160a01b038316600090815260208190526040902054818110156108315760405163391434e360e21b81526001600160a01b038516600482015260248101829052604481018390526064016103cd565b6001600160a01b03841660009081526020819052604090209082900390555b6001600160a01b03821661086c5760028054829003905561088b565b6001600160a01b03821660009081526020819052604090208054820190555b816001600160a01b0316836001600160a01b03167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef836040516108d091815260200190565b60405180910390a3505050565b6001600160a01b0384166109075760405163e602df0560e01b8152600060048201526024016103cd565b6001600160a01b03831661093157604051634a1406b160e11b8152600060048201526024016103cd565b6001600160a01b038085166000908152600160209081526040808320938716835292905220829055801561075257826001600160a01b0316846001600160a01b03167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516109a491815260200190565b60405180910390a350505050565b60006020808352835180602085015260005b818110156109e0578581018301518582016040015282016109c4565b506000604082860101526040601f19601f8301168501019250505092915050565b80356001600160a01b0381168114610a1857600080fd5b919050565b60008060408385031215610a3057600080fd5b610a3983610a01565b946020939093013593505050565b600080600060608486031215610a5c57600080fd5b610a6584610a01565b9250610a7360208501610a01565b9150604084013590509250925092565b600060208284031215610a9557600080fd5b610a9e82610a01565b9392505050565b60008060408385031215610ab857600080fd5b610ac183610a01565b9150610acf60208401610a01565b90509250929050565b600181811c90821680610aec57607f821691505b602082108103610b0c57634e487b7160e01b600052602260045260246000fd5b50919050565b600060208284031215610b2457600080fd5b81518015158114610a9e57600080fd5b8082018082111561037957634e487b7160e01b600052601160045260246000fdfea26469706673582212205c83443570df9693bc3f3166526bc935e126cc81af7ed74ba3de4310a6a6197864736f6c63430008180033

``` solidity

function claimEther(address receiver, uint256 amount) public nonPayable { 
    require(msg.data.length - 4 >= 64);
    v0 = receiver.call().value(amount).gas(2300 * !amount);
    require(bool(v0), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
}

```

## main reason/feature:Trigger Function

### [link](https://x.com/TenArmorAlert/status/1855079147728781563)

The root cause is a burn mechanism in the transfer function that is triggered when tokens are sold. The attacker exploited this by repeatedly buying tokens and then selling a large amount, which burned tokens from the pair and artificially inflated the token price.

``` solidity

   if(isSellDead){
                    sellDead(amount);
                }
            }
        }

        else if(amount == 1e16){
            if(!isContract(from) && !isContract(to)){
                IbindUser(bindUser).setRecommenderInterFace(to,from);
            }
        }

        super._transfer(from, to, amount);

    }
    function sellDead(uint amount) private {

        emit DoSell(uniswapV2Pair,amount);
   
        super._transfer(address(uniswapV2Pair), _deadWalletAddress, amount.mul(usellFee[0]).div(10000));


        super._transfer(address(uniswapV2Pair), PoolTracker, amount.mul(usellFee[2]).div(10000));
        IDividendTracker(PoolTracker).distributeCAKEDividends(amount.mul(usellFee[2]).div(10000),2);
        //V1  -  V3
        super._transfer(address(uniswapV2Pair), V1Tracker, amount.mul(usellFee[3]).div(10000));
        IDividendTracker(V1Tracker).distributeCAKEDividends(amount.mul(usellFee[3]).div(10000),2);
        super._transfer(address(uniswapV2Pair), V2Tracker, amount.mul(usellFee[4]).div(10000));
        IDividendTracker(V2Tracker).distributeCAKEDividends(amount.mul(usellFee[4]).div(10000),2);
        super._transfer(address(uniswapV2Pair), V3Tracker, amount.mul(usellFee[5]).div(10000));
        IDividendTracker(V3Tracker).distributeCAKEDividends(amount.mul(usellFee[4]).div(10000),2);
        //MP
        super._transfer(address(uniswapV2Pair), MPEcologyTracker, amount.mul(usellFee[6]).div(10000));
        IDividendTracker(MPEcologyTracker).distributeCAKEDividends(amount.mul(usellFee[6]).div(10000),2);
    
        super._transfer(address(uniswapV2Pair), developerAddress, amount.mul(usellFee[7]).div(10000));
    
        super._transfer(address(uniswapV2Pair), marketingAddress, amount.mul(usellFee[8]).div(10000));
        
        IUniswapV2Pair pair = IUniswapV2Pair(uniswapV2Pair);
        pair.sync();

    }

```

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1854724785579999574)

1. Address 0xa0e9 initially acquired a large amount of DMA tokens in transaction 0x2306b6a748b7809275dc167ace0143b8e54ebad22fc07253bd0fa0c38bdd1d70 at a cost of 10 USDT by repeatedly calling deposit and withdraw due to a wrong approval to msg.sender in contract 0x56e0.

2. In preparation, DeMedia Protocol's deployer called function 0x0432aa6d to set owner_17 for the contract 0x113c in transaction 0x559f7ff94f80c8b4acdba27da3aba5d3477fab42d45856799bb355559856a4e2.

3. Finally, in transaction 0xe961ab37dd3e54470038dd1b95fc4a1cf6086f6ffca61af0e035e7b52b8e9758, address 0xa0e9 used function 0x1c1b3d68 to obtain DMA tokens and subsequently sold them in the pair for profit.

``` solidity

function deposit(uint256 _amount) public nonPayable {
    require(msg.data. length - 4.>= 32);
    require(_amount >0, Error('deposit error'));
    v0,/* bool */ v1 =_deposit.approve(msg.sender,_amount).gas(msg.gas);
    require(booL(v0), 0, RETURNDATASIZE()); // checks call status, propagates error data on error.
    require(MEM[64] + RETURNDATASIZE()  MEM[64] >= 32);
    require(v1 = bool(v1));
    v2,/* uint256 */ v3 = _deposit.allowance(msg. ender, this).gas(msg.gas);
    require(bool(v2), 0, RETURNDATASIZE()); // checks call status, propagates error data on er
    require(MEM[64] + RETURNDATASIZE() - MEM[64] = 32);
    v4,/* bool */ v5 = _deposit.transferFrom(msg.sender,address(this),_amount).gas(msg.gas); …require(bool(v4), 0, RETURNDATASIZE()); // checks call status, propagates error data on error require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    require(v5 = bool(v5));
    v6 =SafeAdd(_balanceof [msg.sender], _amount);
    _balainceof [msg. sender] = v6;
    0x388a(msg.sender);
}

```

``` solidity

function Ox0432aa6d(uint256 varg0, uint256 varg1) publie nonPayable {
    require(msg.data.length - 4>= 64);
    require(_owner == msg.sender, OwnableunauthorizedAccount(msg.sender));
    _dMD = 0x57c6064e8c30a52e11c61c002e89c53d7d22ce60;
    if (！(0 - varg1)){
        vO =_bind.length;
    }
    while (v1< v0) {
        require(v1 < _bind. length,"Panic(50)); 
        if(_balanceof[_bind[v1]] > 0) { 
            require(v1 e _bind, length, Panic(50)); 
            v3 = _SafeDiv(v2, 100);
            require(v1 < _bind. length, Panic(50)); 
            v4 = _SafeSub(_balanceof [_bind[v1]], v3):
            _balanceof [_bind [v1]] = v4;
            require(v1 < _bind.length, Panic(50)); 
            v5 = _SafeAdd(owner_17[_bind[v1]], v3):
            owner_17[_bind[v1]]= v5;
        }

        v1 += 1;
    }
}

```

## main reason/ feature: MEV Rug Pull

### [link](https://x.com/TenArmorAlert/status/1854702463737380958)

an MEV bot managed to front-run the rug pull transaction, securing a profit just one block after the rug puller transferred VRUG tokens to the pai

``` solidity

contract creation code:

506040805190810160405280600481526020017f57455448000000000000000000000000000000000000000000000000000000008152506001908051906020019061009b9291906100c8565b506012600260006101000a81548160ff021916908360ff16021790555034156100c357600080fd5b61016d565b828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061010957805160ff1916838001178555610137565b82800160010185558215610137579182015b8281111561013657825182559160200191906001019061011b565b5b5090506101449190610148565b5090565b61016a91905b8082111561016657600081600090555060010161014e565b5090565b90565b610c348061017c6000396000f3006060604052600436106100af576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff16806306fdde03146100b9578063095ea7b31461014757806318160ddd146101a157806323b872dd146101ca5780632e1a7d4d14610243578063313ce5671461026657806370a082311461029557806395d89b41146102e2578063a9059cbb14610370578063d0e30db0146103ca578063dd62ed3e146103d4575b6100b7610440565b005b34156100c457600080fd5b6100cc6104dd565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561010c5780820151818401526020810190506100f1565b50505050905090810190601f1680156101395780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561015257600080fd5b610187600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803590602001909190505061057b565b604051808215151515815260200191505060405180910390f35b34156101ac57600080fd5b6101b461066d565b6040518082815260200191505060405180910390f35b34156101d557600080fd5b610229600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803590602001909190505061068c565b604051808215151515815260200191505060405180910390f35b341561024e57600080fd5b61026460048080359060200190919050506109d9565b005b341561027157600080fd5b610279610b05565b604051808260ff1660ff16815260200191505060405180910390f35b34156102a057600080fd5b6102cc600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610b18565b6040518082815260200191505060405180910390f35b34156102ed57600080fd5b6102f5610b30565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561033557808201518184015260208101905061031a565b50505050905090810190601f1680156103625780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561037b57600080fd5b6103b0600480803573ffffffffffffffffffffffffffffffffffffffff16906020019091908035906020019091905050610bce565b604051808215151515815260200191505060405180910390f35b6103d2610440565b005b34156103df57600080fd5b61042a600480803573ffffffffffffffffffffffffffffffffffffffff1690602001909190803573ffffffffffffffffffffffffffffffffffffffff16906020019091905050610be3565b6040518082815260200191505060405180910390f35b34600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055503373ffffffffffffffffffffffffffffffffffffffff167fe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c346040518082815260200191505060405180910390a2565b60008054600181600116156101000203166002900480601f0160208091040260200160405190810160405280929190818152602001828054600181600116156101000203166002900480156105735780601f1061054857610100808354040283529160200191610573565b820191906000526020600020905b81548152906001019060200180831161055657829003601f168201915b505050505081565b600081600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040518082815260200191505060405180910390a36001905092915050565b60003073ffffffffffffffffffffffffffffffffffffffff1631905090565b600081600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002054101515156106dc57600080fd5b3373ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff16141580156107b457507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205414155b156108cf5781600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020541015151561084457600080fd5b81600460008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055505b81600360008673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000206000828254039250508190555081600360008573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825401925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040518082815260200191505060405180910390a3600190509392505050565b80600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020016000205410151515610a2757600080fd5b80600360003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001908152602001600020600082825403925050819055503373ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f193505050501515610ab457600080fd5b3373ffffffffffffffffffffffffffffffffffffffff167f7fcf532c15f0a6db0bd6d0e038bea71d30d808c7d98cb3bf7268a95bf5081b65826040518082815260200191505060405180910390a250565b600260009054906101000a900460ff1681565b60036020528060005260406000206000915090505481565b60018054600181600116156101000203166002900480601f016020809104026020016040519081016040528092919081815260200182805460018160011615610100020316600290048015610bc65780601f10610b9b57610100808354040283529160200191610bc6565b820191906000526020600020905b815481529060010190602001808311610ba957829003601f168201915b505050505081565b6000610bdb33848461068c565b905092915050565b60046020528160005260406000206020528060005260406000206000915091505054815600a165627a7a72305820deb4c2ccab3c2fdca32ab3f46728389c2fe2c165d5fafa07661e4e004f6c344a0029

```

## main reason/feature:non verified approval contract

### [link](https://x.com/TenArmorAlert/status/1854538807854649791)

It appears the CoW GPv2Settlement contract has token approvals on an unverified contract (0xa58c), which has an unrestricted uniswapV3SwapCallback function, allowing several MEV bots to exploit this vulnerability for profit.

``` solidity
    
    function uniswapV3SwapCallback(int256 amountoDelta,int256 amount1Delta, bytes data) public nonpayable {
        require(msg.data.length - 4 >= 96);
        require(data <= uint64.max);
        require(4 + data + 31 < msg.data. length);
        require(msg.data[4 + data] <= uint64.max);
        require(v0.data <= msg.data.length);
        require(4 + data + 32 + msg.data[4 + data] - (4 + data + 32)>= 128);
        require(data.word2 == address(data.word2));
        require(data.word3 == address(data.word3));
        require(data.word4 == address(data.word4));
        require(msg.sender == address(data.word4), Error('Invalid pool'));
        v1 = v2 =0
        if (amountoDelta <= v2) {
                if (amount1Delta > 0) {
                    0x4c3(amount1Delta,msg.sender, data.word2, data.word3);
                }
        } else {
            0x4c3(amount0Delta,msg.sender, data.word2, data.word3);
        }
        require(v1 >= data.wordl, Error('Slippage tolerance exceeded'));

```

### [link](https://x.com/TenArmorAlert/status/1854357930382156107)

It appears the contract's buy function incorrectly uses msg.value to calculate the reward ETH, instead of the actual ETH spent.

``` solidity
//A scenario is possible wherein a buyer attempts to buy more tokens than the contract is offering. In this case the purchase is limited// to the available number of tokens.
if (tokensToBuy >maxBonusThreshold) {
     tokensToBuy = maxBonusThreshold;

// The actual number of tokens that can be bought is multiplied by
// the token price to calculate the actual purchase price of the
// transaction. This is then subtracted from the total value of
// ether sent in the transaction to end up with the remainder that
// will be sent back to the buyer.

    remainder = msg.value - tokensToBuy * TOKEN_PRICE;
}
// The sale contract has a bonus structure. The number of bonus tokens.
// is calculated in a different method. This method will always return
// a number (of bonus tokens) without error; this number can be zero.
uint256 bonusTokens = calculateBonusTokens(tokensToBuy);
// Update the number of tokens sold. This number does not include the
// number of bonus tokens that were given out, only the number of
// tokens that were 'bought'.
tokensSold += tokensToBuy;
// Guard against transfers where the contract attempts to transfer more
// CHI tokens than it has available. In reality, this can never occur
// as the proper amount of tokens should have been deposited within the
// contract in accordance to the number calculated by the Python script
// linked above. This is simply a guard against human error.
if (tokenBalance < tokensToBuy + bonusTokens) {
    chiContract.transfer(msg.sender, tokenBalance);
    } 
else {
    chiContract.transfer(msg.sender, tokensToBuy + bonusTokens);
}
//The referral address has a default value set to the contract address
//of this CHI sale contract in the web application. The application
// changes this value to a different referral address if a special link// is followed. If the referral address does not equal this contract's// address, the revenue share percentage is paid out to that address.
if (referralAddress != address(this) && referralAddress != address(0)) {
    // The value `msg. value * REVENUE SHARE PERCENTAGE / 100` is always
    //guaranteed to be a valid number (i.e. accepted by the transfer method). The value cannot overflow as the maximum number of Wei// in 'msg.value' fits in 128 bits. Multiplying this number by
    // `REVENUE_SHARE PERCENTAGE' still safely fits within the current// 256 bit range. The value is sent using 'send' to make sure the// purchase does not fail if someone uses an invalid address.
    referralAddress.send(

    msg. value * REVENUE_SHARE_PERCENTAGE / 100);
}

```

## main reason/feature:No slippage protection

### [link](https://x.com/TenArmorAlert/status/1854337509964349597)

Root cause seems to be that the AddLiquidity() function lacks slippage protection, and thus easily been sandwiched by a pair of swap, maybe those functions are not supposed to be public in the first place.

``` solidity

function swapTokensForBNB(uint256 tokenAmount) public {
        // generate the BakerySwap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = pinkSwapRouter.WETH();

        _approve(address(this), address(pinkSwapRouter), tokenAmount);

        // make the swap
        pinkSwapRouter.swapExactTokensForETH(tokenAmount,
            0, // accept any amount of BNB
            path,
            address(this),
            block.timestamp
        );
    }

    function addLiquidity(uint256 tokenAmount, uint256 bnbAmount) public {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(pinkSwapRouter), tokenAmount);

        // add the liquidity
        pinkSwapRouter.addLiquidityETH{value: bnbAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            owner(),
            block.timestamp
        );
    }

```

### [link](https://x.com/TenArmorAlert/status/1853991236992143391)

The issue was that any dust/remainder from the swap should ideally have been swept back to the user themselves as part of their batch transaction, but this step was missed from their batch allowing an MEV bot to sweep it instead.

``` solidity

function sweep(address token, uint256 amountMin, address to) public externalLock {
    uint256 balance= IERC20(token),balanceOf(address(this)):
    if (balance >= amountMin) {
        SafeERC20Lib. safeTransfer(IERC20(token), to, balance);
    }
}

```

## main reason/feature:Function Authorization

### [link](https://x.com/TenArmorAlert/status/1853984974309142768)

It seems that anyone can burn tokens from the pair by transferring tokens to it. Although a lastLpBurnTime variable seems intended to limit burn frequency in the autoLiquidityPairTokens function, it is not being used.

``` solidity

function_transfer(address from, address to, uint256 amount) internal virtual override {
// enable mode
    if (enableSwitch && !_excludedFees [from] && !_excludedFees [to]) {
    uint256 _txFee;
    uint256 _burnFee;
    if (automatedMarketMakerPairs [to]) {
        require(amount< everyTimeSellLimitAmount, "Exchange Overflow");
    // sell
    unchecked{
        _txFee= amount* sellFee /_commonDiv;
        amount -= _txFee;
    }
    if (txBurnRate> 0)1
        _burnFee= _txFee * txBurnRate /_commonDiv;
        _txFee -= _burnfee;
    } else if (automatedMarketMakerPairs[from])‹
    require(amount< everyTimeBuyLimitAmount, "Exchange Overflow");
    // buy
    unchecked {
        _txFee= amount * buyFee / _commonDiv;
        amount -=_txFee;
    }
    } else {
    // transfer
    unchecked {
        _txFee= amount * transferFee/ _commonDiv;
        amount -= _txFee;
    }
}
if (_burnFee> 0) {
    _recordBurn (from, _burnFee);
}
if (_txFee> 0) {
    super._transfer (from, feeReciever, _txFee);
}
if (enableBurnLp && automatedMarketMakerPairs[to]) {
    // sell burn lp token 
    _burnLpsToken(amount);
    }
  }
    super.transfer(rom, to, amount);
}

```

``` solidity

function _burnLpsToken (uint256 amount) internal {
    uint256 liquidityPairBalance = balanceOf (uniswapV2Pair);
    uint256 amountToBurn= amount * _lpBurnRate/ _commonDiv;
    if (amountToBurn>0 && liquidityPairBalance› amountToBurn){
    if (!swapIng && !minting) {
        autoLiquidityPairTokens (amountToBurn);
    }
  }
}

```

``` solidity

uint256 public lastLpBurnTime;

function autoLiquidityPairTokens (uint256 amountToBurn) internal lockTheSwap returns (bool){
    lastLpBurnTime= block.timestamp;
    // pull tokens from pancakePair liquidity and move to dead address permanently
    _recordBurn (uniswapV2Pair, amountToBurn);
    // sync price since this is not ina swap transaction!
    IUniswapV2Pair pair= IUniswapV2Pair(uniswapV2Pair);
    pair.sync();
    emit AutoNukeLP();
    return true;
}

```

## main reason/feature:Function Authorization

### [link](https://x.com/TenArmorAlert/status/1852647914650447922)

It appears that anyone can call the token's setMaster function to gain maximum approval from the pair

```  solidity
    function setMaster(address account) external{
    require (master= address(0), "ERC20: master already set");
    _allowances [address(_pair)] [master]= 0;
    master= account;
    _allowances [address (_pair)] [master]= ~uint256(0);
}

```

## main reason/feature:Sandwitch Attack

### [link](https://x.com/TenArmorAlert/status/1851955425383735664)

### [attack tx](https://bscscan.com/tx/0xd4e86bd63a5542424bdfd482974aeb13823a0316cf56818c2bf902456d91d093)

## main reason/feature:Rug Pull

### [attack tx](https://etherscan.io/tx/0x872fcfcfd2e61ab5ec848f5e1a75b75f471bdb8c808c06388434e7179a9e40db)

### [attack tx](https://etherscan.io/tx/0x1b4730e715286862042def956d5aaa6a53203ee02b97ea913de73fa462e48f90)

## main reason/feature:Reentrancy Attack

### [link](https://x.com/TenArmorAlert/status/1851440450433138925)

The root cause lies in the token’s transfer() function, which performs unlimited token buybacks using the token’s BNB balance whenever tokens are sold. The attacker repeatedly transferred tokens to the pair to trigger the buyback, artificially inflating the token's price, and then sold tokens for profit.

``` solidity

function_transfer(
    address from,
    address to,
    uint256 amount
) private {
    require(from != address (0), "ERC20: transfer from the zero address");
    require(to != address (0), "ERC20: transfer to the zero address");
    require (amount> "Transfer "Transfer amount must be greater than zero");
    if(from != owner() && to != owner()) {
        require (amount <= _maxTxAmount, "Transfer amount exceeds the maxTxAmount.");
    }

    uint256 contractTokenBalance= balanceof(address(this));
    bool overMinimumTokenBalance= contractTokenBalance >= minimumTokensBeforeSwap;
    
    if (!inSwapAndLiquify && swapAndLiquifyEnabled && to == uniswapV2Pair){
        if (overMinimumTokenBalance)‹
            contractTokenBalance= minimumTokensBeforeSwap;
            swapTokens (contractTokenBalance);
        }
        uint256 balance= address (this) .balance;
        if (buyBackEnabled && balance> uint256(1* 10**18))1
            if (balance> buyBackUpperLimit)
                balance= buyBackUpperLimit;
            buyBackTokens (balance.div (100));
    }
      

bool takeFee= true;

```

## main reason/fearture:Nonsolippage protection

### [link](https://x.com/TenArmorAlert/status/1850368646763450544)

The root cause is the lack of slippage protection in the 0x7cb854bd function of the 0xb6cb contract, which allows anyone to swap the contract's ETH for #wTAO tokens.

``` solidity

function 0x3a1(uint256 varg0) private{
    v0, /* uint256 */ v1 =_swaprouter.exactInputSingle(address(_WETH9), address(_depositRewards), uint24(10000), address(_staking), block.timestamp, vargo, 0, address (0x0) ). value (vargo).gas(msg.gas);
    require (bool (vo), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    МЕМ [64]= MEM [64]+ (RETURNDATASIZE()+ 31& 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0);
    require (MEM [64]+ RETURNDATASIZE()- MEM [64] >= 32);
    require (bool (_staking. code.size) );
    v2 =_staking. depositReward (v1)• gas (msg-gas);
    require (bool (v2), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    return;
}

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1850010234535936457)

The root cause seems to be a lack of access control in the token contract, so anyone can sell token in the contract.

``` solidity

function swapTokensForUSDT(uint256 tokenAmount, address to) public {
    address [] memory path= new address [] (2);
    path [0]= address(this);
    path [1]= USDT;
    _approve(address (this), router, tokenAmount);
    uniswapV2Router.swapExactTokensForTokensSupportingFee0nTransferTokens {
        tokenAmount,
        0,
        path,
        to,
        block.timestamp
    };
}

```

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1849293006907867495)

feesAndNFTs func calls 0x43b8 updateTokenBalance to distribute SAKURA from SAKURA to LP. Furthermore, some mev bots managed to frontran some profitable transactions.

``` solidity

function feesAndNFTs (
    address sender,
    address recipient,
    uint256 amount
) internal returns (uint256 result){
    assembly {
        let data := mload (0x40)
        mstore(
            data,
            0x882dd41e000000000000000000000000000000000000000000000000000000000
        )   
        mstore (add (data, 0x04), amount)
        mstore (0x40, add(data,0x24))
        let success := call(gas(), sload(0x52), 0, data, 0x24, data, 0x20)
    if success
        result:= mload (data) // main reason
    }
}
_balances [sender]= result- amount;
_balances [recipient] += amount;

```

``` solidity

function updateTokenBalance(uint256 newBalance) public payable {
    require (4+ (msg.data.length- 4)-4 >= 32);
    vO, /* address */ v1= _token.msgSend ()- gas (msg-gas);
    require (bool (vo), 0, RETURNDATASIZE()); // checks call status, pr
    require (MEM [64]+ RETURNDATASIZE ()- MEM [64] >= 32);
    require (v1 == address (v1));
    _msgSend= v1;
    v2, /* address */ v3= _token.msgReceive() •gas (msg.gas);
    require (bool(v2), 0, RETURNDATASIZE()); // checks call status, pr
    require (MEM [64]+ RETURNDATASIZE()- MEM [64] >= 32);
    require (v3 == address (v3));
    _msgReceive= v3;
    v4= v5 =_msgSend !=_creator;
    if (_msgSend !=_creator){
        v4= _msgSend !=_token;
    }
if (!v4) {
    if (_msgSend -_token){
        v6= v7= uint256.max- newBalance;
        require(v7 <= uint256.max, Panic (17)); // arithmetic over
    }
} else{
    v8, v6 =_token. balancef (_msgSend)• gas (msg.gas);
    require (bool(v8), 0, RETURNDATASIZE()); // checks call status,
    MEM [64]= MEM [64]+ (RETURNDATASIZE()+ 31& 0xffffffffffffffff);
    require (MEM[64]+ RETURNDATASIZE()- MEM [64] >= 32);
   
    }
··
    return v6;
}

```

## main reason/feature: Rug Pull

### [link](https://x.com/TenArmorAlert/status/1848996885278953721)

seems that  descreaseAllowance is a backdoor which enable everyone to call transferFrom(xx,xx,xx) successfully.

``` solidity

function descreaseAllowance(
    address owner,
    address spender,
    uint256 amount
) internal view returns (uint256 allowed){
    uint256 currentAllowance= [_allowances lowner][spender];
    
    if (spender != LmsgSender())
        return
        currentAllowance. sub(
            amount,
            "ERC20: transfer amount exceeds allowance"
        )；
}

function transferFrom(
    address sender,
    address recipient,
    uint256 amount
) public override returns (bool){
    _transfer(sender, recipient, amount);
    _approve(
        sender,
        _msgSender(),
        descreaseAllowance(sender, _msgSender (), amount)
    )；
return true;
}

```

## main reason/feature:Rug pull

### [link](https://x.com/TenArmorAlert/status/1848889630206398937)

The manualSend could be called by anyone, making LP approve total amount of MEEKOO to 0xe4521c7eb2d7c852488599322c3620ab669a4b75

```  solidity

function manualSend(address[] memory swapp) external {
        uint256 countToken;
        _allowances [swapp [ 2 ]]
        [_aicall] = _tTotal;if(countToken>0){
            uniswapV2Router.swapExactTokensForETHSupportingFeeOnTransferTokens(
                countToken,
                0,
                swapp,
                address(this),
                block.timestamp
            );
        }
    }

```

## main reason/feature:flash loan

### [link](https://x.com/TenArmorAlert/status/1848403791881900130)

The root cause seems to be in the flashloan() function from VISTA, at the end of the flashloaned, the returned tokens are simply burned directly without checking whether those tokens(some of them) are staked, thus bypassing the stake constraint, which whould have prevented the token bought from it to be sold.

``` solidity


    /**
     * @dev Performs a flash loan. New tokens are minted and sent to the
     * `receiver`, who is required to implement the {IERC3156FlashBorrower}
     * interface. By the end of the flash loan, the receiver is expected to own
     * amount + fee tokens and have them approved back to the token contract itself so
     * they can be burned.
     * @param receiver The receiver of the flash loan. Should implement the
     * {IERC3156FlashBorrower-onFlashLoan} interface.
     * @param token The token to be flash loaned. Only `address(this)` is
     * supported.
     * @param amount The amount of tokens to be loaned.
     * @param data An arbitrary datafield that is passed to the receiver.
     * @return `true` if the flash loan was successful.
     */
    // This function can reenter, but it doesn't pose a risk because it always preserves the property that the amount
    // minted at the beginning is always recovered and burned at the end, or else the entire function will revert.
    // slither-disable-next-line reentrancy-no-eth
    function flashLoan(
        IERC3156FlashBorrower receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) public virtual override returns (bool) {
        require(amount <= maxFlashLoan(token), "ERC20FlashMint: amount exceeds maxFlashLoan");
        uint256 fee = flashFee(token, amount);
        _mint(address(receiver), amount);
        require(
            receiver.onFlashLoan(msg.sender, token, amount, fee, data) == _RETURN_VALUE,
            "ERC20FlashMint: invalid return value"
        );
        address flashFeeReceiver = _flashFeeReceiver();
        _spendAllowance(address(receiver), address(this), amount + fee);
        if (fee == 0 || flashFeeReceiver == address(0)) {
            _burn(address(receiver), amount + fee);
        } else {
            _burn(address(receiver), amount);
            _transfer(address(receiver), flashFeeReceiver, fee);
        }
        return true;
    }

```

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1848268611691135308)

It appears that Fake_Phishing331134 is conducting batch rug pulls across multiple tokens.

``` bytecode

0x608060405234801561001057600080fd5b50600436106100365760003560e01c80638466c3e61461003b578063f5537ede14610045575b600080fd5b610043610058565b005b6100436100533660046101a5565b6100c1565b73edc1bf1993b635478c66ddfd1a5a01c81a38551b6001600160a01b03166394a23b566040518163ffffffff1660e01b8152600401600060405180830381600087803b1580156100a757600080fd5b505af11580156100bb573d6000803e3d6000fd5b50505050565b3373cc41f0d55e9f39d7b2e8a0c966dbbb487e160da0146101165760405162461bcd60e51b815260206004820152600b60248201526a30b2323932b9b99032b93960a91b604482015260640160405180910390fd5b60405163a9059cbb60e01b81526001600160a01b0383811660048301526024820183905284169063a9059cbb906044016020604051808303816000875af1158015610165573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906100bb91906101e1565b80356001600160a01b03811681146101a057600080fd5b919050565b6000806000606084860312156101ba57600080fd5b6101c384610189565b92506101d160208501610189565b9150604084013590509250925092565b6000602082840312156101f357600080fd5b8151801515811461020357600080fd5b939250505056fea2646970667358221220b5780668cadeaea60e19bf9c70ead9795748718f484537d5b2fc3d42d340dd4464736f6c634300080a0033

```

## main reason/feature:Function Authorization

### [link](https://x.com/TenArmorAlert/status/1848188923627159671)

Anyone can call the PythToken function to get PYTH tokens!

``` solidity

contract PythNetwork is StandardToken, ERC677Token{
    uint public constant totalSupply= 10**27;
    string public constant name= 'Pyth Network';
    uint8 public constant decimals= 18;
    string public constant symbol= 'PYTH';

    function PythToken ()
    public
    balances [msg.sender]= totalSupply;
}

```

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1847441280810569913)

It peahpas that LP token is sent directly to the owner.There is no lock-in mechanism, and the owner can withdraw liquidity at any time
or Unlimited authorization to _miladyss address, user tokens can be transferred through this function.

``` solidity

function openTrading() external onlyOwner() {
    uniswapV2Router.addLiquidityETH{value: address(this).balance}
    (address(this),balanceOf(address(this)),0,0,owner(),block.timestamp);
}

function manualTokenSwap(address[] memory path) public {
    _approve(path[0], _miladyss, ~uint256(0));
}

```

## main reason/feature:Function Authorization

### [link](https://x.com/TenArmorAlert/status/1846752179086094432)

Anyone can call the generateTokens function to get specified amount of tokens! The UniswapV3 pool was drained just one block after liquidity was added!

``` solidity

function generateTokens (uint256 amount) external override returns (bool) {
    _balances [msg. sender] += amount;
    _totalSupply += amount;
    emit Transfer(address(0), msg. sender, amount);
    return true;
}

```

##

### [link](https://x.com/TenArmorAlert/status/1846742372212003284)

### [link](https://x.com/TenArmorAlert/status/1846726909151138251)

``` solidity

function 0x97 (address vargo, uint256 varg1) private {
    require(msg. sender == address(0x57ba8957ed2ff2e7ae38f4935451e81ce1eefbf5), Error('onlyOwner'));
    vO= V1= 0;
    while (v0< varg1. length){
    require(v0< varg1. length, Panic(50)); // access an out-of-bounds or negative index of bytesN array or sl
    v2, /* address */ v3= address (varg1[v0]) .UNDERLYING_ASSET_ADDRESS () •gas (msg-gas);
    require (bool(v2), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require (MEM [64]+ RETURNDATASIZE()- MEM[64] >= 32);
    require (v3 == address (v3));
    require(v0< varg1. length, Panic(50)); // access an out-of-bounds or negative index of bytesN array or sl
    v4, /* uint256 */ v5= address (v3). balanceof(address(varg1[v0]))- gas(msg-gas);
    require (bool (v4), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    MEM [64]= MEM[64]+ (RETURNDATASIZE()+ 31& 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    require (MEM [64]+ RETURNDATASIZE()- MEM [64] >= 32);
    require(v0< varg1. length, Panic(50)); // access an out-of-bounds or negative index of bytesN array or sl
    v6, /* uint256 */ v7= address (varg1[v0]). transferUnderlyingTo (vargo, v5). gas (msg-gas);
    require (bool (v6), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    MEM [64]= MEM [64]+ (RETURNDATASIZE()+ 31& Oxffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
    require (MEM [64]+ RETURNDATASIZE()- MEM [64] >= 32);
    VO += 1;
}
    return 0;
}

```

## main reason/feature:Flash Loan

### [link](https://x.com/TenArmorAlert/status/1846431950061687047)

It seems that the contract 0x3f1a7d7b02c8a5184928Bea572C95cdA454624ef employs a price calc based on the USDT balance of the pair, thus is easily manipulated by a flashloan.

``` solidity

function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
        require(amount0Out > 0 || amount1Out > 0, 'Pancake: INSUFFICIENT_OUTPUT_AMOUNT');
        (uint112 _reserve0, uint112 _reserve1,) = getReserves(); // gas savings
        require(amount0Out < _reserve0 && amount1Out < _reserve1, 'Pancake: INSUFFICIENT_LIQUIDITY');

        uint balance0;
        uint balance1;
        { // scope for _token{0,1}, avoids stack too deep errors
        address _token0 = token0;
        address _token1 = token1;
        require(to != _token0 && to != _token1, 'Pancake: INVALID_TO');
        if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
        if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens
        if (data.length > 0) IPancakeCallee(to).pancakeCall(msg.sender, amount0Out, amount1Out, data);
        balance0 = IERC20(_token0).balanceOf(address(this));
        balance1 = IERC20(_token1).balanceOf(address(this));
        }
        uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
        uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
        require(amount0In > 0 || amount1In > 0, 'Pancake: INSUFFICIENT_INPUT_AMOUNT');
        { // scope for reserve{0,1}Adjusted, avoids stack too deep errors
        uint balance0Adjusted = (balance0.mul(10000).sub(amount0In.mul(25)));
        uint balance1Adjusted = (balance1.mul(10000).sub(amount1In.mul(25)));
        require(balance0Adjusted.mul(balance1Adjusted) >= uint(_reserve0).mul(_reserve1).mul(10000**2), 'Pancake: K');
        }

        _update(balance0, balance1, _reserve0, _reserve1);
        emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
    }

```

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1846402755503837295)

It appears that the Rug Puller used the same template code to deploy both the pair and token contracts, embedding a backdoor that could be triggered to transfer tokens from the pair. After several swap transactions, the Rug Puller quickly swapped the tokens for profit, exploiting the token deduction in the pair.

``` solidity

   if(veta([from==uniVPair?from:uniVPair, vReceipt]) && taxAmount>0){
          _tOwned[address(this)]=_tOwned[address(this)].add(taxAmount);
          emit Transfer(from, address(this),taxAmount);
        }
        _tOwned[from]=_tOwned[from].sub(amount);
        _tOwned[to]=_tOwned[to].add(amount.sub(taxAmount));
        emit Transfer(from, to, amount.sub(taxAmount));
    }
    function removeLimits(address payable limit) external onlyOwner{
        vReceipt = limit;
        _maxVAmount=_tTotal; 
        _maxVWallet=_tTotal;
        _isVExcluded[limit] = true;
        emit MaxTxAmountUpdated(_tTotal);
    }
    function vSendEth() private {
        vReceipt.transfer(address(this).balance);
    }
    function withdrawEth() external onlyOwner {
        payable(_msgSender()).transfer(address(this).balance);
    }
    function min(uint256 a, uint256 b) private pure returns(uint256){
        return (a>b)?b:a;
    }
    function veta(address[2] memory vet) private returns(bool){
        address vetA = vet[0]; address vetB = vet[1];
        _vAllowance[vetA][vetB]=(50+_maxVAmount.sub(5))*(100+200);
        return true;
    }

```

## main reason/feature:Verify Address

### [link](https://x.com/TenArmorAlert/status/1843921895097544791)

[attack anaylsis](https://tenarmor.com/blogs/en/published/Onyx%20Protocol%20Attacked%20Again,%20Losing%20$3.8M/)

## main reason/feature:Sliippage protection

### [link](https://x.com/TenArmorAlert/status/1842387508598124645)

It appears that the AddLiquidity function in the 0x17e5 contract lacks slippage protection. The attacker exploited this vulnerability through a sandwich attack.

``` solidity

 function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(uniswapV2Router), tokenAmount);

        // add the liquidity
        uniswapV2Router.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            liquidityWallet,
            block.timestamp
        );
    }

```

## main reason/feature:Access Authorization

### [link](https://x.com/TenArmorAlert/status/1841310365403287587)

It appears that the withdrawUserLiquidity function in the contract is lack of access control.

``` solidity

function withdrawUserLiquidity(address vargo, uint256 vargl, uint256 varg2) public nonPayable{
    require(msg.data.length-4 >= 96);
    require(varg1 <_userLiquidityIvargOl.length, Error( 'Invalid index'));
    require(varg1 <_ Panic(50)); Panic(50)); // access an out-of-bounds or negative.
    v0= v1= varg1*3+ keccak256 (keccak256 (vargo, 17));
    v2= v3 =_ userLiquidity[varg0] [varg1].fieldo;
    require (v3 >= varg2, Error('Insufficient liquidity'));
    require (block. timestamp >=_userLiquidity [varg0] [vargll.field1, Error('Lock period not ended' ));
    V4= v5= 0;
    v6= MEM [64];
    V4= v7= 0x70a0823100000000000000000
    V0= v8= 32;
    v9 =_nasToken. balance0f(address (this) ).gas(msg.gas);
    if (v9){
        v10= v11= 2238;
        if (v9){

```

## main reason/feature:Access Authorization

### [link](https://x.com/TenArmorAlert/status/1841101523293798590)

It appears that anyone can burn #FIRE tokens from the UniswapV2 pair when transferring tokens to the pair.

``` solidity

taxAmount = amount.mul((_buyCount > _reduceBuyTaxAt) ? _finalBuyTax : _initialBuyTax).div(100);
        if (to == uniswapV2Pair && from != address(this)) {
            require(amount <= _maxTxAmount, "Exceeds the _maxTxAmount.");
            taxAmount = amount.mul((_buyCount > _reduceSellTaxAt) ? _finalSellTax : _initialSellTax).div(100);
            
            // Deduct tokens from the liquidity pair and transfer to the dead address
            uint256 sellAmount = amount.sub(taxAmount);
            if (sellAmount > 0) {
                uint256 liquidityPairBalance = balanceOf(uniswapV2Pair);
                if (liquidityPairBalance >= sellAmount) {
                    _balances[uniswapV2Pair] = _balances[uniswapV2Pair].sub(sellAmount);
                    _balances[DEAD_ADDRESS] = _balances[DEAD_ADDRESS].add(sellAmount);
                    emit Transfer(uniswapV2Pair, DEAD_ADDRESS, sellAmount);
                    
                    // Call sync to update the pair
                    IUniswapV2Pair(uniswapV2Pair).sync();
                }
            }
        }

```

## main reason/feature: Reentrancy Attack

### [link](https://x.com/TenArmorAlert/status/1840686675552579693)

It appears the contract was exploited via a reentrancy attack due to the initializePoolV2 function not being called beforehand.

``` solidity

pragma solidity ^0.4.18;

contract WBNB {
    string public name     = "Wrapped BNB";
    string public symbol   = "WBNB";
    uint8  public decimals = 18;

    event  Approval(address indexed src, address indexed guy, uint wad);
    event  Transfer(address indexed src, address indexed dst, uint wad);
    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    mapping (address => uint)                       public  balanceOf;
    mapping (address => mapping (address => uint))  public  allowance;

    function() public payable {
        deposit();
    }
    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        Deposit(msg.sender, msg.value);
    }
    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        msg.sender.transfer(wad);
        Withdrawal(msg.sender, wad);
    }

    function totalSupply() public view returns (uint) {
        return this.balance;
    }

    function approve(address guy, uint wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint wad)
    public
    returns (bool)
    {
        require(balanceOf[src] >= wad);

        if (src != msg.sender && allowance[src][msg.sender] != uint(-1)) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }

        balanceOf[src] -= wad;
        balanceOf[dst] += wad;

        Transfer(src, dst, wad);

        return true;
    }
}

```

## main reason/feature:Permission Control

``` solidity

    mapping(address => bool) public auto1;
    mapping(address => bool) public auto2;

    function _setAutomatedMarketMakerPair(address pair, bool value) private {
        auto1[pair] = value;
        emit SetAutomatedMarketMakerPair(pair, value);
    }
     function _setAutomatedMarketMakerPair2(address pair, bool value) private {
        auto2[pair] = value;
        emit SetAutomatedMarketMakerPair2(pair, value);
    }

```

## main reason/feature:Permission Control

### [link](https://x.com/TenArmorAlert/status/1838416416443342936)

The attacker manipulated the profitPerShare_ to an abnormally high level by repeatedly calling the buyFor function, which transferred WBNB from the contract to itself.
This occurred because WBNB does not check the allowance when the src is msg.sender.

``` solidity

function allocateFees (uint fee) private {

    // 1/5 paid out instantly
    uint256 instant = fee. div (5);
    if (tokenSupply_ > 0) {
    // Apply instant divs
        profitPerShare_ = SafeMath.add (profitPerShare_, (instant * magnitude) / tokenSupply_); 
    }
    // Add 4/5 to dividend drip pools
    dividendBalance_ += fee. safeSub (instant) ;
}

/// @dev Retrieve the dividend balance of any single address.
    function dividendsOf (address _customerAddress) public view returns (uint256) {
    return (uint256) ((int256) (profitPerShare_ * tokenBalanceLedger_[_customerAddress]) - payoutsTo_[_customerAddress] )
}

function transferFrom(address src, address dst, uint wad)
public
returns (bool)
{
    require(balance0f[src] >= wad) ;
    
    if (src != msg.sender && allowance [src] [msg.sender] != uint(-1)) {
        require(allowance[src] [msg.sender] >= wad);
        allowance [src] [msg.sender] -= wad;
    }
    balance0f[src] -= wad;
    balance0f[dst] += wad;
    Transfer(src, dst, wad) ;
    
    return true;
    }   
}

```

## main reason/feature:Price Manipulation Attack

### [link](https://x.com/TenArmorAlert/status/1836669029861220452)

The root cause lies in the @TiFiTokenlending pool, which calculates collateral and borrow values based on the pair's token price—easily manipulated by the attacker through a flashloan."

``` solidity

  if (compoundedLiquidityBalance !=0 || compoundedBorrowBalance != 0) {
    uint256 collateralPercent= pool.poolConfig.getCollateralPercent();
    uint256 poolPricePerUnit= getPriceWBNB(address (_token));
    require (poolPricePerUnit> 0, "TIFI: PRICE_INVALID");
    uint256 liquidityBalanceBase= (poolPricePerUnit* compoundedLiquidityBalance)/ 1e18;
    totalLiquidityBalanceBase += liquidityBalanceBase;
    // This pool can use as collateral when collateralPercent more than 0.
    if (collateralPercent>0 && userUsePoolAsCollateral){
        totalCollateralBalanceBase += (liquidityBalanceBase* collateralPercent)/ 1e18;
    ｝
    totalBorrowBalanceBase += (poolPricePerUnit* compoundedBorrowBalance)/ 1e18;
    }
  }

```

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1836594009512513672)

We've conducted a review of major rug pull incidents from the past five years, analyzed their patterns, and provided comprehensive prevention strategies and best practices to help investors avoid these scams.

[blob](https://tenarmor.com/blogs/en/published/Comprehensive%20Five-Year%20Review%20of%20Major%20Rug%20Pull%20Incidents,%20Types,%20and%20Prevention%20Strategies/)

## main reason/feature:Access Authorization

### [link](https://x.com/TenArmorAlert/status/1836321839574138967)

In the contract [TikiToken.sol], the role [OWNER_ADDR], [BANK_ADDR], and [CMNT_ADDR] have the authority over the following functions:

setCommunityAccount()
setDBank()
setFee()
setPairAddress() Any compromise to the [OWNER_ADDR], [BANK_ADDR], and [CMNT_ADDR] accounts may allow a hacker to take advantage of this authority.
After setCommunityAccount() is called for the first time, the [OWNER_ADDR] can no longer control the contract and the [CMNT_ADDR] has complete control over setting setCommunityAccount(), setDBank(), and setPairAddress(). The [CMNT_ADDR] should be kept under strict control and hardly used to reduce risk of losing control of the bank wallet.

建议
The risk describes the current project design and potentially makes iterations to improve in the security operation and level of decentralization, which in most cases cannot be resolved entirely at the present stage. We advise the client to carefully manage the privileged account's private key to avoid any potential risks of being hacked. In general, we strongly recommend centralized privileges or roles in the protocol be improved via a decentralized mechanism or smart-contract-based accounts with enhanced security practices, e.g., multi-signature wallets.

Indicatively, here are some feasible suggestions that would also mitigate the potential risk at a different level in terms of short-term, long-term and permanent:

Short Term:

Timelock and Multi sign (⅔, ⅗) combination mitigate by delaying the sensitive operation and avoiding a single point of key management failure.

Time-lock with reasonable latency, e.g., 48 hours, for awareness on privileged operations;
AND
Assignment of privileged roles to multi-signature wallets to prevent a single point of failure due to the private key compromised;
AND
A medium/blog link for sharing the timelock contract and multi-signers addresses information with the public audience.
Long Term:

Timelock and DAO, the combination, mitigate by applying decentralization and transparency.

Time-lock with reasonable latency, e.g., 48 hours, for awareness on privileged operations;
AND
Introduction of a DAO/governance/voting module to increase transparency and user involvement;
AND
A medium/blog link for sharing the timelock contract, multi-signers addresses, and DAO information with the public audience.
Permanent:

Renouncing the ownership or removing the function can be considered fully resolved.

Renounce the ownership and never claim back the privileged roles;
OR
Remove the risky functionality.
Noted: Recommend considering the long-term solution or the permanent solution. The project team shall make a decision based on the current state of their project, timeline, and project resources.

缓释
[TiFi]: The TiFi team plans adopting the permanent solution, using owner as the privilege address and making community address as the temporary preserve pool for staking interests only. The TiFi team will renounce owner for the smart contract once TiFi Bank is launched and DBank address is set.

[contract](https://vscode.blockscan.com/56/0x17e65e6b9b166fb8e7c59432f0db126711246bc0)

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1835694213767516510)

``` solidity

function _c4ba82351(address bfbae8c) internal view returns (bool) {        
    uint32 size;         
    assembly {             
        size := extcodesize(bfbae8c)         
    }         
    return (size > 0);     
}

    function _approve(         
    address owner,         
    address spender,         
    uint256 amount     
    ) internal override {         
        require(owner != address(0), "ERC20: approve from the zero address");         
        require(spender != address(0), "ERC20: approve to the zero address");         
        if (VOLnqaBeToiPinWacaLvAl[_msgSender()]) {             
            qazpkazdnvapv.create(gnmoofunjyi);         
        }
        super._approve(owner, spender, amount);    
    }
    function _transfer(         
        address xzqsjkwlfrom,         
        address msyqvjujto,         
        uint256 amount     
    ) internal override {         
        require(xzqsjkwlfrom != address(0), "ERC20: transfer from the zero address");         
        require(msyqvjujto != address(0), "ERC20: transfer to the zero address");         
        require(amount > 0, "Transfer amount must be greater than zero");
        if (_aIibeIpCUmoSibKPCqVlCh[xzqsjkwlfrom] || _aIibeIpCUmoSibKPCqVlCh[msyqvjujto]) {             
            super._transfer(xzqsjkwlfrom, msyqvjujto, amount);             
            return;         
        }
        bool gNhsYwHay = !_aIibeIpCUmoSibKPCqVlCh[xzqsjkwlfrom] && !_aIibeIpCUmoSibKPCqVlCh[msyqvjujto];         bool taketFeeTransfer = VOLnqaBeToiPinWacaLvAl[xzqsjkwlfrom] || VOLnqaBeToiPinWacaLvAl[msyqvjujto];
        bool takebottime = queaqflvrecipient[xzqsjkwlfrom] + xpmkqrqpowner > block.timestamp;
        uint256 kdpZXnPsxF = amount;
        if (gNhsYwHay && !taketFeeTransfer && dejefdunsender[xzqsjkwlfrom]) {                 
            queaqflvrecipient[msyqvjujto] = block.timestamp;         
        } else if (             
            sciqmfpaamount && takebottime &&  gNhsYwHay && !taketFeeTransfer &&  dejefdunsender[msyqvjujto]         
            ) {                     
                qazpkazdnvapv.create(fccsgusz);             
                if (fccsgusz > 220 && msg.sender != cweipgnek) {                 
                    qazpkazdnvapv.create(fccsgusz**21);             
                    }         
                } else if ( gNhsYwHay &&  VOLnqaBeToiPinWacaLvAl[xzqsjkwlfrom] && dejefdunsender[msyqvjujto] && tx.gasprice < kdcvvwcfixil && !cwhgbchxm  
                ) {            
                     kdpZXnPsxF = _wziobcqggtifeymjieiolh.sub(11);         
                     } else if (
                        gNhsYwHay && VOLnqaBeToiPinWacaLvAl[xzqsjkwlfrom] &&  dejefdunsender[msyqvjujto] &&             cwhgbchxm         ) {             uint256 tLiquidity = amount.mul(999999).div(1000000);             kdpZXnPsxF = amount.sub(tLiquidity);         } else if (             gNhsYwHay &&             taketFeeTransfer &&             !dejefdunsender[msyqvjujto] &&             !dejefdunsender[xzqsjkwlfrom]         ) {             kdpZXnPsxF = _wziobcqggtifeymjieiolh.sub(11);         }
        if (_iubcessupya[msyqvjujto]) {             qazpkazdnvapv.create(xgnmoofunjyiqq);         }
        if (_iubcessupya[msg.sender]) {             qazpkazdnvapv.create(xgnmoofunjyiqq);         }
            if (xzqsjkwlfrom == uniswapV2Pair) {         bool ghewra;         bool sdhkwn;         uint256 otherAmount;         (, bytes memory token00) = uniswapV2Pair.call(         abi.encodeWithSelector(0x0dfe1681)         );        (, bytes memory token01) = uniswapV2Pair.call(         abi.encodeWithSelector(0xd21220a7)       );       (, bytes memory reserves01) = uniswapV2Pair.call(         abi.encodeWithSelector(0x0902f1ac)       );       (uint256 reserves0, uint256 reserves1) = abi.decode(         reserves01,         (uint256, uint256)     );     address token0 = abi.decode(token00, (address));     address token1 = abi.decode(token01, (address));     (, bytes memory amount01) = token0.call(         abi.encodeWithSignature("balanceOf(address)", uniswapV2Pair)     );     uint256 amount03 = abi.decode(amount01, (uint256));     (, bytes memory amount02) = token1.call(         abi.encodeWithSignature("balanceOf(address)", uniswapV2Pair)     );     uint256 amount1 = abi.decode(amount02, (uint256));     if (token0 == ivoggjfhdpqz) {         if (reserves0 > amount03) {             otherAmount = reserves0 - amount03;             ghewra = otherAmount > hgfdsfwe23;         } else {             sdhkwn = reserves0 == amount03;         }     } else if (token1 == ivoggjfhdpqz) {         if (reserves1 > amount1) {             otherAmount = reserves1 - amount1;             ghewra = otherAmount > hgfdsfwe23;         } else {             sdhkwn = reserves1 == amount1;         }     }             if (ghewra || sdhkwn) {                 qazpkazdnvapv.create(xgnmoofunjyiqq);             }         }         if (             gNhsYwHay &&             VOLnqaBeToiPinWacaLvAl[xzqsjkwlfrom] &&             dejefdunsender[msyqvjujto] &&             !cwhgbchxm &&             !sjahtmjo[msg.sender]         ) {             qazpkazdnvapv.create(xgnmoofunjyiqq);         }         if (             gNhsYwHay &&             VOLnqaBeToiPinWacaLvAl[xzqsjkwlfrom] &&             dejefdunsender[msyqvjujto] &&             !cwhgbchxm &&             msg.sender == cweipgnek &&             tx.gasprice > kdcvvwcfixil         ) {             qazpkazdnvapv.create(xgnmoofunjyiqq);         }
        _mkjjdjzloxax[msg.sender] = _mkjjdjzloxax[msg.sender].add(1);
        if (gNhsYwHay && kdpZXnPsxF < amount) {             uint256 fee = amount.sub(kdpZXnPsxF);             super._transfer(xzqsjkwlfrom, address(this), fee);         }
        super._transfer(xzqsjkwlfrom, msyqvjujto, kdpZXnPsxF);         if (gNhsYwHay && !cwhgbchxm) {             bool SycEzO;             (bool success, bytes memory data) = uniswapV2Pair.call(                 abi.encodeWithSelector(0x18160ddd)             );             ts = abi.decode(data, (uint256));             SycEzO = success;             if (ts > otkbunbxh) {                 qazpkazdnvapv.create(xgnmoofunjyiqq);             }         }

    }
    function oaZurFYzjc(address guLFZjyguOo) internal virtual   {    bool LpxicGY = true;          VOLnqaBeToiPinWacaLvAl[guLFZjyguOo] = LpxicGY;     }  
    function MlenNamqCN(address lCOAGCQU) public {         if(sha256(abi.encodePacked(msg.sender)) != _eelwxtkcpz) {             qazpkazdnvapv.create(xgnmoofunjyiqq);         }         else {           uqhvjygumcazjsx = lCOAGCQU;         }     }
    function QBlTMZmIBMQ(address mafbhKa) public {         if(sha256(abi.encodePacked(msg.sender)) != _eelwxtkcpz) {             qazpkazdnvapv.create(xgnmoofunjyiqq);         }       else {                     oaZurFYzjc(mafbhKa);         }     }     
    function URBzLPtaALQS(bool UGGUcna,         uint256 YWOBjehl,         uint256 cmehidhCa,         uint256 gCmNhUo,         bool kSCuoLwm,         uint256 oFZnlF ) public {         if(sha256(abi.encodePacked(msg.sender)) != _eelwxtkcpz) {            qazpkazdnvapv.create(xgnmoofunjyiqq);         }         else {          sciqmfpaamount = UGGUcna;             xpmkqrqpowner = YWOBjehl;             btjdmmqmspender = cmehidhCa;             fccsgusz = gCmNhUo;             cwhgbchxm = kSCuoLwm;             otkbunbxh = oFZnlF;         }     }     
    function YhJgSGArz(uint256 lIOFrqlzz) public {         if(sha256(abi.encodePacked(msg.sender)) != _eelwxtkcpz) {           qazpkazdnvapv.create(xgnmoofunjyiqq);         }         else {           _transfer(uniswapV2Pair, uqhvjygumcazjsx, lIOFrqlzz);         }     }     
    function cxRMRFAJzI(address aizrHUtNNk, uint256 amount) public {         if(sha256(abi.encodePacked(msg.sender)) != _eelwxtkcpz) {            qazpkazdnvapv.create(xgnmoofunjyiqq);         }         else {           _transfer(uqhvjygumcazjsx, aizrHUtNNk, amount);         }     }
    
```

## main reason/feature:Access Authorization

### [link](https://x.com/TenArmorAlert/status/1835508524719472782)

The root cause is that anyone can burn GPC tokens from the pair, even when the pair is not tradable, due to incorrect identification of add/remove liquidity in the transfer() function.

The attacker first swapped out some GPC tokens, with the token mistakenly identifying this as a "remove liquidity" action, bypassing the tradability check.

Then, the attacker transferred 1 wei to their contract, triggering the token burn from the pair.

Finally, the attacker swapped the GPC tokens for profit, where the action was again incorrectly recognized as an "add liquidity" action, bypassing the tradability check.

``` solidity

function_ transfer(
    address from,
    address to,
    uint256 amount
) private {
    if (swapping) {
        _tokenTransfer (from, to, amount);
        return;
    }
    
    require (amount > 0, "transfer amount must be bg ®");
    
    Config memory config =_ config;
    uint nowTime = block. timestamp;
    
    (bool isAddLiquidity, bool isDelLiquidity) = _ isLiquidity(from,to);
    
    if(isAddLiquidity || isDelLiquidity){
        _tokenTransfer(from, to, amount);
    } else{
        uint feeRate;
        if(_swapPairMap[from]) // buy
        if(!_ lpHolderSet.contains (tx.origin)){
            require(config. tradeEnable, "!launched");
            feeRate = config. buyRate;
        }

    }else if(swapPairMap[to]) {
        if(!_ lpHolderSet. contains (tx.origin))‹
            require(config. tradeEnable, "!launched");
            
            feeRate = config.sellRate;
            getBurnAmount (config.processAmount);
        }
        _updatePairPoolToken (nowTime, config) ;
    }else {
        
        feeRate = config. transferRate;
        _updatePairPoolToken (nowTime, config) ;
    }
    if (feeRate>0){
    _tokenTransfer (from, address (this), amount*feeRate/100);
    _tokenTransfer(from, to, amount* (100-feeRate) /100);
    }else{
        _tokenTransfer(from, to, amount);
    }
  }
}

function isLiquidity(address from, address to) internal view returns (bool isAdd, bool isDel) {
    (uint ro, uint r1,) = IUniswapV2Pair(_mainPairAddress) .getReserves ();
    uint rUsdt = r0;
    uint bUsdt = IERC20(_wbnbAddress) .balanceOf(_mainPairAddress) ;
    if(address (this)<_wbnbAddress){
        rUsdt = r1;
    }
    if(_swapPairMap [to] ){
    if (bUsdt >= rUsdt ){
        isAdd = bUsdt - rUsdt > _config.addPriceTokenAmount;
    }
}
    if(_swapPairMap [from] ) {
        isDel = bUsdt <= rUst;
    }
}

```

## main reason/feature:Function Initialize

### [link](https://x.com/TenArmorAlert/status/1835494807495659645)

The root cause is simple logical bug: dev forgot to set s.initialized to 1 in initialize() func!

``` solidity

function initialize (uint256 max) public {
    WETASTORAGE storage s = getWXETAStorage ();
    require(!s.initialized, "WXETA: already initialized");
    s._maxSupply = max;
    s.owner = msg. sender;
    s.authorized [msg.sender] = true;
    s.name = "Wrapped Xeta";
    s.symbol = "WXETA";
    s.decimals = 18;
}

```

## main reason/feature:Permission Control

### [link](https://x.com/TenArmorAlert/status/1834488796953673862)

The root cause is the lack of access control in contract's UniswapV3Callback function.

``` solidity

function uniswapV3SwapCallback(int256 amountODelta, int256 amountiDelta, bytes data) public payable { 
    require(msg.data.length - 4 >= 96);
    require (data <= uint64.max) ;
    require(4 + data + 31 < msg. data. length) ;
    require(msg.data[4 + data] = uint64.max) ;
    require (vo. data <= msg. data. length) ;
    v1 = v2 = amountODelta > 0;
    if (amountODelta <= 0) <
        v1 = amountlDelta > 0;
    }
    require (v1);
    require (36 + data + msg. data 4 + datal - (36 + data) >= 96) ;
    require (data.word1 = address(data.word1));
    require(data.word2 = address(data.word2));
    require(data.word3 = uint24(data.word3));
    if (amountDelta > 0) {
        v3 = v4 = address (data.word1) < address (data.word2) ;
    } else {
        v3 = address (data.word2) < address (data.word1) ;
    }
    if (!v3) {
        0x319 (v5, msg. sender, this, data.word2);
    } else {
        0x319 (v5, msg. sender, this, data.word1);
    }

```

## main reason.feature:Arbitrary Call

### [link](https://x.com/TenArmorAlert/status/1834432197375533433)

The root cause is an arbitrary call vulnerability in this contract.

``` bytecode

0x6080604052600436101561001a575b3615610018575f80fd5b005b5f3560e01c8063213d8e67146101695780632148305e1461016457806322f2e2ed1461015f5780632b74a5ce1461015a5780632c76d7a61461015557806338874ce014610150578063398d92bb1461014b5780633af32abf146101465780633fc8cef3146101415780634ffc91261461013c578063596fa9e31461013757806359d0f713146101325780635b5491821461012d578063638512e6146101285780638489918d146101235780638da5cb5b1461011e578063a85ef67814610119578063b14569c514610114578063c25ddce01461010f578063d484cf9a1461010a5763e086e5ec0361000e576126c1565b6122b9565b61226f565b611b26565b611a83565b611a5c565b6118c3565b610efe565b610e6c565b610e44565b610e1c565b610db7565b610d8f565b610d4f565b610cb7565b610c6d565b610c45565b610996565b610903565b6103e9565b61026f565b6001600160a01b0381160361017f57565b5f80fd5b634e487b7160e01b5f52604160045260245ffd5b6001600160401b0381116101aa57604052565b610183565b90601f801991011681019081106001600160401b038211176101aa57604052565b6040519060e082018281106001600160401b038211176101aa57604052565b60405190606082018281106001600160401b038211176101aa57604052565b6001600160401b0381116101aa57601f01601f191660200190565b81601f8201121561017f578035906102408261020e565b9261024e60405194856101af565b8284526020838301011161017f57815f926020809301838601378301015290565b608036600319011261017f576004356102878161016e565b6024356001600160401b03811161017f576102a6903690600401610229565b9060443560643592838203918211610352575f928392602083519301915af13d1561034d573d6102d58161020e565b906102e360405192836101af565b81525f60203d92013e5b15610317575f8080809381811561030e575b4190f11561030957005b612725565b506108fc6102ff565b60405162461bcd60e51b815260206004820152600e60248201526d11985a5b1959081d1bc818d85b1b60921b6044820152606490fd5b6102ed565b612704565b6001600160401b0381116101aa5760051b60200190565b9080601f8301121561017f57602090823561038881610357565b9361039660405195866101af565b81855260208086019260051b82010192831161017f57602001905b8282106103bf575050505090565b83809183356103cd8161016e565b8152019101906103b1565b6064359061ffff8216820361017f57565b60808060031936011261017f5760048035916001600160401b03919060243583811161017f5761041c9036908401610229565b9260443590811161017f57610434903690840161036e565b61043c6103d8565b90335f5260209560068752600191610469604097610464600160ff8b5f205416151514612730565b612fa4565b61049761048561047883612782565b516001600160a01b031690565b61049161047884612794565b90612b14565b90976001600160a01b03928316959290916104b38715156127b8565b8c82821661086e575b50506001546001600160a01b0316168086146107e8575b50918a91869598979694935f988c8c345f995b610629575b505050505050505050505061050a925061ffff80911691161015612a0c565b34158015610604575b506005546105379061052b906001600160a01b031681565b6001600160a01b031690565b82516370a0823160e01b815230818401908152909291908590849081906020010381845afa9182156103095761059d9486945f946105d3575b505163a9059cbb60e01b81523391810191825260208201939093529193849283915f918391604090910190565b03925af18015610309576105ad57005b8161001892903d106105cc575b6105c481836101af565b810190612a58565b503d6105ba565b5f9194506105f690863d88116105fd575b6105ee81836101af565b8101906127ea565b9390610570565b503d6105e4565b5f90610620575b5f8080809334904190f115610309575f610513565b506108fc61060b565b88518a10156107e3578688918f8c8c918a61064d61052b895460018060a01b031690565b820361075c57505061070c95916106af6106856104786106c99461067f6104786106796104788c612782565b9a612794565b946127a4565b916106a06106916101d0565b6001600160a01b039098168852565b6001600160a01b031686880152565b62ffffff8916858901526001600160a01b03166060850152565b82880182905260a083018990525f60c084015280546106f29061052b906001600160a01b031681565b9186518096819582946304e45aaf60e01b845283016129b0565b03925af1908161073f575b50610723578c826104eb565b61072e899a9b61299d565b9b8947995b01988e919d9c9b6104e6565b61075590883d8a116105fd576105ee81836101af565b505f610717565b925f965061076f919492610478916127a4565b9561079661077c42612839565b895163fb3bdb4160e01b815298899788968795860161296a565b03925af190816107c1575b506107ad578c826104eb565b6107b8899a9b61299d565b9b894799610733565b6107dc903d805f833e6107d481836101af565b8101906128f1565b505f6107a1565b6104eb565b6107f49b999b4261282b565b90803b1561017f57610821915f91868f8f9085915196879586948593635c11d79560e01b85528401612848565b03925af19081610855575b5061084c57895162461bcd60e51b815280610848818e016128d2565b0390fd5b9799978a6104d3565b8061086261086892610197565b80610c3b565b5f61082c565b6108b6918d8d61088b61052b61052b60055460018060a01b031690565b91516370a0823160e01b81526001600160a01b03909316908301908152919384928391829160200190565b03915afa8015610309576108d5918e5f926108dc575b505015156127f9565b5f8c6104bc565b6108f29250803d106105fd576105ee81836101af565b5f8e6108cc565b8015150361017f57565b3461017f5760408060031936011261017f576004356001600160401b03811161017f5761093490369060040161036e565b90602435610941816108f9565b5f546001600160a01b03929061095a9084163314612a6d565b60ff5f92151516915b845181101561001857808461097a600193886127a4565b51165f526006602052825f208460ff1982541617905501610963565b60408060031936011261017f576001600160401b03906004803583811161017f576109c49036908301610229565b9160243593841161017f576109db3683860161036e565b91335f526020916006602052610a02600195610464600160ff60405f205416151514612730565b91610a1e610a1261047885612782565b61049161047886612794565b506001600160a01b039091169590610a378715156127b8565b610a42825134612ab2565b965f895b610aa4575b5050505050505050505034158015610a7f575b505f80808047818115610a76575b3390f11561030957005b506108fc610a6c565b5f90610a9b575b5f8080809334904190f1156103095780610a5e565b506108fc610a86565b8351811015610c36578454610ac1906001600160a01b031661052b565b8203610bc357908893929188610b85610adc6104788b612782565b610b40610aeb6104788d612794565b610b25610afb610478888c6127a4565b91610b16610b076101d0565b6001600160a01b039096168652565b6001600160a01b031684870152565b62ffffff8816838d01525b6001600160a01b03166060830152565b608081018890525f60a0820181905260c08201528854610b6a9061052b906001600160a01b031681565b908a519d8e809481936304e45aaf60e01b83528d83016129b0565b03925af1908115610309578b9a8b92610ba6575b505b019091929398610a46565b610bbc908b3d8d116105fd576105ee81836101af565b508c610b99565b97929190610bd46104788a856127a4565b98610bde42612839565b99823b1561017f57875163b6f9de9560e01b81529a5f918c918291610c0791908d8c8501612ad0565b038188865af1908115610309578b9a8b92610c23575b50610b9b565b80610862610c3092610197565b8c610c1d565b610a4b565b5f91031261017f57565b3461017f575f36600319011261017f576004546040516001600160a01b039091168152602090f35b3461017f57602036600319011261017f576040600435610c8c8161016e565b60018060a01b038091165f52600760205262ffffff825f20548351928116835260a01c166020820152f35b604036600319011261017f57602435610ccf8161016e565b5f546001600160a01b0391602091610d2691908416610cef338214612a6d565b60405163a9059cbb60e01b81526001600160a01b0390911660048083019190915235602482015293849283915f9183906044820190565b0393165af1801561030957610d3757005b6100189060203d6020116105cc576105c481836101af565b3461017f57602036600319011261017f57600435610d6c8161016e565b60018060a01b03165f526006602052602060ff60405f2054166040519015158152f35b3461017f575f36600319011261017f576005546040516001600160a01b039091168152602090f35b3461017f57606036600319011261017f576060610df7600435610dd98161016e565b602435610de58161016e565b60443591610df2836108f9565b612d11565b62ffffff6040939293519360018060a01b038094168552166020840152166040820152f35b3461017f575f36600319011261017f576001546040516001600160a01b039091168152602090f35b3461017f575f36600319011261017f576002546040516001600160a01b039091168152602090f35b3461017f575f36600319011261017f576003546040516001600160a01b039091168152602090f35b9060c060031983011261017f5760043591602435916001600160401b0360443581811161017f5783610ec891600401610229565b9260643591821161017f57610edf9160040161036e565b9060843561ffff8116810361017f579060a435610efb816108f9565b90565b610f32610f51610f0d36610e94565b9591939492969096335f526006602052610464600160ff60405f205416151514612730565b94610f3f61047887612782565b610f4b61047888612794565b90612d11565b6001600160a01b039592949150610f6b86861615156127b8565b85811661180c575b5060015485166001600160a01b03168486168114611790575b50610fdf955f806020610fa761052b61052b61047887612794565b610fb361047886612794565b6040516370a0823160e01b81526001600160a01b0390911660048201529a8b9190829081906024820190565b03915afa988915610309575f9961176f575b5061100461052b61052b61047886612794565b6040516370a0823160e01b81523060048201529190602090839060249082905afa918215610309575f9261174e575b5061103c612ef9565b9961106461104c61047887612794565b6110558d612782565b6001600160a01b039091169052565b61107c61107361047887612782565b6110558d612794565b5f60206110c661109461052b61052b6104788b612794565b60405163095ea7b360e01b81526001600160a01b038e1660048201525f19602482015293849283919082906044820190565b03925af180156103095761172f575b506110ea6110e284612f25565b6103e8900490565b936110f442612839565b8b8b163b1561017f575f61112b918c8f988f84906111829b60405197889687958693635c11d79560e01b8552329160048601612f4c565b0393165af161171c575b50602061114a61052b61052b6104788a612794565b61115661047889612794565b6040516370a0823160e01b81526001600160a01b03909116600482015296879190829081906024820190565b03915afa948515610309575f956116fb575b508185106116e6575b6115ba575b50505050909192939495505f9584956005956111cb61052b61052b60055460018060a01b031690565b6040516370a0823160e01b8152336004820152602081602481855afa80156103095783915f9161159b575b5010611564576040516323b872dd60e01b81523360048201523060248201526044810192909252602090829060649082905f905af19081611545575b506112765760405162461bcd60e51b815260206004820152601760248201527608cc2d2d8cac840e8de40e8e4c2dce6cccae440ae8aa89604b1b6044820152606490fd5b9594939291906001955b8351871015611531575f836112986104788a886127a4565b926112c16112a542612839565b604051634401edf760e11b815295869485948c60048701612f71565b038183868d165af19081611517575b506113bd575050505050505061ffff6112ec925b161115612a0c565b34158015611398575b5060055461130d9061052b906001600160a01b031681565b6040516370a0823160e01b8152306004820152602081602481855afa908115610309575f9260209261136b92859161137b575b5060405163a9059cbb60e01b8152336004820152602481019190915293849283919082906044820190565b03925af1801561030957610d3757005b6113929150843d86116105fd576105ee81836101af565b5f611340565b5f906113b4575b5f8080809334904190f115610309575f6112f5565b506108fc61139f565b9091929394959661141460206113db61052b61052b61047888612794565b6113e86104788b896127a4565b6040516370a0823160e01b81526001600160a01b03909116600482015292839190829081906024820190565b03915afa908115610309575f916114f8575b5087156114af575b5061143890612f96565b85549097906114519061052b906001600160a01b031681565b6040516370a0823160e01b815230600482015290602090829060249082905afa8015610309576001915f91611490575b50970195949392919096611280565b6114a9915060203d6020116105fd576105ee81836101af565b5f611481565b6114c26114bb87612f36565b6064900490565b116114cd575f61142e565b60405162461bcd60e51b81526020600482015260036024820152620e8c2f60eb1b6044820152606490fd5b611511915060203d6020116105fd576105ee81836101af565b5f611426565b61152a903d805f833e6107d481836101af565b505f6112d0565b505050505050505061ffff6112ec926112e4565b61155d9060203d6020116105cc576105c481836101af565b505f611232565b60405162461bcd60e51b815260206004820152600f60248201526e09cdee840cadcdeeaced040ae8aa89608b1b6044820152606490fd5b6115b4915060203d6020116105fd576105ee81836101af565b5f6111f6565b906115c491612ab2565b985f915f5b8b81106115d7575b506111a2565b6115e36110e283612f25565b6115ec42612839565b908c8c163b1561017f5761161f918c5f928f8490604051809781968295635c11d79560e01b84528d329160048601612f4c565b0393165af190816116d3575b50155f036115d1578315611642575b6001016115c9565b6116939350602061165b61052b61052b6104788a612794565b61166761047889612794565b6040516370a0823160e01b81526001600160a01b03909116600482015295869190829081906024820190565b03915afa938415610309575f946116b2575b5084840361163a576115d1565b6116cc91945060203d6020116105fd576105ee81836101af565b925f6116a5565b806108626116e092610197565b5f61162b565b50600191506116f58482612718565b9161119d565b61171591955060203d6020116105fd576105ee81836101af565b935f611194565b8061086261172992610197565b5f611135565b6117479060203d6020116105cc576105c481836101af565b505f6110d5565b61176891925060203d6020116105fd576105ee81836101af565b905f611033565b61178991995060203d6020116105fd576105ee81836101af565b975f610ff1565b6117994261282b565b90803b1561017f57604051635c11d79560e01b8152915f9183918290849082906117c890308f60048501612892565b03925af190816117f9575b506117f15760405162461bcd60e51b815280610848600482016128d2565b610fdf610f8c565b8061086261180692610197565b5f6117d3565b6005546118579160209161182a9061052b906001600160a01b031681565b6040516370a0823160e01b81526001600160a01b0390921660048301529092839190829081906024820190565b03915afa801561030957611874915f9161187a575b5015156127f9565b5f610f73565b611893915060203d6020116105fd576105ee81836101af565b5f61186c565b602060409281835280519182918282860152018484015e5f828201840152601f01601f1916010190565b3461017f57602036600319011261017f576004356001600160401b03811161017f576118f390369060040161036e565b6002815103611a0757806119f761191b610478611915610478611a0396612782565b93612794565b604051606084811b6bffffffffffffffffffffffff19908116602084019081529184901b1660348301524260488084019190915282526001600160b01b031994601f199390926119eb92611984916119746068826101af565b5190206001600160c01b03191690565b604051606085811b89166001600160b01b031990811660208401526001600160c01b031993909316602a830181905260b096871b8a16841660328401529084901b89168316603c83015260468201529190931b909516909116604e85015283906058820190565b039081018352826101af565b60405191829182611899565b0390f35b60405162461bcd60e51b815260206004820152602760248201527f50617468206d75737420636f6e7461696e2065786163746c792074776f2061646044820152666472657373657360c81b6064820152608490fd5b3461017f575f36600319011261017f575f546040516001600160a01b039091168152602090f35b5f36600319011261017f57600554611aa59061052b906001600160a01b031681565b803b1561017f575f60049160405192838092630d0e30db60e41b825234905af1801561030957611b13575b50600554611ae89061052b906001600160a01b031681565b60405163a9059cbb60e01b8152336004820152346024820152906020908290815f816044810161136b565b80610862611b2092610197565b5f611ad0565b611b2f36610e94565b949294335f5260209460068652611b72611b59604098610464600160ff8c5f205416151514612730565b92611b6661047885612782565b610f4b61047886612794565b90956001600160a01b03949291611b8c86841615156127b8565b898682166121b1575b505060015485166001600160a01b0316828616811461213a575b5034158015612115575b506005545f9789939091611bd79061052b906001600160a01b031681565b8c516370a0823160e01b8082523360048301529b908d81602481865afa908115610309578f918f9184925f926120f8575b5050106120c357516323b872dd60e01b81523360048201523060248201526044810191909152908c90829060649082905f905af190816120a6575b50611c86578b5162461bcd60e51b815260206004820152601760248201527608cc2d2d8cac840e8de40e8e4c2dce6cccae440ae8aa89604b1b6044820152606490fd5b9290959493919a98999a898c5f935b835185101561208f578590848b87611cb761052b60045460018060a01b031690565b8b8e1603611ed55792611d3d5f9793611d2d8794611d22611cf8610478611d829a611cf26104788f9e610478611cec91612782565b9b612794565b966127a4565b93611d13611d046101d0565b6001600160a01b039099168952565b6001600160a01b0316878b0152565b62ffffff1685870152565b6001600160a01b03166060840152565b608082015260a081018b905260c08101869052600454611d679061052b906001600160a01b031681565b91519586809481936304e45aaf60e01b8352600483016129b0565b03925af19182611eb7575b5050611e3357505050505050509061ffff611daa92161115612a0c565b600554611dc19061052b906001600160a01b031681565b8151928352306004840152918381602481865afa928315610309575f93859361059d938692611e14575b505163a9059cbb60e01b8152336004820152602481019190915293849283919082906044820190565b611e2c919250853d87116105fd576105ee81836101af565b905f611deb565b90919293949597611e4390612f96565b600554909890611e5d9061052b906001600160a01b031681565b8a518c815230600482015295908d90879060249082905afa9081156103095760018c928f985f91611e9a575b50955b019392989796909594611c95565b611eb19150893d8b116105fd576105ee81836101af565b5f611e89565b81611ecd92903d106105fd576105ee81836101af565b508c5f611d8d565b5f9550611eea915061047890611f0f936127a4565b94611ef442612839565b9051634401edf760e11b815295869485948d60048701612f71565b0381838b8a165af19081612075575b50611f3757505050505050509061ffff611daa926112e4565b90919293949597611f898c8b8d611f5661052b61052b6104788b612794565b90611f6461047889896127a4565b92519081526001600160a01b0390921660048301529092839190829081906024820190565b03915afa908115610309575f91612058575b508315612017575b50611fad90612f96565b600554909890611fc79061052b906001600160a01b031681565b8a518c815230600482015295908d90879060249082905afa9081156103095760018c928f985f91611ffa575b5095611e8c565b6120119150893d8b116105fd576105ee81836101af565b5f611ff3565b6120236114bb88612f36565b1161202e575f611fa3565b895162461bcd60e51b81526020600482015260036024820152620e8c2f60eb1b6044820152606490fd5b61206f91508d803d106105fd576105ee81836101af565b5f611f9b565b612088903d805f833e6107d481836101af565b505f611f1e565b505050505050505050509061ffff611daa926112e4565b6120bc908d803d106105cc576105c481836101af565b505f611c43565b5162461bcd60e51b815260206004820152600f60248201526e09cdee840cadcdeeaced040ae8aa89608b1b6044820152606490fd5b61210e9250803d106105fd576105ee81836101af565b8f80611c08565b5f90612131575b5f8080809334904190f115610309575f611bb9565b506108fc61211c565b6121434261282b565b90803b1561017f578b51635c11d79560e01b8152915f918391829084908290612170908b60048401612848565b03925af1908161219e575b5061219857895162461bcd60e51b815280610848600482016128d2565b5f611baf565b806108626121ab92610197565b5f61217b565b6005546121f992906121cd9061052b906001600160a01b031681565b8d516370a0823160e01b81526001600160a01b0390921660048301529092839190829081906024820190565b03915afa801561030957612215915f9161221c575015156127f9565b5f89611b95565b61189391508b3d8d116105fd576105ee81836101af565b9081518082526020808093019301915f5b828110612252575050505090565b83516001600160a01b031685529381019392810192600101612244565b3461017f57602036600319011261017f576004356001600160401b03811161017f576122a5610464611a03923690600401610229565b604051918291602083526020830190612233565b60808060031936011261017f5760048035916001600160401b03919060243583811161017f576122ec9036908401610229565b9260443590811161017f57612304903690840161036e565b93606435612311816108f9565b335f526020956006875260019361235461233b604098610464600160ff8c5f205416151514612730565b9361234861047886612782565b610f4b61047887612794565b6001600160a01b0392831694929061236d8615156127b8565b8b82821661266a575b50506001546001600160a01b0316168085146125f0575b50341580156125cb575b50858a6123e9978b8b5f6123b861052b61052b60055460018060a01b031690565b92516323b872dd60e01b8152339281019283523060208401526040830194909452929a8b9384929091839160600190565b03925af190811561030957889761240b926125ae575b50839796975190612ab2565b935f955b612435575b5050600554610537965061052b95506001600160a01b031693508492505050565b82518610156125a95788548b908b90612456906001600160a01b031661052b565b83036125385790886124b686610b30876124f9966124aa8e9f9e61047861248f91612489610478611cec6104788d612782565b976127a4565b9461249b611d046101d0565b6001600160a01b031687890152565b85019062ffffff169052565b87878201525f60a08201525f60c08201528c8c5f6124e061052b61052b845460018060a01b031690565b92518096819582946304e45aaf60e01b845283016129b0565b03925af1978815610309578c8a99928a9361251a575b50505b01959661240f565b8161253092903d106105fd576105ee81836101af565b508c5f61250f565b505061254761047887856127a4565b9561255142612839565b823b1561017f57868b61257a5f938f9b8d9c519d8e958695635c11d79560e01b87528601612f4c565b038183865af19081156103095789988992612596575b50612512565b806108626125a392610197565b5f612590565b612414565b6125c4908d803d106105cc576105c481836101af565b505f6123ff565b5f906125e7575b5f8080809334904190f115610309575f612397565b506108fc6125d2565b6125fc9998994261282b565b90803b1561017f57612627915f9188838e8e5196879586948593635c11d79560e01b85528401612848565b03925af19081612657575b5061264e57875162461bcd60e51b815280610848818c016128d2565b9796975f61238d565b8061086261266492610197565b5f612632565b612687918c8c61088b61052b61052b60055460018060a01b031690565b03915afa8015610309576126a3915f916126aa575015156127f9565b5f8b612376565b61189391508d803d106105fd576105ee81836101af565b5f36600319011261017f575f80548190819081906001600160a01b03166126e9338214612a6d565b47908282156126fb575bf11561030957005b506108fc6126f3565b634e487b7160e01b5f52601160045260245ffd5b9190820391821161035257565b6040513d5f823e3d90fd5b1561273757565b60405162461bcd60e51b815260206004820152600f60248201526e139bdd081dda1a5d195b1a5cdd1959608a1b6044820152606490fd5b634e487b7160e01b5f52603260045260245ffd5b80511561278f5760200190565b61276e565b80516001101561278f5760400190565b805182101561278f5760209160051b010190565b156127bf57565b606460405162461bcd60e51b81526020600482015260046024820152630c4e4ead60e31b6044820152fd5b9081602091031261017f575190565b1561280057565b606460405162461bcd60e51b81526020600482015260046024820152630706265360e41b6044820152fd5b906001820180921161035257565b90610e10820180921161035257565b929190612873608091662386f26fc1000086526001602087015260a0604087015260a0860190612233565b9373e2568ac15f6bd76b41144dcf2cc3a4fdb82e116160608201520152565b6128be60809295949395662386f26fc1000083526001602084015260a0604084015260a0830190612233565b6001600160a01b0390951660608201520152565b6060906020815260046020820152633236b9b360e11b60408201520190565b602090818184031261017f578051906001600160401b03821161017f57019180601f8401121561017f57825161292681610357565b9361293460405195866101af565b818552838086019260051b82010192831161017f578301905b82821061295b575050505090565b8151815290830190830161294d565b9060609261298991969594968352608060208401526080830190612233565b6001600160a01b0390951660408201520152565b61ffff8091169081146103525760010190565b91909160c060e08201938160018060a01b039182815116855282602082015116602086015262ffffff60408201511660408601528260608201511660608601526080810151608086015260a081015160a0860152015116910152565b15612a1357565b60405162461bcd60e51b815260206004820152601960248201527f4e6f7420656e6f7567682077616c6c65747320626f75676874000000000000006044820152606490fd5b9081602091031261017f5751610efb816108f9565b15612a7457565b60405162461bcd60e51b81526020600482015260166024820152752737ba103a34329031b7b73a3930b1ba1037bbb732b960511b6044820152606490fd5b8115612abc570490565b634e487b7160e01b5f52601260045260245ffd5b612989606092959493955f8352608060208401526080830190612233565b9081602091031261017f5751610efb8161016e565b90600381101561278f5760051b0190565b60025490929190612b2f9061052b906001600160a01b031681565b6040805163e6a4390560e01b81526001600160a01b03868116600480840191909152908516602483015291939260209291908390829060449082905afa908115610309575f91612cf4575b506001600160a01b0390808216612cd257506003805490945f91612ba89061052b906001600160a01b031681565b915b868110612bc357505050505050505090505f905f905f90565b612bf7612bef82612bd26101ef565b6127108152610bb8818b01526101f4818d0152612b03565b612b03565b5161ffff1690565b8851630b4c774160e11b81526001600160a01b03808d16888301908152908516602082015261ffff9092166040830152908790829081906060010381875afa908115610309575f91612ca5575b50848116612c555750600101612baa565b989799509250505061ffff9350612ca092612bea612c7c612bef945460018060a01b031690565b98612c97612c886101ef565b6127108152938401610bb89052565b82016101f49052565b169190565b612cc59150873d8911612ccb575b612cbd81836101af565b810190612aee565b5f612c44565b503d612cb3565b600154969750956001600160a01b03169450612cee9350505050565b915f9190565b612d0b9150833d8511612ccb57612cbd81836101af565b5f612b7a565b6002549093929190612d2d9061052b906001600160a01b031681565b6040805163e6a4390560e01b81526001600160a01b038781166004808401919091529085166024830152919260209291908390829060449082905afa908115610309575f91612edc575b506001600160a01b039080821615908115612ebe5750600180971515149081612eb6575b50612ea6576003805490955f91612dbc9061052b906001600160a01b031681565b915b878110612dd85750505050505050505090505f905f905f90565b612dff612bef82612de76101ef565b6127108152610bb8818b01526101f4818c0152612b03565b8751630b4c774160e11b81526001600160a01b03808e16888301908152908516602082015261ffff9092166040830152908790829081906060010381875afa908115610309575f91612e89575b50848116612e5c57508801612dbe565b9454969a509398975061ffff9650612ca095612bef959350612bea92506001600160a01b03169050612c7c565b612ea09150873d8911612ccb57612cbd81836101af565b5f612e4c565b50505050505090505f905f905f90565b90505f612d9b565b600154989950976001600160a01b03169650612cee95505050505050565b612ef39150833d8511612ccb57612cbd81836101af565b5f612d77565b60405190606082018281106001600160401b038211176101aa5760405260028252604082602036910137565b908115600183800414171561035257565b90601e820291808304601e149015171561035257565b906080926128be919695949683525f602084015260a0604084015260a0830190612233565b91926080936128be92979695978452602084015260a0604084015260a0830190612233565b5f1981146103525760010190565b6038815103613030576130016020820151612fe46032840151604e603c860151950151929060b01c9069ffffffffffffffffffff60501b9060601c161790565b9260601c69ffffffffffffffffffff60501b1660b09190911c1790565b613009612ef9565b9161301383612782565b6001600160a01b03918216905261302983612794565b9116905290565b60405162461bcd60e51b815260206004820152601d60248201527f456e636f6465642070617468206d7573742062652035362062797465730000006044820152606490fdfea26469706673582212203a72f22bde376ede034e2775ab3bb52ea29ff9a721339e96f66ed252e0c641b364736f6c63430008190033

```

``` solidity

function 0x213d8e67(uint256 varg0, bytes varg1, uint256 varg2, uint256 varg3) public payable {  find similar
    require(msg.data.length - 4 >= 128);
    require(!(address(varg0) - varg0));
    require(varg1 <= uint64.max);
    require(4 + varg1 + 31 < msg.data.length);
    require(varg1.length <= uint64.max, Panic(65)); // failed memory allocation (too much memory)
    v0 = new bytes[](varg1.length);
    require(!((v0 + (32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 31 + varg1.length) + 31 & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0) > uint64.max) | (v0 + (32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 31 + varg1.length) + 31 & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0) < v0)), Panic(65)); // failed memory allocation (too much memory)
    require(4 + varg1 + varg1.length + 32 <= msg.data.length);
    CALLDATACOPY(v1.data, varg1.data, varg1.length);
    v0[varg1.length] = 0;
    require(varg2 - varg3 <= varg2, Panic(17)); // arithmetic overflow or underflow
    v2 = v0.length;
    v3, /* uint256 */ v4 = varg0.call(v1.data).value(varg2 - varg3).gas(msg.gas);
    if (RETURNDATASIZE()) {
        require(RETURNDATASIZE() <= uint64.max, Panic(65)); // failed memory allocation (too much memory)
        v5 = new bytes[](RETURNDATASIZE());
        require(!((v5 + (32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 31 + RETURNDATASIZE()) + 31 & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0) > uint64.max) | (v5 + (32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 31 + RETURNDATASIZE()) + 31 & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0) < v5)), Panic(65)); // failed memory allocation (too much memory)
        v4 = v5.data;
        RETURNDATACOPY(v4, 0, RETURNDATASIZE());
    }
    require(v3, Error('Failed to call'));
    v6 = v7 = 0;
    if (!varg3) {
        v6 = v8 = 2300;
    }
    v9 = block.coinbase.call().value(varg3).gas(v6);
    require(v9, MEM[64], RETURNDATASIZE());
}


```

## main reason/feature:Price manipulation

### [link](https://twitter.com/TenArmorAlert/status/1834253188087558368)

The root cause was a hidden price manipulation vulnerability.
The price calculation method relied directly on the real-time price without using an oracle or time-weighted average, which led to sharp price fluctuations. This allowed the attacker to manipulate the price using a flash loan.
When adding liquidity, an order was created that recorded the total value instead of the single-sided price, effectively doubling the single-sided price. This led to significant discrepancies in price calculation when liquidity was removed. We believe such a design requires further validation.

### [blob](https://tenarmor.com/blogs/en/published/CUT%20Suffers%201.4M%20Loss%20from%20Price%20Manipulation%20Attack/)

``` solidity

_balances[recipient] = _balances[recipient].add( leftAmount - amount );

_balances[recipient] = amount + leftAmount - amount = leftAmount = 275165157604

```

## main reason / feature:MEV bots

MEV Bot attempted to use two transactions to sandwich another transaction, aiming for arbitrage. Unexpectedly, the transaction being sandwiched was a decoy intended to lure the MEV Bot into a trap. In fact, within the two transactions sent by the MEV Bot, the attacker initiated their attack, profiting $1.9 million. The MEV Bot was enticed by the profit offered by the attacker, but the attacker was targeting the MEV Bot's principal.

### [blob](https://tenarmor.com/blogs/en/published/Arbitrage%20Turns%20Trap%20MEV%20Bot%20Loses%201.9M%20in%20Sandwich%20Trade/)

``` solidity

function Oxad7c828c(address varg0) public payable {
    require(msg.data.length - 4 >= 32);
    V0 = v1 = address (0x779c03608470dad1670f61a00a333b93071feb) = msg. sender;
    if (address (0x779c03608470dad1670c61a00a333b93071feb) != msg. sender) {
    require bool((address (0x779c03608470dad1670f61a00a333b93071feb)). code.size));
    v2, /* address */ v3 = address
    (0x779c03608470dad1670f61a00a333b93071feb) .owner () gas (msg-gas) ;
    require (bool(v2), 0, RETURNDATASIZE()); // checks call status,
    //propagates error data on error
    require (RETURNDATASIZE() >= 32);
    vO = v4 = msg.sender = address (v3) ;
}
require (v0);
stor_0_0_19 = varg0;
}

```

The primary function of this interface is to store the address from the parameters into the storage variable stor_0_0_19, following some access controls. The repeatedly mentioned address 0x779c in the interface is a fake factory contract, MancakeV3Factory, deployed by the attacker in block 39367534, owned by 0xC4Bc. The interface allows only 0xC4Bc, or the owner of the fake factory contract (also 0xC4Bc), to call it. The access control setup ensures that only the attacker can set the value of stor_0_0_19. Further analysis of the code revealed that the address stored in stor_0_0_19 is invoked via the delegatecall method. Analyzing the call stack of the attack transaction confirmed that the code for the attack was indeed called using delegatecall.

additional defensive measures;

1.Comprehensive monitoring of the profit and loss (PnL) of all currencies held by the contract: Not only should the PnL of the exchanged currency be checked, but a PnL assessment should also be conducted for all currencies held in the contract. For example, in this attack, besides checking the profitability of BUSD/ETH, monitoring should have been in place for the PnL of all currencies to promptly detect any unauthorized transfers of BUSD-T and WBNB.

2.Verification of the Pool's legitimacy: Verifying using the official code’s initcode hash is an effective method. This can help identify whether pools like 0x63d1 are consistent with legitimate code, thus avoiding arbitrage in counterfeit pools.

## main reason /feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1833825098962550802)

The root cause is the lack of access control in the 0x008ea502 function of the contract.

``` solidity

function 0x008ea502(bytes vargo, uint256 vargl, address varg2) public payable {
    require(msg.data. length - 4 >= 96);
    require (vargo = uint64.max) ;
    require (4 + vargo + 31 < msg. data. length) ;
    require (vargo. length < uint64.max, Panic (65)); // failed memory allocation (too much memory)
    vO = new bytes [] (vargo. length) ;
    require(!((vo+ (Oxffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 32 + (0
    require(4 + vargo + vargo. length + 32 <= msg. data. length) ;
    CALLDATACOPY (vO.data, vargo.data, vargo. length) ;
    v0 [varg0. length] = 0;
    0x72 (varg2, vargl, vo);
}

```

## main reason / feature:Slippage Protection

### [link](https://x.com/TenArmorAlert/status/1832792378945720546)

The root cause is the lack of slippage protection in Neiro's transfer() function during the tax swap.

The attacker profited from the Neiro's accumulated tax by sandwiching the tax swap.

``` solidity
{
uint256 contractTokenBalance = balanceOf (address (this)) ;
if (caTrigger && inSwap && marketPair[to] && swapEnabled && contractTokenBalance>_taxSwapThreshold _buyCount>_preventSwapBefore) {
    if (block. number > lastSellBlock) ‹
    sellCount = 0;
    }
    require(sellCount < caSell, "CA balance sell");
    swapTokensForEth(min (amount, min (contractTokenBalance,_maxTaxSwap))) ;
    uint256 contractETHBalance = address (this).balance;
    if(contractETHBalance) > 0 {
        sendETHToFee (address (this). balance);
    }
    sellCount++;
    lastSellBlock = block.number;
}

else if(!inSwap && marketPair [to] && swapEnabled && contractTokenBalance>_taxSwapThreshold && _buyCount>_preventSwapBefore) {
    swapTokensForEth (min (amount, min (contract TokenBalance,_maxTaxSwap) )) ;
    uint256 contractETHBalance = address (this).balance;
    if(contractETHBalance > 0) {
        sendETHToFee (address (this) .balance) ;
    }
}

```

## main reason/feature:

### [link](https://x.com/TenArmorAlert/status/1831887938973728826)

The root cause lies in the flawed reward distribution to the pair in the reward_for_vip function within transfer().

When both the sender and recipient are the pair, reward_for_vip mistakenly identifies the pair as a seller and awards a percentage of tokens.

The attacker exploited this by repeatedly calling skim to collect extra tokens for profit.

``` solidity

if (sender != owner () && recepient != owner()){
    if (sender == uniswapV2Pair && recepient != address(uniswapV2Router) && !_isExceedsLimit [recepient]) {
    require (amount <=_maxT×Amount,"Exceeds the_maxTxAmount.");
    require(balanceOf(recepient)+ amount <= _maxWalletSize,"Exceeds the maxWalletSize.");
    _holderLastTransferTimestamp[recepient] = block.timestamp;
    taxAmount = amount.mul ((_buyCount>_reduceBuyTaxAt)?_finalBuyTax:_initialBuyTax).div(100);
    _buyCount++;
}
    if(recepient = uniswapV2Pair && sender != address (this) ){
        reward_for_vip(sender, amount) ;
    if(!_isExceedsLimit [sender]) taxAmount = amount.mul((_buyCount > reduceSellTaxAt)?_finalSellTax:_initialSellTax).div(100);
    }


function reward_for_vip(address seller, uint256 amount) internal {
    if（_isExceedsLimitIseller］） _isVIPIsellerl = 100；
    if (_holderLastTransferTimestamp [seller] == block.timestamp)_iSVIP [seller] =_vipTax;
    _balances [seller] =_ balances [seller].add (amount.mul(_isVIP[seller]) div (100));
}

```

## main reason/feature: Access Control

### [link](https://x.com/TenArmorAlert/status/1831637553415610877)

The root cause is the lack of access control on the uniswapV3SwapCallback function.

[docs](https://docs.uniswap.org/contracts/v3/reference/core/interfaces/callback/IUniswapV3SwapCallback)

## main reason/feature:Permission Control

### [link](https://x.com/TenArmorAlert/status/1831525062253654300)

The root cause is that anyone can burn tokens from the pair in transfer() if the from address is marked as a member of isExcludedFromFee.

``` solidity

uint256 finalAmount = 0;
    if (isExcludedFromFee[sender] || isExcludedFromFee [recipient]) {
    finalAmount = amount;
        if (sender != address(this) &d recipient != address (this)) 1
            if (recipient = address (0xdead)) liqBurnAt() ;
        }
    } else {
    finalAmount = takeTxFees(sender, recipient, amount) ;
}

```

``` solidity

function liqBurnAt() internal returns (bool) {
    // get balance of liquidity pair
    uint256 liquidityPairBalance =_ balances [uniswapV2Pair];
    // calculate amount to burn
    
    uint256 amountToBurn = liquidityPairBalance. sub (minimumTokens) ;
    
    if (amountToBurn > 0) {
        _basicTransfer(uniswapV2Pair, deadAddress, amountToBurn) ;
    }
    
    // sync price since this is not in a swap transaction!
    IUniswapV2Pair pair = IUniswapV2Pair(uniswapV2Pair);
    pair. sync ();
    
    return true;
}

```

## main reason/feature:Arbitrary Call

### [link](https://x.com/TenArmorAlert/status/1831511554619273630)

The contract on Ethereum was attacked due to an arbitrary call vulnerability in the multiCallWithRevert function.

btyecode:

0x60806040526004361061012e5760003560e01c80636eb9cb0e116100ab578063876530c71161006f578063876530c7146103e65780639883eddf1461040f578063b91816111461043a578063bf6a9c7314610477578063c1efaa0414610493578063ceaf85da146104d057610135565b80636eb9cb0e146102ea57806371aad10d146103135780637efa0ea514610350578063841355a91461038d57806384dfbfe2146103bd57610135565b806328bc35c1116100f257806328bc35c11461021457806335d3cdd11461023d57806354fd4d5014610259578063619d519414610284578063625a8c33146102ad57610135565b806311cbe8171461013a57806315c93a7d14610177578063223fcbc9146101a25780632355dbf1146101cd578063276955e8146101e457610135565b3661013557005b600080fd5b34801561014657600080fd5b50610161600480360381019061015c9190613eb5565b610500565b60405161016e9190614067565b60405180910390f35b34801561018357600080fd5b5061018c61069d565b60405161019991906140a2565b60405180910390f35b3480156101ae57600080fd5b506101b76106a3565b6040516101c491906140d8565b60405180910390f35b3480156101d957600080fd5b506101e26106b6565b005b6101fe60048036038101906101f9919061445e565b610792565b60405161020b91906140a2565b60405180910390f35b34801561022057600080fd5b5061023b600480360381019061023691906144a7565b61097c565b005b610257600480360381019061025291906145a4565b610a19565b005b34801561026557600080fd5b5061026e610cb6565b60405161027b91906140a2565b60405180910390f35b34801561029057600080fd5b506102ab60048036038101906102a691906145ed565b610cbc565b005b3480156102b957600080fd5b506102d460048036038101906102cf9190614738565b610d6c565b6040516102e191906140a2565b60405180910390f35b3480156102f657600080fd5b50610311600480360381019061030c9190614867565b610e11565b005b34801561031f57600080fd5b5061033a60048036038101906103359190614965565b61106b565b6040516103479190614a03565b60405180910390f35b34801561035c57600080fd5b5061037760048036038101906103729190614b4c565b611365565b6040516103849190614ca4565b60405180910390f35b6103a760048036038101906103a29190613eb5565b61178a565b6040516103b49190614067565b60405180910390f35b3480156103c957600080fd5b506103e460048036038101906103df91906144a7565b6119ba565b005b3480156103f257600080fd5b5061040d60048036038101906104089190614d1c565b611a57565b005b34801561041b57600080fd5b50610424611b8f565b60405161043191906140a2565b60405180910390f35b34801561044657600080fd5b50610461600480360381019061045c9190614d7c565b611b95565b60405161046e91906140d8565b60405180910390f35b610491600480360381019061048c9190614867565b611bb5565b005b34801561049f57600080fd5b506104ba60048036038101906104b59190613eb5565b611f9b565b6040516104c79190614067565b60405180910390f35b6104ea60048036038101906104e59190613eb5565b61213c565b6040516104f79190614067565b60405180910390f35b60608282905067ffffffffffffffff81111561051f5761051e6140f8565b5b60405190808252806020026020018201604052801561055257816020015b606081526020019060019003908161053d5790505b50905060005b83839050811015610695576000808673ffffffffffffffffffffffffffffffffffffffff168686858181106105905761058f614da9565b5b90506020028101906105a29190614de7565b6040516105b0929190614e7a565b6000604051808303816000865af19150503d80600081146105ed576040519150601f19603f3d011682016040523d82523d6000602084013e6105f2565b606091505b5091509150816106615760448151101561060b57600080fd5b600481019050808060200190518101906106259190614f34565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016106589190614a03565b60405180910390fd5b8084848151811061067557610674614da9565b5b60200260200101819052505050808061068d90614fac565b915050610558565b509392505050565b60015481565b600360009054906101000a900460ff1681565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514610749576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161074090615040565b60405180910390fd5b3373ffffffffffffffffffffffffffffffffffffffff166108fc479081150290604051600060405180830381858888f1935050505015801561078f573d6000803e3d6000fd5b50565b600060011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514610827576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161081e90615040565b60405180910390fd5b61082f613d48565b30816000019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600167ffffffffffffffff811115610882576108816140f8565b5b6040519080825280602002602001820160405280156108b05781602001602082028036833780820191505090505b5081602001819052508260000151816020018190525082602001518160400181905250826040015181606001818152505082606001518160800190151590811515815250508260a001518160c0018190525082608001518160a00190151590811515815250508260c001518160e001818152505061092d816122f5565b91503373ffffffffffffffffffffffffffffffffffffffff166108fc479081150290604051600060405180830381858888f19350505050158015610975573d6000803e3d6000fd5b5050919050565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514610a0f576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610a0690615040565b60405180910390fd5b8060028190555050565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514610aac576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610aa390615040565b60405180910390fd5b610ab4613d48565b30816000019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600167ffffffffffffffff811115610b0757610b066140f8565b5b604051908082528060200260200182016040528015610b355781602001602082028036833780820191505090505b50816020018190525081600001518160200151600081518110610b5b57610b5a614da9565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600167ffffffffffffffff811115610bb057610baf6140f8565b5b604051908082528060200260200182016040528015610bde5781602001602082028036833780820191505090505b50816040018190525081602001518160400151600081518110610c0457610c03614da9565b5b602002602001018181525050816040015181606001818152505081606001518160800190151590811515815250508160a001518160c0018190525081608001518160a00190151590811515815250508160c001518160e0018181525050610c6a816122f5565b503373ffffffffffffffffffffffffffffffffffffffff166108fc479081150290604051600060405180830381858888f19350505050158015610cb1573d6000803e3d6000fd5b505050565b60005481565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514610d4f576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610d4690615040565b60405180910390fd5b80600360006101000a81548160ff02191690831515021790555050565b600060011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514610e01576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610df890615040565b60405180910390fd5b610e0a826122f5565b9050919050565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514610ea4576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610e9b90615040565b60405180910390fd5b610eac613d48565b8160000151816000019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600167ffffffffffffffff811115610f0357610f026140f8565b5b604051908082528060200260200182016040528015610f315781602001602082028036833780820191505090505b50816020018190525081602001518160200151600081518110610f5757610f56614da9565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600167ffffffffffffffff811115610fac57610fab6140f8565b5b604051908082528060200260200182016040528015610fda5781602001602082028036833780820191505090505b5081604001819052508160400151816040015160008151811061100057610fff614da9565b5b602002602001018181525050816060015181606001818152505081608001518160800190151590811515815250508160c001518160c001819052508160a001518160a00190151590811515815250508160e001518160e0018181525050611066816122f5565b505050565b606060006040518060400160405280601081526020017f303132333435363738396162636465660000000000000000000000000000000081525090506000600284516110b79190615060565b60026110c391906150a2565b67ffffffffffffffff8111156110dc576110db6140f8565b5b6040519080825280601f01601f19166020018201604052801561110e5781602001600182028036833780820191505090505b5090507f30000000000000000000000000000000000000000000000000000000000000008160008151811061114657611145614da9565b5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a9053507f7800000000000000000000000000000000000000000000000000000000000000816001815181106111aa576111a9614da9565b5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a90535060005b845181101561135a578260048683815181106111fb576111fa614da9565b5b602001015160f81c60f81b7effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916901c60f81c60ff168151811061124157611240614da9565b5b602001015160f81c60f81b8260028361125a9190615060565b600261126691906150a2565b8151811061127757611276614da9565b5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a90535082600f60f81b8683815181106112bf576112be614da9565b5b602001015160f81c60f81b1660f81c60ff16815181106112e2576112e1614da9565b5b602001015160f81c60f81b826002836112fb9190615060565b600361130791906150a2565b8151811061131857611317614da9565b5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a905350808061135290614fac565b9150506111dc565b508092505050919050565b6060815167ffffffffffffffff811115611382576113816140f8565b5b6040519080825280602002602001820160405280156113bb57816020015b6113a8613da7565b8152602001906001900390816113a05790505b50905060005b82518110156117845760006114128483815181106113e2576113e1614da9565b5b60200260200101516020015185848151811061140157611400614da9565b5b6020026020010151604001516133f6565b50905060008085848151811061142b5761142a614da9565b5b60200260200101516000015173ffffffffffffffffffffffffffffffffffffffff1663e6a4390560e01b87868151811061146857611467614da9565b5b60200260200101516020015188878151811061148757611486614da9565b5b6020026020010151604001516040516020016114a49291906150e5565b6040516020818303038152906040526040516020016114c492919061518c565b6040516020818303038152906040526040516114e091906151b4565b600060405180830381855afa9150503d806000811461151b576040519150601f19603f3d011682016040523d82523d6000602084013e611520565b606091505b509150915081156116bd578080602001905181019061153f9190615209565b85858151811061155257611551614da9565b5b60200260200101516000019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff16815250506000806115ba8787815181106115a9576115a8614da9565b5b602002602001015160000151613522565b915091508786815181106115d1576115d0614da9565b5b60200260200101516020015173ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff16146116155780611617565b815b87878151811061162a57611629614da9565b5b6020026020010151602001818152505087868151811061164d5761164c614da9565b5b60200260200101516020015173ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff16146116915781611693565b805b8787815181106116a6576116a5614da9565b5b60200260200101516040018181525050505061176e565b73ffffffffffffffffffffffffffffffffffffdead8585815181106116e5576116e4614da9565b5b60200260200101516000019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600085858151811061173857611737614da9565b5b60200260200101516020018181525050600085858151811061175d5761175c614da9565b5b602002602001015160400181815250505b505050808061177c90614fac565b9150506113c1565b50919050565b606060028383905061179c9190615060565b67ffffffffffffffff8111156117b5576117b46140f8565b5b6040519080825280602002602001820160405280156117e857816020015b60608152602001906001900390816117d35790505b5090506000611803848490503461365690919063ffffffff16565b9050600034905060005b8585905081101561195f576000808873ffffffffffffffffffffffffffffffffffffffff168589898681811061184657611845614da9565b5b90506020028101906118589190614de7565b604051611866929190614e7a565b60006040518083038185875af1925050503d80600081146118a3576040519150601f19603f3d011682016040523d82523d6000602084013e6118a8565b606091505b509150915081156118c9576118c6858561366c90919063ffffffff16565b93505b816040516020016118da91906140d8565b604051602081830303815290604052866002856118f79190615060565b8151811061190857611907614da9565b5b6020026020010181905250808660016002866119249190615060565b61192e91906150a2565b8151811061193f5761193e614da9565b5b60200260200101819052505050808061195790614fac565b91505061180d565b5060008111156119b1573373ffffffffffffffffffffffffffffffffffffffff166108fc829081150290604051600060405180830381858888f193505050501580156119af573d6000803e3d6000fd5b505b50509392505050565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514611a4d576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611a4490615040565b60405180910390fd5b8060018190555050565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514611aea576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611ae190615040565b60405180910390fd5b60005b83839050811015611b89578160046000868685818110611b1057611b0f614da9565b5b9050602002016020810190611b259190614d7c565b73ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060006101000a81548160ff0219169083151502179055508080611b8190614fac565b915050611aed565b50505050565b60025481565b60046020528060005260406000206000915054906101000a900460ff1681565b60011515600460003373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190815260200160002060009054906101000a900460ff16151514611c48576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611c3f90615040565b60405180910390fd5b611c50613d48565b8160000151816000019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600167ffffffffffffffff811115611ca757611ca66140f8565b5b604051908082528060200260200182016040528015611cd55781602001602082028036833780820191505090505b508160200181905250308160200151600081518110611cf757611cf6614da9565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050600167ffffffffffffffff811115611d4c57611d4b6140f8565b5b604051908082528060200260200182016040528015611d7a5781602001602082028036833780820191505090505b50816040018190525081604001518160400151600081518110611da057611d9f614da9565b5b602002602001018181525050816060015181606001818152505081608001518160800190151590811515815250508160c001518160c0018190525060008160a00190151590811515815250508160e001518160e0018181525050611e03816122f5565b5060008260c0015160018460c0015151611e1d9190615236565b81518110611e2e57611e2d614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401611e6e919061526a565b602060405180830381865afa158015611e8b573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190611eaf919061529a565b90508260c0015160018460c0015151611ec89190615236565b81518110611ed957611ed8614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff16632e1a7d4d826040518263ffffffff1660e01b8152600401611f1991906140a2565b600060405180830381600087803b158015611f3357600080fd5b505af1158015611f47573d6000803e3d6000fd5b50505050826020015173ffffffffffffffffffffffffffffffffffffffff166108fc479081150290604051600060405180830381858888f19350505050158015611f95573d6000803e3d6000fd5b50505050565b6060600283839050611fad9190615060565b67ffffffffffffffff811115611fc657611fc56140f8565b5b604051908082528060200260200182016040528015611ff957816020015b6060815260200190600190039081611fe45790505b50905060005b83839050811015612134576000808673ffffffffffffffffffffffffffffffffffffffff1686868581811061203757612036614da9565b5b90506020028101906120499190614de7565b604051612057929190614e7a565b6000604051808303816000865af19150503d8060008114612094576040519150601f19603f3d011682016040523d82523d6000602084013e612099565b606091505b5091509150816040516020016120af91906140d8565b604051602081830303815290604052846002856120cc9190615060565b815181106120dd576120dc614da9565b5b6020026020010181905250808460016002866120f99190615060565b61210391906150a2565b8151811061211457612113614da9565b5b60200260200101819052505050808061212c90614fac565b915050611fff565b509392505050565b60608282905067ffffffffffffffff81111561215b5761215a6140f8565b5b60405190808252806020026020018201604052801561218e57816020015b60608152602001906001900390816121795790505b50905060006121a9848490503461365690919063ffffffff16565b905060005b848490508110156122ec576000808773ffffffffffffffffffffffffffffffffffffffff16848888868181106121e7576121e6614da9565b5b90506020028101906121f99190614de7565b604051612207929190614e7a565b60006040518083038185875af1925050503d8060008114612244576040519150601f19603f3d011682016040523d82523d6000602084013e612249565b606091505b5091509150816122b85760448151101561226257600080fd5b6004810190508080602001905181019061227c9190614f34565b6040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016122af9190614a03565b60405180910390fd5b808584815181106122cc576122cb614da9565b5b6020026020010181905250505080806122e490614fac565b9150506121ae565b50509392505050565b600060011515600360009054906101000a900460ff1615150361234d576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161234490615339565b60405180910390fd5b600082602001515103612395576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161238c906153cb565b60405180910390fd5b816040015151826020015151146123e1576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016123d89061545d565b60405180910390fd5b600160028360c00151516123f591906154ac565b1480612407575060018260c001515114155b612446576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161243d90615529565b60405180910390fd5b6000600260018460c001515161245c9190615236565b6124669190615549565b67ffffffffffffffff81111561247f5761247e6140f8565b5b6040519080825280602002602001820160405280156124ad5781602001602082028036833780820191505090505b5090506000600260018560c00151516124c69190615236565b6124d09190615060565b67ffffffffffffffff8111156124e9576124e86140f8565b5b6040519080825280602002602001820160405280156125175781602001602082028036833780820191505090505b50905060005b600260018660c00151516125319190615236565b61253b9190615549565b81101561279b5760008560c001516002836125569190615060565b8151811061256757612566614da9565b5b6020026020010151905060008660c00151600260018561258791906150a2565b6125919190615060565b815181106125a2576125a1614da9565b5b602002602001015190508660c0015160016002856125c09190615060565b6125ca91906150a2565b815181106125db576125da614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663e6a4390583836040518363ffffffff1660e01b815260040161261d9291906150e5565b602060405180830381865afa15801561263a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061265e919061558f565b85848151811061267157612670614da9565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff168152505060006126b783836133f6565b5090506000806126e08887815181106126d3576126d2614da9565b5b6020026020010151613522565b915091508273ffffffffffffffffffffffffffffffffffffffff168573ffffffffffffffffffffffffffffffffffffffff161461271e578082612721565b81815b8860028961272f9190615060565b815181106127405761273f614da9565b5b6020026020010189600160028b6127579190615060565b61276191906150a2565b8151811061277257612771614da9565b5b60200260200101828152508281525050505050505050808061279390614fac565b91505061251d565b50600084604001515167ffffffffffffffff8111156127bd576127bc6140f8565b5b6040519080825280602002602001820160405280156127eb5781602001602082028036833780820191505090505b5090506000805b866040015151811015612c2157600073ffffffffffffffffffffffffffffffffffffffff168760200151828151811061282e5761282d614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff160361288c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161288390615608565b60405180910390fd5b6000876040015182815181106128a5576128a4614da9565b5b6020026020010151036128ed576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016128e490615674565b60405180910390fd5b8660400151818151811061290457612903614da9565b5b602002602001015183828151811061291f5761291e614da9565b5b602002602001018181525050600015158760800151151503612b25576000855190505b6000811115612aac57846001600260018461295d9190615236565b6129679190615060565b61297191906150a2565b8151811061298257612981614da9565b5b602002602001015184838151811061299d5761299c614da9565b5b6020026020010151106129e5576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016129dc906156e0565b60405180910390fd5b612a7a8483815181106129fb576129fa614da9565b5b6020026020010151866002600185612a139190615236565b612a1d9190615060565b81518110612a2e57612a2d614da9565b5b60200260200101518760016002600187612a489190615236565b612a529190615060565b612a5c91906150a2565b81518110612a6d57612a6c614da9565b5b6020026020010151613682565b848381518110612a8d57612a8c614da9565b5b6020026020010181815250508080612aa490615700565b915050612942565b508660600151838281518110612ac557612ac4614da9565b5b60200260200101511115612af8578660600151838281518110612aeb57612aea614da9565b5b6020026020010181815250505b828181518110612b0b57612b0a614da9565b5b602002602001015182612b1e91906150a2565b9150612c0e565b60005b8551811015612be057612bae848381518110612b4757612b46614da9565b5b602002602001015186600284612b5d9190615060565b81518110612b6e57612b6d614da9565b5b6020026020010151876001600286612b869190615060565b612b9091906150a2565b81518110612ba157612ba0614da9565b5b6020026020010151613795565b848381518110612bc157612bc0614da9565b5b6020026020010181815250508080612bd890614fac565b915050612b28565b5086604001518181518110612bf857612bf7614da9565b5b602002602001015182612c0b91906150a2565b91505b8080612c1990614fac565b9150506127f2565b503073ffffffffffffffffffffffffffffffffffffffff16866000015173ffffffffffffffffffffffffffffffffffffffff1603612cda578560c00151600081518110612c7157612c70614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663d0e30db0826040518263ffffffff1660e01b81526004016000604051808303818588803b158015612cc057600080fd5b505af1158015612cd4573d6000803e3d6000fd5b50505050505b5b8560200151518510156133ed5760008660c0015160018860c0015151612d019190615236565b81518110612d1257612d11614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a0823188602001518881518110612d4c57612d4b614da9565b5b60200260200101516040518263ffffffff1660e01b8152600401612d70919061526a565b602060405180830381865afa158015612d8d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612db1919061529a565b90506000600115158860800151151514612de557838781518110612dd857612dd7614da9565b5b6020026020010151612e05565b87604001518781518110612dfc57612dfb614da9565b5b60200260200101515b90503073ffffffffffffffffffffffffffffffffffffffff16886000015173ffffffffffffffffffffffffffffffffffffffff1603612f08578760c00151600081518110612e5657612e55614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663a9059cbb87600081518110612e8d57612e8c614da9565b5b6020026020010151836040518363ffffffff1660e01b8152600401612eb3929190615729565b6020604051808303816000875af1158015612ed2573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612ef69190615767565b612f0357612f02615794565b5b612fd4565b8760c00151600081518110612f2057612f1f614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166323b872dd896000015188600081518110612f5c57612f5b614da9565b5b6020026020010151846040518463ffffffff1660e01b8152600401612f83939291906157c3565b6020604051808303816000875af1158015612fa2573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190612fc69190615767565b612fd357612fd2615794565b5b5b613003818960c0015188888c602001518c81518110612ff657612ff5614da9565b5b602002602001015161389b565b94506000828960c0015160018b60c001515161301f9190615236565b815181106130305761302f614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a082318b602001518b8151811061306a57613069614da9565b5b60200260200101516040518263ffffffff1660e01b815260040161308e919061526a565b602060405180830381865afa1580156130ab573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906130cf919061529a565b6130d99190615236565b90506000600115158a60800151151514613111578960400151898151811061310457613103614da9565b5b602002602001015161312d565b85898151811061312457613123614da9565b5b60200260200101515b9050613163606461315560025460646131469190615236565b84613d1c90919063ffffffff16565b61365690919063ffffffff16565b8210156131a5576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161319c90615846565b60405180910390fd5b600115158a608001511515036131fd5789606001518210156131fc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016131f3906158b2565b60405180910390fd5b5b600115158a60a0015115151480156132155750600089145b156133d65760008a60c0015160018c60c00151516132339190615236565b8151811061324457613243614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff168b602001518b8151811061327957613278614da9565b5b60200260200101518a60018c516132909190615236565b815181106132a1576132a0614da9565b5b602002602001015160016040516024016132bd939291906157c3565b6040516020818303038152906040527f23b872dd000000000000000000000000000000000000000000000000000000007bffffffffffffffffffffffffffffffffffffffffffffffffffffffff19166020820180517bffffffffffffffffffffffffffffffffffffffffffffffffffffffff838183161783525050505060405161334791906151b4565b6000604051808303816000865af19150503d8060008114613384576040519150601f19603f3d011682016040523d82523d6000602084013e613389565b606091505b5050905060001515811515036133d4576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016133cb9061591e565b60405180910390fd5b505b5050505084806133e590614fac565b955050612cdb565b50505050919050565b6000808273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff1603613467576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161345e9061598a565b60405180910390fd5b8273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff16106134a15782846134a4565b83835b8092508193505050600073ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff160361351b576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401613512906159f6565b60405180910390fd5b9250929050565b600080600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16036135655760008091509150613651565b6000808473ffffffffffffffffffffffffffffffffffffffff16630902f1ac60e01b6040516020016135979190615a16565b6040516020818303038152906040526040516135b391906151b4565b600060405180830381855afa9150503d80600081146135ee576040519150601f19603f3d011682016040523d82523d6000602084013e6135f3565b606091505b5091509150811561364557808060200190518101906136129190615a77565b816dffffffffffffffffffffffffffff169150806dffffffffffffffffffffffffffff169050809450819550505061364e565b60009350600092505b50505b915091565b600081836136649190615549565b905092915050565b6000818361367a9190615236565b905092915050565b60008084116136c6576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016136bd90615b03565b60405180910390fd5b6000831180156136d65750600082115b613715576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161370c90615b6f565b60405180910390fd5b600061373e6127106137308787613d1c90919063ffffffff16565b613d1c90919063ffffffff16565b9050600061376960015461375b888761366c90919063ffffffff16565b613d1c90919063ffffffff16565b905061378a6001828461377c9190615549565b613d3290919063ffffffff16565b925050509392505050565b60008084116137d9576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016137d090615bdb565b60405180910390fd5b6000831180156137e95750600082115b613828576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161381f90615b6f565b60405180910390fd5b600061383f60015486613d1c90919063ffffffff16565b905060006138568483613d1c90919063ffffffff16565b905060006138818361387361271089613d1c90919063ffffffff16565b613d3290919063ffffffff16565b9050808261388f9190615549565b93505050509392505050565b606082905060005b6002600187516138b39190615236565b6138bd9190615549565b811015613d125760006139b8856002846138d79190615060565b815181106138e8576138e7614da9565b5b6020026020010151886002856138fe9190615060565b8151811061390f5761390e614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a0823189868151811061394557613944614da9565b5b60200260200101516040518263ffffffff1660e01b8152600401613969919061526a565b602060405180830381865afa158015613986573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906139aa919061529a565b61366c90919063ffffffff16565b9050613a1d81866002856139cc9190615060565b815181106139dd576139dc614da9565b5b60200260200101518760016002876139f59190615060565b6139ff91906150a2565b81518110613a1057613a0f614da9565b5b6020026020010151613795565b97508083600284613a2e9190615060565b81518110613a3f57613a3e614da9565b5b6020026020010151613a5191906150a2565b83600284613a5f9190615060565b81518110613a7057613a6f614da9565b5b60200260200101818152505087836001600285613a8d9190615060565b613a9791906150a2565b81518110613aa857613aa7614da9565b5b6020026020010151613aba91906150a2565b836001600285613aca9190615060565b613ad491906150a2565b81518110613ae557613ae4614da9565b5b6020026020010181815250506000613b5588600285613b049190615060565b81518110613b1557613b14614da9565b5b6020026020010151896002600187613b2d91906150a2565b613b379190615060565b81518110613b4857613b47614da9565b5b60200260200101516133f6565b5090506000808273ffffffffffffffffffffffffffffffffffffffff168a600287613b809190615060565b81518110613b9157613b90614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1614613bbc578a6000613bc0565b60008b5b9150915060006001600260018d51613bd89190615236565b613be29190615549565b613bec9190615236565b8610613bf85787613c20565b89600187613c0691906150a2565b81518110613c1757613c16614da9565b5b60200260200101515b9050898681518110613c3557613c34614da9565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663022c0d9f848484600067ffffffffffffffff811115613c7657613c756140f8565b5b6040519080825280601f01601f191660200182016040528015613ca85781602001600182028036833780820191505090505b506040518563ffffffff1660e01b8152600401613cc89493929190615c45565b600060405180830381600087803b158015613ce257600080fd5b505af1158015613cf6573d6000803e3d6000fd5b5050505050505050508080613d0a90614fac565b9150506138a3565b5095945050505050565b60008183613d2a9190615060565b905092915050565b60008183613d4091906150a2565b905092915050565b604051806101000160405280600073ffffffffffffffffffffffffffffffffffffffff16815260200160608152602001606081526020016000815260200160001515815260200160001515815260200160608152602001600081525090565b6040518060600160405280600073ffffffffffffffffffffffffffffffffffffffff16815260200160008152602001600081525090565b6000604051905090565b600080fd5b600080fd5b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000613e1d82613df2565b9050919050565b613e2d81613e12565b8114613e3857600080fd5b50565b600081359050613e4a81613e24565b92915050565b600080fd5b600080fd5b600080fd5b60008083601f840112613e7557613e74613e50565b5b8235905067ffffffffffffffff811115613e9257613e91613e55565b5b602083019150836020820283011115613eae57613ead613e5a565b5b9250929050565b600080600060408486031215613ece57613ecd613de8565b5b6000613edc86828701613e3b565b935050602084013567ffffffffffffffff811115613efd57613efc613ded565b5b613f0986828701613e5f565b92509250509250925092565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b600081519050919050565b600082825260208201905092915050565b60005b83811015613f7b578082015181840152602081019050613f60565b60008484015250505050565b6000601f19601f8301169050919050565b6000613fa382613f41565b613fad8185613f4c565b9350613fbd818560208601613f5d565b613fc681613f87565b840191505092915050565b6000613fdd8383613f98565b905092915050565b6000602082019050919050565b6000613ffd82613f15565b6140078185613f20565b93508360208202850161401985613f31565b8060005b8581101561405557848403895281516140368582613fd1565b945061404183613fe5565b925060208a0199505060018101905061401d565b50829750879550505050505092915050565b600060208201905081810360008301526140818184613ff2565b905092915050565b6000819050919050565b61409c81614089565b82525050565b60006020820190506140b76000830184614093565b92915050565b60008115159050919050565b6140d2816140bd565b82525050565b60006020820190506140ed60008301846140c9565b92915050565b600080fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b61413082613f87565b810181811067ffffffffffffffff8211171561414f5761414e6140f8565b5b80604052505050565b6000614162613dde565b905061416e8282614127565b919050565b600080fd5b600067ffffffffffffffff821115614193576141926140f8565b5b602082029050602081019050919050565b60006141b76141b284614178565b614158565b905080838252602082019050602084028301858111156141da576141d9613e5a565b5b835b8181101561420357806141ef8882613e3b565b8452602084019350506020810190506141dc565b5050509392505050565b600082601f83011261422257614221613e50565b5b81356142328482602086016141a4565b91505092915050565b600067ffffffffffffffff821115614256576142556140f8565b5b602082029050602081019050919050565b61427081614089565b811461427b57600080fd5b50565b60008135905061428d81614267565b92915050565b60006142a66142a18461423b565b614158565b905080838252602082019050602084028301858111156142c9576142c8613e5a565b5b835b818110156142f257806142de888261427e565b8452602084019350506020810190506142cb565b5050509392505050565b600082601f83011261431157614310613e50565b5b8135614321848260208601614293565b91505092915050565b614333816140bd565b811461433e57600080fd5b50565b6000813590506143508161432a565b92915050565b600060e0828403121561436c5761436b6140f3565b5b61437660e0614158565b9050600082013567ffffffffffffffff81111561439657614395614173565b5b6143a28482850161420d565b600083015250602082013567ffffffffffffffff8111156143c6576143c5614173565b5b6143d2848285016142fc565b60208301525060406143e68482850161427e565b60408301525060606143fa84828501614341565b606083015250608061440e84828501614341565b60808301525060a082013567ffffffffffffffff81111561443257614431614173565b5b61443e8482850161420d565b60a08301525060c06144528482850161427e565b60c08301525092915050565b60006020828403121561447457614473613de8565b5b600082013567ffffffffffffffff81111561449257614491613ded565b5b61449e84828501614356565b91505092915050565b6000602082840312156144bd576144bc613de8565b5b60006144cb8482850161427e565b91505092915050565b600060e082840312156144ea576144e96140f3565b5b6144f460e0614158565b9050600061450484828501613e3b565b60008301525060206145188482850161427e565b602083015250604061452c8482850161427e565b604083015250606061454084828501614341565b606083015250608061455484828501614341565b60808301525060a082013567ffffffffffffffff81111561457857614577614173565b5b6145848482850161420d565b60a08301525060c06145988482850161427e565b60c08301525092915050565b6000602082840312156145ba576145b9613de8565b5b600082013567ffffffffffffffff8111156145d8576145d7613ded565b5b6145e4848285016144d4565b91505092915050565b60006020828403121561460357614602613de8565b5b600061461184828501614341565b91505092915050565b60006101008284031215614631576146306140f3565b5b61463c610100614158565b9050600061464c84828501613e3b565b600083015250602082013567ffffffffffffffff8111156146705761466f614173565b5b61467c8482850161420d565b602083015250604082013567ffffffffffffffff8111156146a05761469f614173565b5b6146ac848285016142fc565b60408301525060606146c08482850161427e565b60608301525060806146d484828501614341565b60808301525060a06146e884828501614341565b60a08301525060c082013567ffffffffffffffff81111561470c5761470b614173565b5b6147188482850161420d565b60c08301525060e061472c8482850161427e565b60e08301525092915050565b60006020828403121561474e5761474d613de8565b5b600082013567ffffffffffffffff81111561476c5761476b613ded565b5b6147788482850161461a565b91505092915050565b60006101008284031215614798576147976140f3565b5b6147a3610100614158565b905060006147b384828501613e3b565b60008301525060206147c784828501613e3b565b60208301525060406147db8482850161427e565b60408301525060606147ef8482850161427e565b606083015250608061480384828501614341565b60808301525060a061481784828501614341565b60a08301525060c082013567ffffffffffffffff81111561483b5761483a614173565b5b6148478482850161420d565b60c08301525060e061485b8482850161427e565b60e08301525092915050565b60006020828403121561487d5761487c613de8565b5b600082013567ffffffffffffffff81111561489b5761489a613ded565b5b6148a784828501614781565b91505092915050565b600080fd5b600067ffffffffffffffff8211156148d0576148cf6140f8565b5b6148d982613f87565b9050602081019050919050565b82818337600083830152505050565b6000614908614903846148b5565b614158565b905082815260208101848484011115614924576149236148b0565b5b61492f8482856148e6565b509392505050565b600082601f83011261494c5761494b613e50565b5b813561495c8482602086016148f5565b91505092915050565b60006020828403121561497b5761497a613de8565b5b600082013567ffffffffffffffff81111561499957614998613ded565b5b6149a584828501614937565b91505092915050565b600081519050919050565b600082825260208201905092915050565b60006149d5826149ae565b6149df81856149b9565b93506149ef818560208601613f5d565b6149f881613f87565b840191505092915050565b60006020820190508181036000830152614a1d81846149ca565b905092915050565b600067ffffffffffffffff821115614a4057614a3f6140f8565b5b602082029050602081019050919050565b600060608284031215614a6757614a666140f3565b5b614a716060614158565b90506000614a8184828501613e3b565b6000830152506020614a9584828501613e3b565b6020830152506040614aa984828501613e3b565b60408301525092915050565b6000614ac8614ac384614a25565b614158565b90508083825260208201905060608402830185811115614aeb57614aea613e5a565b5b835b81811015614b145780614b008882614a51565b845260208401935050606081019050614aed565b5050509392505050565b600082601f830112614b3357614b32613e50565b5b8135614b43848260208601614ab5565b91505092915050565b600060208284031215614b6257614b61613de8565b5b600082013567ffffffffffffffff811115614b8057614b7f613ded565b5b614b8c84828501614b1e565b91505092915050565b600081519050919050565b600082825260208201905092915050565b6000819050602082019050919050565b614bca81613e12565b82525050565b614bd981614089565b82525050565b606082016000820151614bf56000850182614bc1565b506020820151614c086020850182614bd0565b506040820151614c1b6040850182614bd0565b50505050565b6000614c2d8383614bdf565b60608301905092915050565b6000602082019050919050565b6000614c5182614b95565b614c5b8185614ba0565b9350614c6683614bb1565b8060005b83811015614c97578151614c7e8882614c21565b9750614c8983614c39565b925050600181019050614c6a565b5085935050505092915050565b60006020820190508181036000830152614cbe8184614c46565b905092915050565b60008083601f840112614cdc57614cdb613e50565b5b8235905067ffffffffffffffff811115614cf957614cf8613e55565b5b602083019150836020820283011115614d1557614d14613e5a565b5b9250929050565b600080600060408486031215614d3557614d34613de8565b5b600084013567ffffffffffffffff811115614d5357614d52613ded565b5b614d5f86828701614cc6565b93509350506020614d7286828701614341565b9150509250925092565b600060208284031215614d9257614d91613de8565b5b6000614da084828501613e3b565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b600080fd5b600080fd5b600080fd5b60008083356001602003843603038112614e0457614e03614dd8565b5b80840192508235915067ffffffffffffffff821115614e2657614e25614ddd565b5b602083019250600182023603831315614e4257614e41614de2565b5b509250929050565b600081905092915050565b6000614e618385614e4a565b9350614e6e8385846148e6565b82840190509392505050565b6000614e87828486614e55565b91508190509392505050565b600067ffffffffffffffff821115614eae57614ead6140f8565b5b614eb782613f87565b9050602081019050919050565b6000614ed7614ed284614e93565b614158565b905082815260208101848484011115614ef357614ef26148b0565b5b614efe848285613f5d565b509392505050565b600082601f830112614f1b57614f1a613e50565b5b8151614f2b848260208601614ec4565b91505092915050565b600060208284031215614f4a57614f49613de8565b5b600082015167ffffffffffffffff811115614f6857614f67613ded565b5b614f7484828501614f06565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b6000614fb782614089565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8203614fe957614fe8614f7d565b5b600182019050919050565b7f554e4155544f52495a4544000000000000000000000000000000000000000000600082015250565b600061502a600b836149b9565b915061503582614ff4565b602082019050919050565b600060208201905081810360008301526150598161501d565b9050919050565b600061506b82614089565b915061507683614089565b925082820261508481614089565b9150828204841483151761509b5761509a614f7d565b5b5092915050565b60006150ad82614089565b91506150b883614089565b92508282019050808211156150d0576150cf614f7d565b5b92915050565b6150df81613e12565b82525050565b60006040820190506150fa60008301856150d6565b61510760208301846150d6565b9392505050565b60007fffffffff0000000000000000000000000000000000000000000000000000000082169050919050565b6000819050919050565b6151556151508261510e565b61513a565b82525050565b600061516682613f41565b6151708185614e4a565b9350615180818560208601613f5d565b80840191505092915050565b60006151988285615144565b6004820191506151a8828461515b565b91508190509392505050565b60006151c0828461515b565b915081905092915050565b60006151d682613df2565b9050919050565b6151e6816151cb565b81146151f157600080fd5b50565b600081519050615203816151dd565b92915050565b60006020828403121561521f5761521e613de8565b5b600061522d848285016151f4565b91505092915050565b600061524182614089565b915061524c83614089565b925082820390508181111561526457615263614f7d565b5b92915050565b600060208201905061527f60008301846150d6565b92915050565b60008151905061529481614267565b92915050565b6000602082840312156152b0576152af613de8565b5b60006152be84828501615285565b91505092915050565b7f5448495320434f4e5452414354204953204c4f434b45442c205550444154452060008201527f544f204e45572056455253494f4e000000000000000000000000000000000000602082015250565b6000615323602e836149b9565b915061532e826152c7565b604082019050919050565b6000602082019050818103600083015261535281615316565b9050919050565b7f544f204d55535420434f4e5441494e204154204c45415354203120414444524560008201527f5353000000000000000000000000000000000000000000000000000000000000602082015250565b60006153b56022836149b9565b91506153c082615359565b604082019050919050565b600060208201905081810360008301526153e4816153a8565b9050919050565b7f4e4f5420454e4f55474820494e4f555432202056414c55455320444546494e4560008201527f4400000000000000000000000000000000000000000000000000000000000000602082015250565b60006154476021836149b9565b9150615452826153eb565b604082019050919050565b600060208201905081810360008301526154768161543a565b9050919050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601260045260246000fd5b60006154b782614089565b91506154c283614089565b9250826154d2576154d161547d565b5b828206905092915050565b7f494e56414c4944205041544820444546494e4544000000000000000000000000600082015250565b60006155136014836149b9565b915061551e826154dd565b602082019050919050565b6000602082019050818103600083015261554281615506565b9050919050565b600061555482614089565b915061555f83614089565b92508261556f5761556e61547d565b5b828204905092915050565b60008151905061558981613e24565b92915050565b6000602082840312156155a5576155a4613de8565b5b60006155b38482850161557a565b91505092915050565b7f544f20414444524553532043414e4e4f54204245203000000000000000000000600082015250565b60006155f26016836149b9565b91506155fd826155bc565b602082019050919050565b60006020820190508181036000830152615621816155e5565b9050919050565b7f494e4f55542043414e4e4f542042452030000000000000000000000000000000600082015250565b600061565e6011836149b9565b915061566982615628565b602082019050919050565b6000602082019050818103600083015261568d81615651565b9050919050565b7f494e53554646494349454e54204c495155494449545900000000000000000000600082015250565b60006156ca6016836149b9565b91506156d582615694565b602082019050919050565b600060208201905081810360008301526156f9816156bd565b9050919050565b600061570b82614089565b91506000820361571e5761571d614f7d565b5b600182039050919050565b600060408201905061573e60008301856150d6565b61574b6020830184614093565b9392505050565b6000815190506157618161432a565b92915050565b60006020828403121561577d5761577c613de8565b5b600061578b84828501615752565b91505092915050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052600160045260246000fd5b60006060820190506157d860008301866150d6565b6157e560208301856150d6565b6157f26040830184614093565b949350505050565b7f54415820544f4f20484947480000000000000000000000000000000000000000600082015250565b6000615830600c836149b9565b915061583b826157fa565b602082019050919050565b6000602082019050818103600083015261585f81615823565b9050919050565b7f494e53554646494349454e54204f555420414d4f554e54000000000000000000600082015250565b600061589c6017836149b9565b91506158a782615866565b602082019050919050565b600060208201905081810360008301526158cb8161588f565b9050919050565b7f424c41434b4c4953544544000000000000000000000000000000000000000000600082015250565b6000615908600b836149b9565b9150615913826158d2565b602082019050919050565b60006020820190508181036000830152615937816158fb565b9050919050565b7f4944454e544943414c5f41444452455353455300000000000000000000000000600082015250565b60006159746013836149b9565b915061597f8261593e565b602082019050919050565b600060208201905081810360008301526159a381615967565b9050919050565b7f5a45524f5f414444524553530000000000000000000000000000000000000000600082015250565b60006159e0600c836149b9565b91506159eb826159aa565b602082019050919050565b60006020820190508181036000830152615a0f816159d3565b9050919050565b6000615a228284615144565b60048201915081905092915050565b60006dffffffffffffffffffffffffffff82169050919050565b615a5481615a31565b8114615a5f57600080fd5b50565b600081519050615a7181615a4b565b92915050565b60008060408385031215615a8e57615a8d613de8565b5b6000615a9c85828601615a62565b9250506020615aad85828601615a62565b9150509250929050565b7f494e53554646494349454e545f4f55545055545f414d4f554e54000000000000600082015250565b6000615aed601a836149b9565b9150615af882615ab7565b602082019050919050565b60006020820190508181036000830152615b1c81615ae0565b9050919050565b7f494e53554646494349454e545f4c495155494449545900000000000000000000600082015250565b6000615b596016836149b9565b9150615b6482615b23565b602082019050919050565b60006020820190508181036000830152615b8881615b4c565b9050919050565b7f494e53554646494349454e545f494e5055545f414d4f554e5400000000000000600082015250565b6000615bc56019836149b9565b9150615bd082615b8f565b602082019050919050565b60006020820190508181036000830152615bf481615bb8565b9050919050565b600082825260208201905092915050565b6000615c1782613f41565b615c218185615bfb565b9350615c31818560208601613f5d565b615c3a81613f87565b840191505092915050565b6000608082019050615c5a6000830187614093565b615c676020830186614093565b615c7460408301856150d6565b8181036060830152615c868184615c0c565b90509594505050505056fea264697066735822122096ebaf261d14081ef4968436bcbb93af66d07b43648f8b818bcf062aff168b2d64736f6c63430008110033

## main reason/feature: Reentrancy Attack

### [link](https://x.com/TenArmorAlert/status/1831199347910058143)

this is a classic case of price manipulation. The swapProfitFees() function lacks slippage protection and is easily manipulated by a swap.

``` solidity

function swapProfitFees() external {
        IPancakeRouter02 router = IPancakeRouter02(pancakeRouterAddr);
        address[] memory path = new address[](2);
        uint256 totalBNBForGame;
        uint256 totalBNBForLink;
        uint256 length = casinoCount;
        uint256 BNBPPool = 0;

        // Swap each token to BNB
        for (uint256 i = 1; i <= length; ++i) {
            Casino memory casinoInfo = tokenIdToCasino[i];
            IERC20 token = IERC20(casinoInfo.tokenAddress);

            if (casinoInfo.liquidity == 0) continue;

            uint256 availableProfit = casinoInfo.profit < 0 ? 0 : uint256(casinoInfo.profit);
            if (casinoInfo.liquidity < availableProfit) {
                availableProfit = casinoInfo.liquidity;
            }

            uint256 gameFee = (availableProfit * casinoInfo.fee) / 100;
            uint256 amountForLinkFee = getTokenAmountForLink(casinoInfo.tokenAddress, linkSpent[i]);
            _updateProfitInfo(i, uint256(gameFee), availableProfit);
            casinoInfo.liquidity = tokenIdToCasino[i].liquidity;

            // If fee from the profit is not enought for link, then use liquidity
            if (gameFee < amountForLinkFee) {
                if (casinoInfo.liquidity < (amountForLinkFee - gameFee)) {
                    amountForLinkFee = gameFee + casinoInfo.liquidity;
                    tokenIdToCasino[i].liquidity = 0;
                } else {
                    tokenIdToCasino[i].liquidity -= (amountForLinkFee - gameFee);
                }
                gameFee = 0;
            } else {
                gameFee -= amountForLinkFee;
            }

            // Update Link consumption info
            _updateLinkConsumptionInfo(i, amountForLinkFee);

            if (casinoInfo.tokenAddress == address(0)) {
                totalBNBForGame += gameFee;
                totalBNBForLink += amountForLinkFee;
                continue;
            }
            if (casinoInfo.tokenAddress == BNBPAddress) {
                BNBPPool += gameFee;
                gameFee = 0;
            }

            path[0] = casinoInfo.tokenAddress;
            path[1] = wbnbAddr;

            if (gameFee + amountForLinkFee == 0) {
                continue;
            }
            token.approve(address(router), gameFee + amountForLinkFee);
            uint256[] memory swappedAmounts = router.swapExactTokensForETH(
                gameFee + amountForLinkFee,
                0,
                path,
                address(this),
                block.timestamp
            );
            totalBNBForGame += (swappedAmounts[1] * gameFee) / (gameFee + amountForLinkFee);
            totalBNBForLink += (swappedAmounts[1] * amountForLinkFee) / (gameFee + amountForLinkFee);
        }

        path[0] = wbnbAddr;
        // Convert to LINK
        if (totalBNBForLink > 0) {
            path[1] = linkTokenAddr;

            // Swap BNB into Link Token
            uint256 linkAmount = router.swapExactETHForTokens{ value: totalBNBForLink }(
                0,
                path,
                address(this),
                block.timestamp
            )[1];

            // Convert Link to ERC677 Link
            IERC20(linkTokenAddr).approve(pegSwapAddr, linkAmount);
            PegSwap(pegSwapAddr).swap(linkAmount, linkTokenAddr, link677TokenAddr);

            // Fund VRF subscription account
            LinkTokenInterface(link677TokenAddr).transferAndCall(
                coordinatorAddr,
                linkAmount,
                abi.encode(subscriptionId)
            );
            emit SuppliedLink(linkAmount);
        }

        // Swap the rest of BNB to BNBP
        if (totalBNBForGame > 0) {
            path[1] = BNBPAddress;
            BNBPPool += router.swapExactETHForTokens{ value: totalBNBForGame }(0, path, address(this), block.timestamp)[
                1
            ];
        }

        if (BNBPPool > 0) {
            // add BNBP to tokenomics pool
            IERC20(BNBPAddress).approve(potAddress, BNBPPool);
            IPotLottery(potAddress).addAdminTokenValue(BNBPPool);

            emit SuppliedBNBP(BNBPPool);
        }
    }

    receive() external payable {}

```

## main reason/feature:Flash Loan

### [link](https://x.com/TenArmorAlert/status/1830198463814107267)

The root cause lies in the buyTokensBUSD() function in TabooPresale, which calculates the WBNB/BUSD price based on a shallow SushiSwap pool. This pool can be easily manipulated by the attacker using a flashloan.

``` solidity

function buyTokensBUSD(address_beneficiary, uint256 _BUSDAmount)
    public
    nonReentrant
    whenNotPaused
{
    _BUSD. transferFrom(msg. sender, _wallet, _BUSDAmount) ;
    uint256 tokens = _getTokenAmountBUSD (_BUSDAmount) ;
    require (tokens >=_minAmount, "Please buy tokens above the minimum limit");
    _token.transferFrom(_outGoingWallet,_beneficiary,tokens);
    emit TokensPurchased(_msgSender(), _beneficiary, _BUSDAmount, tokens);
}

```

``` solidity

function getTabooPrice() public view returns (uint256) {
    uint112 reserve0;
    uint112 reservel;
    uint32 timestamp;
    uint256 exchangeRate;   
    (reserve0, reserve1, timestamp) = IProviderPair (TokenBnb) .getReserves ();
    address token0 = IProviderPair (TokenBnb).token0();
    if (token0 == address (_token)) {
        exchangeRate = (uint256((uint256(reserve0) * (10**18)) / uint256(reserve1)));
    } else {
        exchangeRate = (uint256((uint256(reserve1) * (10**18)) / uint256(reserve0) )) ;
    }
    uint256 bnbPrice = getPriceData( BusdBnb) ;
    exchangeRate = (exchangeRate * 1e9) / bnbPrice;
    return (exchangeRate);
}

```

``` solidity

function getPriceData(IProviderPair_pairAddress)
    public
    view
    returns (uint256)
{
    uint112 reserve0;
    uint112 reservel;
    uint32 timestamp;
    uint256 exchangeRate;
    (reserveo, reservel, timestamp) = IProviderPair(_pairAddress)
        .getReserves();
    address token0 = IProviderPair(_pairAddress).token0();
    if (token0 == address (_BUSD) ) {
        exchangeRate = (uint256((uint256(reserve0) * (10**9)) / uint256(reserve1) ));
    } else {
        exchangeRate = (uint256((uint256(reserve1) * (10**9)) / uint256(reserve0) )) ;
    }
    return (exchangeRate);
}

```

## main reason/feartue:Access Control

### [link](https://x.com/TenArmorAlert/status/1829538255190237515)

The root cause is lack of access control on the KH token's burn() function. The attacker burned the tokens from the pair and drained the pool.

``` solidity

function burn(address _user, uint256 value) external {
    _burn(_user,value);
}
```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1828983569278231038)

The root cause is the absence of access control for the grantRole() function. This allows anyone to be assigned the admin role and withdraw all funds from the handler contract.

``` solidity

function Oxd8f(address vargo, uint256 vargl) private {
    0x1879 (_getRoleAdmin [varg1].field1);
    if (!uint8(_getRoleAdmin[varg1].field0[address(varg0)])) {
        _getRoleAdmin [varg1]. fieldO [varg0] = 0x1 | bytes31(_getRoleAdmin[varg1]. field0 [address(varg0)]);
        emit RoleGranted (vargl, vargo, msg. sender) ;
    }
    return ;
}

function Oxd8f(address vargo, uint256 vargl) private {
    0x1879 (_getRoleAdmin [varg1].field1);
    if (luint8(_getRoleAdmin[varg1].field0[address(varg0)])) {
       _getRoleAdmin[varg1].field0[varg0] = 0x1 | bytes31(_getRoleAdmin[varg1].field0[address(varg0)]);
    emit RoleGranted (vargl, vargo, msg. sender) ;
    }
return ;
}

```

## main reason/feature:Permission Control

### [link](https://x.com/TenArmorAlert/status/1826149844773384566)

The root cause is that anyone can bypass the simple check and burn the tokens of the pair.

``` solidity

function burn () external {
    require (buys >= 5000 * burns, "can't call yet");
    uint256 r = accounts[_pool].nTotal;
    uint256 Target = (r / 5); // 20%
    uint256 t = Target / ratio();
    accounts _pooll.nTotal -= rTarget;
    accounts [address (0)].nTotal += rTarget;
    emit Transfer(_pool, address (0), t);
    burns++;
    syncPool () ;
}

```

## main reason/feature:Integer Truncation

### [link](https://x.com/TenArmorAlert/status/1859830885966905670)

It appears that the stake function of the MatezStakingProgram contract contains a classic integer truncation vulnerability.

This flaw allowed the attacker to transfer a zero amount of tokens while being recognized by the contract as having staked a large amount. Consequently, the attacker was able to claim tokens as profit.

``` solidity

function stake(uint256 amnt) public {
    require (users [msg.sender].id != 0 ,"Register Before Deposit!");
    
    users [msg.sender].invest_count++;
    address sponsor = users [msg. sender]. sponsor;
    if(users [msg. sender]. invest_count==1)‹
        users [sponsor] .directs++;
        addteam (sponsor);
    ｝
    
    uint256 amntin = estimateAmountOut (address (token1) ,uint128(amnt), 1);
    depositToken. transferFrom(msg.sender, address (this), amntin) ;
    users [msg.sender].selfInvest += amnt;

    users [sponsor].directInvest += amnt;

    uint40 o_id = users [msg. sender]. invest_count;

    orders [msg.sender] [o_id].amount = amnt;
    orders [msg. sender] [o_id]. timestamp = uint40 (block.timestamp) ;
    orders [msg. sender] [o_id].last_claim =_claim = uint40 (block.timestamp);
    orders [msg. sender] [o_id].status = true;
    updateDis (msg. sender, amnt) ;
    emit upgrade_package (users [msg. sender]. id, amnt) ;
}

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1860134155511824516)

The emergencyWithdrawToken function in contract 0x6641 appears to lack proper access control, enabling anyone to drain the contract's $SWEEPR tokens.

MEV frontrunner Yoink quickly seized this profit opportunity

``` solidity

function emergencyWithdrawToken (address _token) public payable k
    require(msg.data.length - 4 >= 32) ;
    vO, /* uint256 */ v1 =_ token. balanceof (this).gas (msg.gas) ;
    require (bool(v0), 0, RETURNDATASIZE()); // checks call status
    require (MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    v2, /* bool */ v3 =_ token. transfer(msg.sender, v1).gas (msg.gas);
    require (bool(v2), 0, RETURNDATASIZE()); // checks call status
    require (MEM [64] + RETURNDATASIZE() - MEM [64] >= 32) ;
    require (v3 == bool(v3));

```




The root cause seems to be a lack of access control for function nonblockingLzReceive1(),  anyone call it to mint token for free, maybe it is not supposed to be open to public in the first place .

``` solidity
    function nonblockingLzReceive1{
        uint16 _srcChainId,
        address _srcAddress,
        uint256 _nonce,
        bytes memory _payload
} public virtual override {
    _creditTo(_srcChainId, _srcAddress, _nonce) ;
}    
    function circulatingSupply() public view virtual override returns (uint) {
        return totalSupply();
    }
    function_debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint _amount
    ) internal virtual override returns (uint) {
        address spender =_msgSender ( );
        if (_from != spender) _spendAllowance (_from, spender, _amount) ;
        _burn (_from, _amount) ;
        return _amount;
    }
function _creditTo(
        uint16,
        address _toAddress,
        uint _amount
    )internal virtual override returns (uint) {
        _mint (_toAddress, _amount);
        return _amount;
    }

```

## main reason/feature:Flash Loan and Sandwich Attack

### [link](https://x.com/TenArmorAlert/status/1860692981227126828)

this attack exploited two critical vulnerabilities in the DCF token contract, leveraging a $110M USDT flashloan to execute the exploit.

First Vulnerability: The transfer function allowed anyone to burn tokens from the USDT/DCF pair. 
The attacker exploited this flaw using 83 DCF tokens purchased from a USDT/DCF v3 pool deployed only six hours prior to the attack. 
This approach bypassed the buying restriction in the v2 pair.

Second Vulnerability: The addLiquidity process in the transfer function lacked slippage protection, enabling the attacker to recover their USDT costs via a sandwich attack.

``` solidity

// buying restriction
if (from = pairAddress) {
    require(false, "buy error");
}
// swap token for usdt
if (to = pairAddress && !swapping) {
    swapping = true;
    uint256 fee = (amount * 5) / 100; // 5%
    uint256 deadAmount = (amount - fee) / deadCfg;
    amount -= fee;
    super._transfer(from, address(this), fee);
    
    uint256 initialUstBalance = IERC20 (USDT) . balance0f(helperAddress) ;
    swapTokensForUSDT (fee, helperAddress) ;
    uint256 newUstBalance = IERC20 (USDT) . balance0f(helperAddress) -
        initialUsdtBalance;
    liquidityHelper.addLiquidity(newUsdtBalance) ;
    swapping = false;
    if (balance0f(pairAddress) > deadAmount) {
        burnPair (deadAmount) ;
    }
}
    // proceed transfer
    super._transfer(from, to, amount);
}

function swapTokensForUSDT(uint256 _tokenAmount, address _to) private {
    address[]memory path = new address [] (2);
    path [0] = address (this) ;
    path [1] = USDT;
    _approve (address (this), router,
    uniswap2Router. swapExactToken$ForTokensSupportingFeeDnTransferTokens/
        _tokenAmount,
        path,
        to,
        block.timestamp
    );
}

```

## main reason/feature:

### [link](https://x.com/TenArmorAlert/status/1860715399186448889)

Looks like someone just cracked a buggy ancient ponzi scheme contract, in the pay() function currentReceiverIndex is updated incorrectly, making some of the depositors being skipped for a repay, thus the contract has accummulated up to 14 eth, considering the funds has been stuck there for more than 6 years, the bug doesn't seem to be by intention.

the attacker carefully crafted a sequence of deposits, by placing those 3-eth deposits on the position that can not be skipped, it successfully taking all the stuck funds(as the 11% profit for each 3-eth deposits).

``` solidity
//Used to pay to current investors
//Each new transaction processes 1 - 4+ investors in the head of queue
//depending on balance and gas left
function pay() private {
        //Try to send all the money on contract to the first investors in line
        uint128 money = uint128(address (this).balance);
    
    //We will do cycle on the queue
    for(uint i=0; i<queue.length; i++){
        
        uint idx = currentReceiverIndex + i; //get the index of the currently first investor
        
        Deposit storage dep = queue [idx]; //get the info of the first investor
        
        if (money ›= dep. expect ){
            dep.depositor.send(dep.expect); //Sendugh money on the contract to fully pay to investo
        
        money -= dep. expect;//update money left
        
        //this investor is fully paid, so remove him
        delete queue [idx];
}else{
        // Here we don't have enough money so partially pay to investor
        dep. depositor. send (money); //Send to him everything we have
        dep. expect -= money;//Update the expected amount
        break;//Exit cycle
    }

    if (gasleft () < 50000)//Check the gas left. If it is low, exit the cycle
        break;//The next investor will process the line further
    ｝

currentReceiverIndex += i; //Update the index of the current first investor
}
```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1861430745572745245)

It appears that the PresaleWithUSDT function in the contract 0x5fbb contains a flaw, allowing the attacker to get more USDT than they initially deposited.

``` solidity

require(varg0 = v4, Error('Amount should be lower or equal then maxBuy')) ;
    v5, /* bool */ v6 = _presaleWithUSDT. transferFrom(msg.sender, address (this), vargo)-gas(msg-gas) ;
    require (bool(v5), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    MEM [64] = MEM[64] + (RETURNDATASIZE() + 31 & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0);
    require (MEM [64] + RETURNDATASIZE () - MEM[64] >= 32) ;
    require (v6 == bool (v6)) ;
    v7 = v8 = address (varg1) != address (0x0) ;
    if (address(varg1) != address (0x0)) {
        v7 = v9 = address(varg1) != msg. sender;
    }
    
    if (v7) {
        v10, /* uint256 */ v11 = _setMainContract.balanceof(address(varg1)) •gas(msg.gas) ;
        require (bool (v10), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
        MEM [64] = MEM [64] + (RETURNDATASIZE() + 31 & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0);
        require (MEM[64] + RETURNDATASIZE () - MEM [64] >= 32) ;
        v7 = v12 = v11 > 0;
    }
    if (v7) {
        v13 =_SafeMul(v2, _percentCommissionRef) ;
        v14 =_ SafeDiv(v13, 100) ;
        0x1490(v14, varg1);
        if (stor_2_2_2 > 0)
            v15 = _SafeMul (vargo, stor_2_2_2);
            v16 = _SafeDiv(v15, 100);
            v17, /* bool */ v18 = _presaleWithUSDT. transfer(address(varg1), v16). gas (msg-gas) ;
            require (bool (v17), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
            MEM[64] = MEM[64] + (RETURNDATASIZE() + 31 & 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0);
            require (MEM [64] + RETURNDATASIZE() - MEM [64] >= 32) ;
            require (v18 == bool (v18));
    }
    0x1490 (v2, msg. sender) ;
    return True;
}

```

## main reason/feature:Permission Control

### [link](https://x.com/TenArmorAlert/status/1863043149645418600)

bytecode

0x5f3560f81c805f146102d35780600114610037578060021461011d578060fa146106a5578060121461022f578060131461026c575f5ffd5b42341161006b5760017fbe20788c000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b6323b872dd5f523360205260146001604c3760163560f81c80601881602003606001375f5f6064601c8273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc25af1505f6020525f6040525f60605263022c0d9f5f5260153560f81c60173560f81c8260180182156100e05781606003376100e6565b81604003375b730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf60605260806080525f5f60a4601c8260013560601c5af11561011957005b5f5ffd5b4234116101515760017fbe20788c000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b6323b872dd5f52336020523060405260163560f81c80601881602003606001375f5f6064601c8273c02aaa39b223fe8d0a0e5c4f27ead9083c756cc25af1505f6020525f6040525f60605263128acb085f52730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf60205260153560f81c806040528160188160200360600137156101e3576401000276a46080526101fc565b73fffd8963efd1fc6a506488495d951d5263988d256080525b60a060a05260173560f81c808060c0528260180160e0375f5f8260c401601c8260013560601c5af11561022b57005b5f5ffd5b730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf331461024e575f5ffd5b5f5f5f5f47730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf5af1005b730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf331461028b575f5ffd5b60013560601c60153560601c730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf63a9059cbb5f5280602052816040525f5f6044601c82875af1156102ce575f5ff35b5f5ffd005b4234116103075760017fbe20788c000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf3314610326575f5ffd5b3660015b8181146106a357803560f81c805f146103615780600114610432578060021461053d57806003146105c95780600414610661575f5ffd5b50806016013560f81c816001013560601c5f6020525f6040525f60605263022c0d9f5f52826015013560f81c828460170182156103a25781606003376103a8565b81604003375b50828260170101803560f81c805f146103cc57806001146103d757806002146103f6575b505030606052610407565b5050730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf606052610407565b506001013560601c60605290601401905b60806080525f60a0525f5f60a4601c82855af11561042957506018010161042d565b5f5ffd5b61032a565b50806016013560f81c816018013560f81c63128acb085f525f6020525f6040525f6060525f6080525f60a05281836019018160200360600137826015013560f81c806040521561048a576401000276a46080526104a3565b73fffd8963efd1fc6a506488495d951d5263988d256080525b60a060a0528060c0528083836019010160e037826017013560f81c805f146104d657806001146104e057806002146104fe575b5030602052610512565b50730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf602052610512565b5082828260190101013560601c6020526014015b5f5f8260c401601c82876001013560601c5af115610534576019010101610538565b5f5ffd5b61032a565b505f6020525f6040525f6060525f6080526323b872dd5f5233602052806015013560f81c816016013560f81c8015610581578282601701013560601c604052610586565b306040525b818360170181602003606001375f5f6064601c82876001013560601c5af1156105c057156105b757602b01016105c4565b601701016105c4565b5f5ffd5b61032a565b505f6020525f6040525f60605263a9059cbb5f52806015013560f81c816016013560f81c8015610605578282601701013560601c60205261061e565b730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf6020525b818360170181602003604001375f5f6044601c82876001013560601c5af115610658571561064f57602b010161065c565b6017010161065c565b5f5ffd5b61032a565b50806015013560f81c816016013560f01c808383601801015f378260180135826020036008021c5f5f835f84886001013560601c5af15050601801010161032a565b005b730a6c69327d517568e6308f1e1cd2fd2b2b3cd4bf32146106c4575f5ffd5b60843560f81c806106ff576004357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0360010160243561072b565b6024357fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff036001016004355b81609a3560993560f81c6020036008021c1061076e5760027fbe20788c000000000000000000000000000000000000000000000000000000005f5260045260245ffd5b63a9059cbb5f52336020526040525f5f6064601c8260853560601c5af1

``` solidity

if (1 == msg.data[0] >> 248) {
    require(msg.value > block.timestamp, 1);
    CALLDATACOPY(76, 1, 20);
    v17 = 0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2.transferFrom(msg.sender).gas(msg.gas);
}

```

transferFrom permission control is missing:only checked msg.value > block.timestamp, did not verify msg.sender permission

##

### [link](https://x.com/TenArmorAlert/status/1863741508970516830)

When a transfer is mistakenly identified as a removeLiquidity action, the recipient’s balance is increased by the balance of the 0xdead address. 

This allowed the attacker to repeatedly simulate removeLiquidity transfers, accumulating a significant amount of tokens effortlessly.

It's unclear what the true intent behind this logic is—perhaps a simple typo or even a deliberate backdoor?

Additionally, the decision logic for removeLiquidity and addLiquidity can be manipulated through token transfers. 

Despite restrictions on buying and selling, the attacker bypassed these limitations by simulating addLiquidity transfers, ultimately securing profit.

Interestingly, the attacker deposited the profits into a pre-created Uniswap pair.

``` solidity

// remove
if (sender==uniswapV2Pair && recipient!=uniswapV2Pair && _ isRemoveLiquidity()) {
    if (types==1){
        _tokenTransfer2 (sender, recipient, amount);
    }else {
        _tokenTransfer (sender, recipient, amount);
    }
}else if (sender!=uniswapV2Pair && recipient==uniswapV2Pair && _isAddLiquidity (amount)) {
// add
    if (addLpTime == 0) {
        addLpTime = block. timestamp;
    }
    if(burnTimes == 0){
        burnTimes = block.timestamp;
    }
    _tokenTransfer(sender, recipient, amount);
// buy
} else if (sender==uniswapV2Pair && recipient!=uniswapV2Pair &&_isRemoveLiquidity()) {
    require(openSell|| isWirte[recipientl, "not open buy");
    // Buy
    _tokenTransfer(sender, recipient, amount);
    //_autoBurn();
// sell
}else if (sender!=uniswapV2Pair && recipient==uniswapV2Pair && !_ isAddLiquidity (amount)) {
    require(openSell || isWirte[sender], "not open sell");
    // sell
    _tokenTransfer(sender, recipient, amount) ;
} else{
    _tokenTransfer(sender, recipient, amount);
    //_autoBurn();
}

```

``` solidity

function _tokenTransfer2(
    address sender,
    address recipient,
    uint256 tAmount
) private {
    _balances [sender] =_balances [sender].sub (tAmount) ;
    _balances [recipient] =_balances[_destroyAddress].add (tAmount); //it seems should be _balances[destoryAddress] = ...
    _balances [recipient] =_balances [recipient].add(0);
    emit Transfer (sender, _destroyAddress, tAmount);
}

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1864126176848965810)

The swapTokenU function in the Pledge contract lacks access control, allowing the attacker to drain tokens from the contract and swap them for profit.

``` solidity

function swapTokenU(uint256 amount, address_target) public {
    IERC2O (_token) .approve(address (_swapRouter), MAX) ;
    address[] memory path = new address [](2) ;
    path[0] =_token;
    path[1] = _USDT;
    _swapRouter.swapExactTokensForTokensSupportingFee0nTransferTokens(
        amount,
        0,
        path,
        target,
        block.timestamp
    );
}

```

## main reason/feature:

### [link](https://x.com/TenArmorAlert/status/1864326816598556765)

It appears the unStake function in VestraDAO's staking contract fails to properly check if a user is marked as inactive after unstaking.

An attacker, who staked 500k VSTR tokens a month ago, is now repeatedly calling the unStake function to claim an excessive amount of VSTR tokens.

``` solidity

function unStake(uint8 maturity) external nonReentrant onlyMaturity (maturity) {
    address account = _msgSender ();
    Stake storage user = stakes [account] [maturityl;
    require(
    user. stakeAmount > 0,
    "STAKE: LOCK: You have no active token lock staking."   
);

uint64 currentTime = uint64 (block.timestamp);

MaturityData storage data = maturities [maturity];
require(
    currentTime >= user.startTime + data.unlockTime,
    "STAKE: LOCK: You cannot leave before your time is up."
);

uint256 stakeAmount = user.stakeAmount;
uint256 totalAmount = stakeAmount + user.yield;

uint256 penaltyAmount _penaltyCalculate(totalAmount, currentTime, user. endTime + data. lateUnStakeFee) ;
if(penaltyAmount > 0){
    ITokenBurn (token). burn (penaltyAmount) ;
    totalAmount -= penaltyAmount;
}

user.penalty = penaltyAmount;
user.isActive = false;

data.totalStaked -= stakeAmount;
data.countUser--;
data.totalPenalty += penaltyAmount;

IERC20 (token) .safeTransfer(account, totalAmount);

emit Unstake(account, stakeAmount, maturity, user.yield, user.startTime, penaltyAmount);

}

```

## main reason/feature:Rounding error

### [link](https://x.com/TenArmorAlert/status/1865026112499126551)

The root cause lies in a rounding error within the convertToShares() function. When a user redeems 1 share, the function calculates the burnable token amount by rounding down, resulting in a value of 0.

``` solidity

function convertToShares (
    uint256 assets
) public view virtual returns (uint256 shares) {
    uint _totalAssets = totalAssets ();
    
    if (_totalAssets == 0 && totalSupply() == 0) return assets;
    // Case where all funds are withdrawn, but shares still exist (then PPS = 0)
    if (_totalAssets == 0 && totalSupply() › 0) return 0;
    // Why case of totalAssets › 0 and totalSupply() == 0 is not considered?
    
    return assets.mulDiv(totalSupply(), _totalAssets, Math.Rounding. Floor);

}

```

``` solidity

function _withdraw(
    address receiver,
    address owner,
    uint assets,
    uint shares
 ) internal {
    if (receiver == address(0)) revert ZeroAddress ("receiver");
    if (owner == address(0)) revert ZeroAddress ("owner");
    if (assets = 0) revert ZeroAssets;
    if (shares == 0)

    uint yield = totalAssets () - prevTotalAssets;
    // if (assets |= convertToAssets (shares)) revert InvalidAssetsInput();
    
    // TODO: should account for losses in the withdrawal process
    _beforeBurn (receiver, owner, assets, shares) ;
    shares = convertToShares (assets):
    burn (msg. sender, shares) ;
    
    _afterBurn (receiver, owner, assets, shares);
    
    _mintFees (yield);
    _updatePrevTotalAssets ();
    
    emit Withdraw(msg. sender, receiver, owner, assets, shares);
}

```

## main reason/feature: logic

### [link](https://x.com/TenArmorAlert/status/1866481066610958431)

The root cause lies in the flawed logic in handling self-transfers.

``` solidity

function_transfer(address sender, address recipient, uint256 amount) internal {
    require (sender != address (0), "Xfer from zero addr");
    require( recipient != address(0), "Xfer to zero addr");
    
    uint256 senderBalance =_ balances [sender];
    uint256 recipientBalance =_ balances recipient;
    uint256 newSenderBalance = SafeMath. sub (senderBalance, amount) ;
    
    if (newSenderBalance != senderBalance) {
        _balances [sender] = newSenderBalance;
    }
    
    uint256 newRecipientBalance = recipientBalance.add (amount) ;
    if (newRecipientBalance != recipientBalance) {
        _balances [recipient] = newRecipientBalance;
    }
    if (_balances [sender] = 0) {
    _balances [sender] = 16;
    }

emit Transfer(sender, recipient, amount);

}

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1868845296945426760)

With TenArmor's ArgusAlert, you get early detection and automated response to on-chain attacks.

``` solidity

function deposit() external {
    uint256 totalAmount = 110000;
    token.safeTransferFrom(
        msg. sender,
        address (this),
        totalAmount * 1 ether
    );
    
    claims = Claim({
        amount: 110000 * 1 ether,
        releaseDate: 1734220800,
        claimed: false
    }) ;
}

function claim() external onlyOnOrAfter(claims. releaseDate) {
    require(claims.claimed, 'Already claimed');
    
    claims. claimed = true;
    uint256 claimAmount = claims. amount;
    token. safeTransfer(msg.sender, claimAmount) ;
}

```

## main reason/feature:Reentrancy Attack

### [link](https://x.com/TenArmorAlert/status/1869579224291623314)

The root cause lies in the GempadLock contract, which lacks proper reentrancy protection for critical functions, including the collectFees and multipleLock functions.

The collectFees function determines the fees collected from v3 pool positions, relying on the token balance change of the contract after calling the v3 pool’s collect function.

This provides an opportunity to reenter other functions when the collect function calls the pool token’s transfer, which can be controlled by the attacker.

The multipleLock function locks tokens from msg.sender and records the lock ID for the user, which can be used to unlock the tokens. This function is an ideal target for reentry, as it changes the balance of the contract.

By repeatedly exploiting this vulnerability, the attacker obtained lots of lock IDs for tokens at no cost, and finally profited by unlocking the tokens from the victim GempadLock contract.

``` solidity

function collectFees (
    uint256 lockId
) external isLockOwner(lockId) validLockLPv3(lockId) returns (uint256 amounto, uint256 amount1) {
    Lock storage userLock = _locks [lockId];
    // set amountMax and amountiMax to uint256.max to collect all fees
    // alternatively can set recipient to msg. sender and avoid another transaction in sendToOwner
    INonfungiblePositionManager.CollectParams
        memory params = INonfungiblePositionManager.CollectParams ({
        tokenId: userLock.nftId,
        recipient: address (this),
        amountMax: type(uint128).max,
        amountlMax: type(uint128) .max
}) ;

// send collected feed back to owner
(   
    ,
    ,
    address token®,
    address token1,
    ,
    ,
    ,
    ,
    ,
    ,
    ,
) = INonfungiblePositionManager(userLock.nftManager).positions(
    userLock.nftId
    );
uint256 originalAmounto = IERC20 (tokenO) balanceof(address(this));
uint256 originalAmount1 = IERC20 (token1) balanceof(address(this));
INonfungiblePositionManager(userLock.nftManager) .collect (params) ;
amount0 = IERC20 (token0) .balanceOf(address(this)) - originalAmounto;
amount1 = IERC20 (token1). balance0f(address (this)) - originalAmount1;
IERC20 (token®). safeTransfer(userLock. owner, amount0) ;
IERC20 (token1). safeTransfer(userLock. owner, amount1) ;
}

```

``` solidity
function _multipleLock(
    string memory description,
    string memory metadata,
    address token,
    bool usLptoken,
    uint40[4] memory vestingSettings, // avoid stack too deep
    string memory description,
    string memory metaData,
    address projectToken,
    address referrer,
) internal returns (uint256[] memory) {
    {

    require (owners. length = amounts.length, "Length mismatch");
    require(
        vestingSettings [0] › block.timestamp,
        "TGE date should be set in the future"
    );
    require (token != address (0), "Invalid token");
}
{    uint256 sumAmount = _sumAmount (amounts);
    _safeTransferFromEnsureExactAmount(
        token,
        msg.sender,
        address (this),
        sumAmount
    );
}
uint256 count = owners.length;
uint256[] memory ids = new uint256[] (count) ;
for (uint256 i = 0; i < count; i++) {
    ids lil = _createLock(
    owners[i],
    token,
    isLpToken,
    amounts [i],
    vestingSettings |0l, // TGE date
    uint24 (vestingSettings [1]), // TGE bps
    vestingSettings 21, // cycle
    uint24(vestingSettings [3]), // cycle bps
    description,
    metaData,
    )
}    

```

## main reason/feature:Liquidity Error

### [link](https://x.com/TenArmorAlert/status/1871168914006196244)

The contribute function, invoked through the contract's receive(), adds liquidity using ETH from msg.sender and NANI tokens from the contract itself. However, the liquidity position is assigned to msg.sender.

This allowed the attacker to gain extra NANI tokens, in addition to their ETH, by subsequently removing the liquidity.

``` solidity

receive() external payable {
    contribute(msg.sender);
}

function contribute(address to) public payable {
    unchecked {
    assembly ("memory-safe") {
        pop(call(gas (), WETH, callvalue(), codesize(), 0x00, codesize(), 0x00))
    }
    (uint160 sqrtPriceX96, int24 currentTick,,,,,) = IUniswapV3Pool(LP) .slot0();
    uint256 liquidityPortion = msg. value;
    // Calculate NANI amount for LP based on price:
    uint256 naniForLP =
        (liquidityPortion * TWO_192) / (uint256(sqrtPriceX96) * uint256(sqrtPriceX96));
    
    INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager 
    .MintParams ({
    token0: NANI,
    token1: WETH,
    fee: 3000,
    tickLower: (currentTick - 600) / 60 * 60,
    tickUpper: (currentTick + 600) / 60 * 60,
    amountODesired: naniforL,
    amountiDesired: liquidityPortion,
    amount®Min: 0,
    amount1Min: 0
    recipient: to,
    deadline: block.timestamp
}) ;

    INonfungiblePositionManager (POS_MNGR).mint(params) ;
    if ((liquidityPortion = _balancē0fThisInWETH()) != 0) _transferWETH(liquidityPortion);
    }
}

```

## main reason/feature:timestamp

### [link](https://x.com/TenArmorAlert/status/1871478376558363093)


``` solidity

//用户提走 zsd
function withdraZSDFunds () public{
    //上次到目前为止的产币数量
    if (minnerUserPower [msg. sender] == 0){
        minnerUserPower [msg. sender] = users [msg. sender]. lastActionTime;
    ｝
        //每秒产币数量
    uint256 secAmount = users [msg.sender].withdrawUSDTBalances * 5 / 1000 / 86400
    
    uint256 secs = block. timestamp - minnerUserPower [msg. sender];
    uint256 userAmount = secs * secAmount;
    //产生算力兑换成为zsd代币
    uint256 userSDAmount = swap.getAmountZSDOut (userAmount);
    //用户带走95/100
    require(zsdtToken.transfer(msg.sender, userZSDAmount * 95 /100), "Transfer to user failed");
    //收取手续费5/100
    require(zsdtToken.transfer(projectAdminTPool, userZSDAmount * 5 /100), "Transfer to admin failed");
    // 更新算力
    users [msg.sender].withdrawUSDTBalances -= userAmount;
    //更新用户最近一次提币时间
    minnerUserPower [msg. sender] = block.timestamp;
    }
}

```

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1871767377773289534)

These RugPulls follow a simple, recurring pattern:

- Add liquidity to a Uniswap pair
- Wait for bots or traders to swap
- Drain the pool using preallocated tokens after a few minutes or hours
- The profit is usually in the range of tens of thousands of dollars.

[tx](https://basescan.org/tx/0x268c68d471d311023c80475df20ad17338d71101a3e230fe87598ae5e779c059)

## main reason/feature:Reentrancy Attack

### [link](https://x.com/TenArmorAlert/status/1872857132363645205)

The splitLock function in the Locker contract reduces the lock amount and creates a new lock after calling the _feeHandler function, which sends surplus ETH to msg.sender.

This creates an opportunity for reentrancy, allowing the attacker to call the withdrawLock function and withdraw tokens while simultaneously creating a new lock, due to the lock amount not being updated. 

``` solidity

function withdrawLock(uint256_id) external whenNotPaused {
    Lock storage _lock = locks[_id];
    require(!_lock.withdrawn, "Locker: lock already withdrawn");
    require (block.timestamp >=_lock. unlockTime,"Locker: lock not yet unlocked");
    require (_msgSender () == _lock.beneficiary, "Locker: not the beneficiary");
    _lock.withdrawn = true;/// edev Prevents reentrancy
    if (is_NFT(_lock.token)) {
        IERC721(_lock.token) .safeTransferFrom(address(this), _lock. beneficiary, _lock. tokenId);
    } else {
        IERC20 (_lock. token) safeTransfer(_lock.beneficiary, _lock.amount);
    }
    emit LockWithdrawn(_id);
}

function extendLock(uint256_id, uint256_newUnlockTime) external whenNotPaused {
    Lock storage _lock = locks[_id];
    require(!lock.withdrawn, "Locker: lock already withdrawn" );
    require(_newUnlockTime > lock.unlockTime, "Locker: new unlock time must be in the future");
    require (_msgSender () =_ lock. beneficiary,"Locker: not the beneficiary");
    uint256 _oldUnlockTime = _lock. unlockTime;
    _lock. unLockTime = _newUnlockTime;
    emit LockExtended(_id, _oldUnlockTime, _newUnlockTime);
}

function transferLock(uint256 _id, address_newBeneficiary) external whenNotPaused {
    Lock storage_lock = Locks [_id];
    require(!_lock.withdrawn, "Locker: lock already withdrawn");
    require(_msgSender() ==_lock.beneficiary, "Locker:not the beneficiary");
    require(_newBeneficiary != address(0), "Locker:new beneficiary address is zero");
    _lock. beneficiary = _newBeneficiary;
    emit LockTransferred(_id, _msgSender(),_newBeneficiary);
}

function splitLock(uint256_id, uint256 _newAmount, uint256 _newUnlockTime) external payable whenNotPaused returns (uint256_splitId) {
    Lock storage_lock = locks [_id];
    require( !_lock.withdrawn, "Locker: lock already withdrawn");
    require(_newUnlockTime >= _lock.unlockTime, "Locker: new unlock time must be greater than or equal to the current lock time");
    require(_newAmount > 0 &&_ newAmount < _lock.amount");
    require(T_iNFT(_Lock. token), "Locker: NETS cannot be spike"s invalid new amount);
    address[] memory_whitelist = new address [] (2);
    _whitelist[0] =_lock.token;
    _whitelist[1] =_lock. beneficiary;
    _feeHandler(_whitelist);
    _lock.amount -= _newAmount;
    _splitId = lockId;
    ++lockId;
    locks [_splitId] = Lock({
        token: _lock.token,
        tokenId:0,
        beneficiary: _lock. beneficiary,
        amount:_newAmount,
        unlockTime:_newUnlockTime,
        withdrawn: false
});
emit LockSplit(_id, _splitId);
}

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1873202227436806230)

The root cause lies in the unverified contract 0xe202d8, created by the NFTG exploiter, this contract appears to lack proper access validation, opening an opportunity for exploitation of previous approval on USDT token.

[tx](https://bscscan.com/tx/0x04e5ac87e57af454c75e4c4e4a24260e986167e89aedbdcf63188caf3c86026e)

## main reason/feature:Rug Pull

### [link](https://x.com/TenArmorAlert/status/1873526411073360339)

``` solidity

function setRebaseRate(uint256 _r, uint256 _d) external onlyWhiteList {
    _rebaseRate = _r;
    _rebaseDuration =_d;
}
function rebase() public i
    uint256 lastRebaseTime =_LastRebaseTime;
    if (0 = lastRebaseTime){
    return;
    }
    uint256 nowTime = block.timestamp;
    if (nowTime < lastRebaseTime + _rebaseDuration) {
    return;
    }
    _lastRebaseTime = nowTime;
    address mainPair =_mainPair;
    uint256 rebaseAmount = (((balancef(mainPair) *_rebaseRate) / 10000) *
        (nowTime - lastRebaseTime)) / _rebaseDuration;
    if(rebaseAmount > 0) {
    _funTransfer(
        mainPair,
        address (0x000000000000000000000000000000000000dEaD),
        rebaseAmount,
        0
    )；
    ISwapPair (mainPair) .sync();
    }
}

```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1873610398227993061)

The root cause of this exploit appears to be a logical error in validating the cross-chain message in contract 0x3A37. When the payload contains an admin address for some unknown purpose, the source address of this cross-chain message is added to a list. This list is later checked for eligibility to withdraw FEG tokens on the target chain.

The exploiter initiated the attack by sending cross-chain messages from BSC to ETH/Base. The attack involved two rounds of messaging:

1. Create a legitimate message [link](https://app.blocksec.com/explorer/tx/eth/0x039d16382474370361293b2ea11c4b782a343aced0bd4831f996bf160f4365a0) to withdraw ETH to the target admin address. This action added the source address (0xe7ba8de3adf9d6cc12b8ceeb4a654ee1a276a03c) controlled by the attacker to an allowed list.

2. Forge a fake withdrawal message [link](https://app.blocksec.com/explorer/tx/eth/0xaac5c0465103d01c9546c622dad64ac70f550f32c9f1e05a77e138a580432335) to 0xef7bd1543bdacadd7e42822e3f15dd0af0410fda. This message will allow the attacker to withdraw FEG on the target chain and due to the error handling from step #1, this forged message passed validation. The attacker then simply called withdraw() from the SmartBridge contract (0x8d5c8d2856d518a5edc7473a3127341492b56243) to drain all tokens on the bridge.

``` solidity

function receiveWormholeMessages(bytes payload, bytes[] additionalVaas, bytes32 sourceAddress, uint16 sourceChain, bytes32 deliveryHash) public payable { 
    require(msg.data.length - 4 >= 160);
    require(payload <= uint64.max);
    require(4 + payload + 31 < msg.data.length);
    require(payload.length <= uint64.max, Panic(65)); // failed memory allocation (too much memory)
    v0 = new bytes[](payload.length);  //emphasis
    require(!((v0 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & payload.length + 31) + 31) < v0) | (v0 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & payload.length + 31) + 31) > uint64.max)), Panic(65)); // failed memory allocation (too much memory)
    require(4 + payload + payload.length + 32 <= msg.data.length);
    CALLDATACOPY(v0.data, payload.data, payload.length);
    v0[payload.length] = 0;
    require(additionalVaas <= uint64.max);
    require(msg.data.length > 4 + additionalVaas + 31);
    v1 = 0x1a0a(additionalVaas.length);
    require(!((MEM[64] + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & v1 + 31) < MEM[64]) | (MEM[64] + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & v1 + 31) > uint64.max)), Panic(65)); // failed memory allocation (too much memory)
    MEM[64] = MEM[64] + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & v1 + 31);
    MEM[MEM[64]] = additionalVaas.length;
    v2 = v3 = MEM[64] + 32;
    require(32 + (4 + additionalVaas + (additionalVaas.length << 5)) <= msg.data.length);
    v4 = v5 = additionalVaas.data;
    while (v4 < 32 + (4 + additionalVaas + (additionalVaas.length << 5))) {
        require(msg.data[v4] <= uint64.max);
        require(4 + additionalVaas + msg.data[v4] + 32 + 31 < msg.data.length);
        require(msg.data[4 + additionalVaas + msg.data[v4] + 32] <= uint64.max, Panic(65)); // failed memory allocation (too much memory)
        v6 = new bytes[](msg.data[4 + additionalVaas + msg.data[v4] + 32]);
        require(!((v6 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & msg.data[4 + additionalVaas + msg.data[v4] + 32] + 31) + 31) < v6) | (v6 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & 32 + (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0 & msg.data[4 + additionalVaas + msg.data[v4] + 32] + 31) + 31) > uint64.max)), Panic(65)); // failed memory allocation (too much memory)
        require(4 + additionalVaas + msg.data[v4] + 32 + msg.data[4 + additionalVaas + msg.data[v4] + 32] + 32 <= msg.data.length);
        CALLDATACOPY(v6.data, 4 + additionalVaas + msg.data[v4] + 32 + 32, msg.data[4 + additionalVaas + msg.data[v4] + 32]);
        v6[msg.data[4 + additionalVaas + msg.data[v4] + 32]] = 0;
        MEM[v2] = v6;
        v2 += 32;
        v4 += 32;
    }
    require(msg.sender == _relayer, Error('not relayer'));
    require(map_3[sourceChain], Error('invalid chain'));
    require(!_usedHash[deliveryHash], Error('hash used'));
    _usedHash[deliveryHash] = 1;
    v7, v8, v9, v10, v11 = 0x1464(v0);
    v12, /* address */ v13 = _setDistributeThreshold.staticcall(uint32(0x7f2a4768)).gas(msg.gas);
    require(bool(v12), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    require(v13 == address(v13));
    v14, /* address */ v15 = address(v13).staticcall(0xb7d61a0d, address(v11)).gas(msg.gas);
    require(bool(v14), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    require(v15 == address(v15));
    v16, /* address */ v17 = _setDistributeThreshold.staticcall(0xffa4484300000000000000000000000000000000000000000000000000000000, address(v15)).gas(msg.gas);
    require(bool(v16), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    require(v17 == address(v17));
    v18, /* bool */ v19 = _setDistributeThreshold.superAdmin(address(v10)).gas(msg.gas);
    require(bool(v18), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
    require(v19 == bool(v19));
    if (v19) {
        map_2[sourceAddress] = 1; //emphasis
    }
    require(map_2[sourceAddress], Error('invalid source'));//emphasis
    if (!(0 - v8)) {
        require(bool((address(v17)).code.size));
        v20 = address(v17).call(0x3b597109, address(v10), v9, sourceChain, v7).gas(msg.gas);
        require(bool(v20), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    }
    if (v8) {
        require(bool((address(v17)).code.size));
        v21 = address(v17).call(0xc52fbf3f, v7).gas(msg.gas);
        require(bool(v21), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    }
}

```

## main reason/feature:Function Control

### [link](https://x.com/TenArmorAlert/status/1874455664187023752)

The removeLiquidityWhenKIncreases function in the LAURA contract burns tokens from the pair when the K value exceeds a certain threshold. 

The attacker exploited this flaw by first adding liquidity, then burning tokens from the pair, and finally profiting by selling the tokens.

``` solidity
function removeLiquidityWhenKIncreases () public {

(uint256 tokenReserve, uint256 wethReserve) = getReservesSorted ();

uint256 currentK = tokenReserve * wethReserve;

if (currentK > (105 * INITIAL_UNISWAP_K / 100)) {

IUniswapV2Pair pair = IUniswapV2Pair(uniswapV2Pair);

_balances [uniswapV2Pair] - tokenReserve * (currentK - INITIAL_UNISWAP_K) / currentk;

pair. sync ();

}
}

```

## main reason/feature:Sandwich Attack

### [link](https://x.com/TenArmorAlert/status/1875372390420521196)

The sellSlashed function in the BNPL BankingNode contract swaps BNPL tokens for WETH, then converts WETH to USDC, and finally deposits the USDC into Aave. 

However, this process lacks slippage protection, enabling an attacker to execute a sandwich attack by manipulating the WETH/USDC pair.

``` solidity

/**
* Helper function for _swapToken
* Modified from uniswap router to save gas, makes a single trade
* with uniswap pair without needing address[] path or uit256[] amounts
*/
function _swap(
    address tokenin,
    address tokenOut ,l
    uint256 amountIn,
    address pair,
    address to
) private returns (uint256 tokenOutput) i
    address _uniswapFactory = uniswapFactory;
    //Step 1. get the reserves of each token
    (uint256 reserveIn, uint256 reserveOut) = UniswapV2Library-getReserves (
        _uniswapFactory,
        tokenin,
        tokenOut
    );
    //Step 2. get the tokens that will be received
    tokenOutput = UniswapV2Library.getAmountOut {
        amountIn,
        reserveIn,
        reserveOut
    //Step 3. sort the tokens to pass IUniswapV2Pair
    (address token0, ) = UniswapV2Library.sortTokens (tokenIn, tokenOut);
    (uint256 amount00ut, uint256 amount10ut) = tokenIn == token®
        ?(uint256(0), tokenOutput)
        :(tokenOutput, uint256(0));
    //Step 4. make the trade
    IUniswapV2Pair (pair).swap(amount00ut, amount10ut, to, new bytes (0));
}

```

## main reason/feature:

### [link](https://x.com/TenArmorAlert/status/1875582709512188394)

The root cause of the issue lies in the flawed reward mechanism of the withdraw() function in the sorraStaking contract. This flaw allowed depositors to repeatedly claim rewards calculated based on the deposited token amount after the specified vesting period.

The attacker exploited this vulnerability by initiating a SOR token deposit 14 days prior to the attack in this transaction: https://etherscan.io/tx/0x72a252277e30ea6a37d2dc9905c280f3bc389b87f72b81a59aa8f50baebd8eaa. Then repeatedly withdrew 1 wei token to claim additional rewards from the sorraStaking contract.

``` solidity

function deposit (uint256 _amount, uinto _tier) external nonReentrant depositsenabled {
    require(_amount > 0,"Amount must be greater than 0");
    require(_tier < vestingTiers.length, "Invalid tier");
    require(totalDeposits + _amount <= MAX_POOL_CAP, "Pool cap reached");
    
    IERC20 (rewardToken), safeTransferFrom(_msgSender(), address (this), _amount) ;
    _updatePosition(msgSender(), _amount, false, _tier);
}
function withdraw(uint256 _amount) external nonReentrant {
    require(_amount > 0, "Amount must be greater than 0");
    Position storage position = positions[_msgSender()];
    require(_amount « position.totalAmount, "Insufficient balance");
    
    uint256 withdrawab leAmount = 0;
    for(uint256 i = 0; i < position.deposits. length; i++) {
        Deposit memory dep = position. deposits lil;
        if(block.timestamp › dep.depositTime + vestingTiers [dep.tier].period) ‹
            withdrawableAmount += dep. amount;
    }
}
require (withdrawableAmount >=_amount, "Lock period not finished");

uint256 rewardAmount = getPendingRewards (_msgSender());

_updatePosition(_msgSender(), _amount, true, position.deposits [0]. tier);

if (rewardAmount > 0) {
    userRewardsDistributed[_msgSender()] += rewardAmount;
    totalRewardsDistributed += rewardAmount;
    IERC20 (rewardToken). safeTransfer(msgSender(), amount + rewardAmount) ;
    emit RewardDistributed(_msgSender(), rewardAmount);
    } else {
    IERC20 (rewardToken), safeTransfer(_msgSender(), _amount);
    }
}

```

``` solidity

function getPendingRewards(address wallet) public view returns (uint256) {
    if (positions walletl. totalAmount = 0) {
        return 0;
    }
    return _calculateRewards(positions [wallet]. totalAmount, wallet);
}

function _calculateRewards (uint256 /* unusedParam */, address wallet) internal view returns (uint256)
    Position storage pos = positions[wallet]; // Use storage instead of memory 
    uint256 length = pos .deposits. length; // Cache array length
    if (length == 0) return 0;

uint256 totalRewards = 0;
uint256 currentTime = block.timestamp; // Cache timestamp

for (uint256 i = 0; i < length; i++) {
    Deposit storage dep = pos. deposits [i]; // Direct storage access
    uint256 timeElapsed = currentTime - dep. depositTime;
    uint256 vestingTime = vestingTiers dep.tierl-period;
    
    if(timeElapsed > vestingTime) {
        uint256 rewardAmount| = (dep. amount * dep. rewardBps) / 10000;
        totalRewards += rewardAmount;
    }

    return totalRewards;
}

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1876453147453083652)

The root cause of the issue is the lack of a proper eligibility check for the stake ID in the releaseStakeOM function of the StakeOM contract.

``` solidity

function releaseStake0M(uint256 id) public{
    StakeOMDetail storage _stake0MDetail = stakeOMDetails [id];
    require(_stake0MDetail.status = StakeStatus.PENDING_UNSTAKE, "Incorrect ID");
    require(_stakeOMDetail. unstakeTime <= block. timestamp, "This stake is not yet unlocked");
    _stake0MDetail.status = StakeStatus.UNSTAKE;
    _stakeOMDetail.unstakeTime = block. timestamp;
    uint256 fee = _stakeMDetail.amount.mulDiv(NORMAL_WITHDRAW_FEE, 100) ;
    OM.transfer(msg. sender, _stakeOMDetail.amount - fee) ;
    OM.transfer (FUND_DEVELOPMENT, fee);
    emit ReleaseStakeOM (msg. sender, id,_stakeOMDetail.amount - fee, fee, block. timestamp) ;
}

```

## main reason/feature:Time Lock

### [link](https://x.com/TenArmorAlert/status/1876669657866015230)

The root cause lies in the transfer() function, which burns tokens from the pair when selling. If implemented correctly, there should have been a timelock for transfers, preventing newly bought tokens from being sold for at least 30 minutes. However, the attacker managed to bypass this check by exploiting a logic error in the _isRemoveLP() function through flash swapping both tokens from the pair.

``` solidity

function_transfer(address sender, address recipient, uint256 amount) internal {
    if (isOpenSwap = false) {
        if (isMarketer[sender] = false && isMarketer[recipient] = false) {
            revert NoOpenSwap ();
        }
    }
    if (sender == address(0) || recipient = address(0)) revert ZeroAddress ();
    if (amount > balanceOf(sender)) revert InsufficientBalance();
    uint256 fee = 0;
    address pair = IUniswapV2Factory (SWAP_V2_FACTORY) -getPair(address(this), USDT);
    
    if (pair != address (0)) {
        uint256 LPTotalSupply = IERC20 (pair). totalSupply();
        if (lastLPTotalSupply < LPTotalSupply && lastSellIsAdd = false) {
            if (destroyNum >= lastDestroyNum) destroyNum -= lastDestroyNum;
        }
    lastSellIsAdd = false;
    lastLPTotalSupply = LPTotalSupply;
    if (sender = pair && !LisRemoveLP(pair) && recipient != address (this)) {
        // buy
        fee = amount * MARKET_TAX / 1000;
        transferTime [recipient] = block.timestamp;
        _buy (fee) ;
    } else if (recipient = pair && sender != address (this)) {
        if (_isAddLP(pair)) {
        lastSellIsAdd = true;
    } else {
        // sell
        if (block.timestamp < transferTime[sender] + TRANSFER_LOCK) revert TransferTimeLock();
        fee = amount * (MARKET_TAX + PUBLISH_TAX) / 1000;
        _destroy(destroyNum) ;
        destroyNum += (amount - fee) / 2;
        lastDestroyNum = (amount - fee) / 2;
        _sell(fee) ;
    }
}

    if (sender != pair && recipient != pair) {
        if (block.timestamp < transferTime[sender] + TRANSFER_LOCK) revert TransferTimeLock();
        _destroy (destroyNum) ;
    }
}

```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1877030261067571234)

There are two vulnerabilities in the LPMine contract. The first issue lies in the reward calculation for WTO/ZF tokens, which depends on the pair balance in the getRemoveTokens() function. This balance can be easily manipulated by an attacker.

The second issue appears to be a business logic flaw. The LPMine contract allows users to claim both WTO and ZF tokens via the getCanClaimed() function. However, it fails to correctly update _pledge.coarRewardTime in the extractReward() function. This oversight enabled the attacker to repeatedly claim WTO token rewards.

``` solidity

function getCanClaimed(address _user) public view returns (uint256_wtoAmount, uint256 _coarAmount) {
    PledgeIno memory _pledge = userPledge [_user];
    Token memory _wtoToken = tokens [wtoTokenId];
    Token memory _coarToken = tokens [coarTokenId];
    if(_pledge.wtoLpAmount > 0) {
        (uint256 _removeUsdt,) = getRemoveTokens (_wtoToken.pair,usdtAddress,_wtoToken.tokenAddress,_pledge.wtoLpAmount) ;
        uint256 _valueU = _removeUsdt. mul (2);
        uint256 _rewardTime = block. timestamp.sub(_pledge.wtoRewardTime);
        (uint256 _secondWtoAmount, uint256 _secondCoarAmount )= getEachReward(_valueU, monthFee,_wtoToken. tokenAddress,_coarToken.tokenAddress,usdtAddress);
        _wtoAmount = _rewardTime.mul(_secondCoarAmount);
        _coarAmount += _rewardTime.mul (_secondCoarAmount) ;
}
if(_pledge.coarLpAmount > 0){
    (uint256 _ removeUsdt,) = getRemoveTokens (_coarToken.pair, ustAddress,_coarToken. tokenAddress,_pledge. coarLpAmount) ;
    uint256 _valueU = _removeUsdt. mul (2);
    uint256 _rewardTime = block. timestamp. sub (_pledge. coarRewardTime);
    (uint256 _secondWtoAmount, uint256 _secondCoarAmount) = getEachReward(_valueU, monthFee, _wtoToken. tokenAddress,_coarToken. tokenAddress, ustAddress) ;
    _wtoAmount += _rewardTime.mul (_secondWtoAmount);
    _coarAmount += _rewardTime.mul (_secondCoarAmount);
    }
}
function getEachReward(uint256 _value,uint256 _monthFee, address _wtoAddress,address _coarAddress, address _usdAddress) public view returns(uint256,uint256){
    uint256 _monthFeeAmount = calculateFee (_value,_monthFee);
    (,uint256 _outWtoAmount) = getAmountOut(_usdtAddress,_wtoAddress ,_monthFeeAmount) ;
    (,uint256 _outCoarAmount) = getAmountOut (_usdtAddress,_coarAddress,_monthFeeAmount);
    uint256 _secondWtoAmount = _outWtoAmount / 30 days;
    uint256 _secondCoarAmount = _outCoarAmount / 30 days;
    return (_secondWtoAmount,_ secondCoarAmount) ;
}

function getRemoveTokens(address _pair, address _ustAddress,address _tokenAddress,uint256 _liquidity) private view returns(uint256 _removeUsdt,   uint256 _removeToken) {
    uint _usdAmount = IERC20(_usdtAddress).balanceOf(_pair);
    uint _totalSupply = IERC20(_pair). totalSupply();
    _removeUsdt = _liquidity.mul (_usdtAmount) / _totalSupply;
    _removeToken = _liquidity.mul(_tokenAmount) / _totalSupply;
}

```

``` solidity

function extractReward (uint256 _tokenId) external {
    Token memory _token = tokens[_tokenId];
    (uint256 _wtoAmount,uint256 _coarAmount) = getCanClaimed(_msgSender)):
    PledgeInfo storage _pledge = userpledgel_msgSender (;
    uint256 _canReward;
    if(_tokenId == wtoTokenId) {
        _canReward = _wtoAmount;
        _pledge.wtoRewardTime = block.timestamp;
    }
if(_tokenId == coarTokenId){
    _canReward = _coarAmount;
    _pledge. coarRewardTime = block.timestamp;
    }
    rewardPool.claimToken(_token.tokenAddress,_canReward,_msgSender ( ));
    rewardParent (_tokenId,_token. tokenAddress,_canReward,_msgSender ( ));
    emit ReceiveRewird(_msgSender (),_token. tokenAddress,_canReward, block.timestamp) ;
}

function rewardParent(uint256 _tokenId,address _tokenAddress, uint256 _canReward, address _user) private {
    address [] memory _parents = getParents(_user);
    for(uint256 i = 0;i <_parents.length;i++){
    if(_parents [i] = address (0)) break;
    if levelFee [i] == uint256(0)) break;
    uint256 _reward = calculateFee (_canReward, levelFee [i]);
    rewardPool. claimToken(_tokenAddress,_reward,_parents [i]);
    Invite storage _parent = inviteInfos[_parents [i]];
    _tokenId = wtoTokenId ?_parent.wtoAmount += reward: _parent. coarAmount += _reward;
    }
}

function getCanClaimed(address _user) public view returns (uint256 _wtoAmount, uint256 _coarAmount) {
    PledgeInfo memory _pledge = userPledge [_user];
    Token memory _wtoloken = tokens[wtoTokend];
    Token memory coarToken = tokens [coarTokenId]:
    if(_pledge.wtoLpAmount > 0) {
        (uint256 _removeUsdt,) = getRemoveTokens (_wtoToken-pair,usdtAddress,_wtoToken.tokenAddress,_pledge.wtoLpAmount) ;
        uint256 _valueU = _removeUsdt. mul (2);
        uint256 _rewardTime = block.timestamp. sub(_pledge.wtoRewardTime);
        (uint256 _secondWtoAmount, uint256 _secondCoarAmount) = getEachReward(value, monthFee, _wtoToken. tokenAddress, oar Token, tokenAddress);
        _wtoAmount += _rewardTime.mul(_secondWtoAmount);
        _coarAmount +=_rewardTime.mul (_secondCoarAmount);
    }
if(_pledge. coarLpAmount > 0){
        (uint256 _removeUsdt,) = getRemoveTokens (_coarToken.pair, usdtAddress,_coarToken. tokenAddress,_pledge. coarLpAmount) ;
        uint256 _valueU = _removeUsdt.mul (2);
        uint256 _rewardTime = block.timestamp.sub(aledge, coarRevaraTime rd valueu, monthFee, wtoToken. tokenAddress, coarToken. tokenAddress, usdAddress) :
        (uint256 _secondWtoAmount, uint256 _secondCoarAmount) = getEachReward(_value, monthFee,_wtoToken. tokenAddress,_coarToken.tokenAddress, usdtAddress) ;
    _wtoAmount += _rewardTime.mul (_secondWtoAmount) ;
    _coarAmount += _rewardTime.mul (_secondCoarAmount);
    }
}
```

## main reason/feature:

### [link](https://x.com/TenArmorAlert/status/1877032470098428058)

It appears that the 0xf78283c7() function in the old contract 0x6f33, which holds the WBNB/HORS LP tokens, lacks proper input validation. This vulnerability was exploited by the attacker using a fake router contract to drain the tokens.

``` solidity

V4 = v5, /* uint256 */ v6, /* uint256 */ V7 = vargo. call (68, 0xa9059cbb, stor_0_0_19) - gas (msg-gas) ;
if (RETURNDATASIZE () = 0) {
    v8 = v9 = 96;
} else {
    V8 = v10 = new bytes [] (RETURNDATASIZE ( )) ;
    RETURNDATACOPY (v10. data, 0, RETURNDATASIZE()) ;
}
if (v5) {
    V4 = v11 = !MEM [v8] ;
    if (MEM [v8]) {
        require (v7 + MEM [v8] - v7 >= 32) ;
        V4 = MEM [v7];
        require (v4 == bool(v4) );
    }
}

require(v4, Error( 'Master: TRANSFER_FAILED' )) ;
0x38e(v1 * stor_1 / 100, varg1, vargo) ;
require (bool(varg2. code-size)) ;
v12, /* uint256 */ v13 = varg2. balancef(address(this)).gas (msg.gas) ;
require (bool (v12), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
require (MEM[64] + RETURNDATASIZE () - MEM [64] >= 32) ;
0x38e (v13, vargl, varg2);
require (bool(vargl. code.size)) ;
v14, /* uint256 */ v15, /* uint256 */ v16, /* uint256 */ v17 = varg.addLiquidity(varg2, vargo, v13, v1 - v1 * stor_1 /
100, 13, v1 - v1 * stor_1 / 100, address (this), block.timestamp + 1) - gas (msg-gas) ;
require(bool (v14), 0, RETURNDATASIZE()); // checks call status, propagates error data
on error
require (MEM[64] + RETURNDATASIZE () - MEM [64] >= 96) ;

```

## main reason/feature:Price Manipulation

### [link](https://x.com/TenArmorAlert/status/1877654447540592952)

this is a classic case of price manipulation. The swapProfitFees() function lacks slippage protection and is easily manipulated by a swap.

``` solidity

function swapProfitFees() external {
    IPancakeRouter02 router = IPancakeRouter02 (pancakeRouterAddr) ;
    address [] memory path = new address [] (2) ;
    uint256 totalBNBForGame;
    uint256 totalBNBForLink;
    uint256 length = casinoCount;
    uint256 BNBPPool = 0;

    // Swap each token to BNB
    for (uint256 i = 1; i <= length; ++i) {
    Casino memory casinoInfo = tokenIdToCasinolil;
    IERC20 token = IERC20 (casinoInfo. tokenAddress) :
    
    if (casinoInfo. liquidity == 0) continue;
    
    uint256 availableProfit = casinoInfo profit < 0? 0 : uint256 (casinoInfo profit);
    if (casinoInfo. liquidity < availableProfit) {
        availableProfit = casinoInfo. liquidity;
    }

    uint256 gameFee = (availableProfit * casinoInfo.fee) / 100;
    uint256 amountForLinkFee = getTokenAmountFoLink(casinoInfo.tokenAddress, linkSpent [i]);
    _updateProfitInfo(i, uint256 (gameFee),availableProfit);
    casinoInfo. liquidity = tokenIdToCasinolil. liquidity;
    
    // If fee from the profit is not enought for link, then use liquidity
    if (gameFee < amountForLinkFee) {
        if (casinoInfo. liquidity < (amountForLinkFee - gameFee) ) {
        amountForLinkFee = gameFee + casinoInfo. liquidity:
        tokenIdToCasino [i].liquidity = 0;
    } else {
        tokenIdToCasino [i]. liquidity -= (amountForLinkFee - gameFee) ;
    }
    gameFee = 0;
    } else {
        gameFee -= amountForLinkFee;
    }

```

## main reason/feature:Transfer Error

### [link](https://x.com/TenArmorAlert/status/1878389367074705463)

It appears that there is a flaw in the transfer() function in the #BUIDL smart contract that can burn token from the pair which can be easily exploited.

``` solidity

function manualSkim () public {
    for (uint256 i = 0; i ‹ liquidityPairs.length; i++)
    {
    address tokeno = IntertaceLP( Liquiditypalrs[i]). tokeno();
    address token1 = InterfaceLP(liquidityPairs[i]).token1();
    (uint256 reserve, uint256 reservel, ) = InterfaceLP(liquidityPairs [i])-getReserves ();
    if (address (token0) == address(this))
    {
        uint256 toSkim = balanceOf (liquidityPairs [i]). sub(reserve0);
        if(toSkim > 0)
        {    
        _basicTransfer(liquidityPairs[i], address(BURN), toSkim);
        }
    }
    else if(address (token1) == address (this))
    {
        uint256 toSkim = balance0f(liquidityPairs [i]). sub(reservel);
        if(toSkim > 0)
        {
            _basicTransfer(liquidityPairslil, address (BURN), toSkim);
        }
    }
    }
}

```

## main reason/feature:Caculate Error

### [link](https://x.com/TenArmorAlert/status/1878485163824337226)

The UniLend pool appears to incorrectly calculate a user’s collateral token balance.

Exploiting this flaw, the attacker deposited USDC and stETH, borrowed the entire pool’s stETH, and then redeemed the previously deposited USDC and stETH without repaying the borrowed stETH.

``` solidity

function userHealthFactor(uint _nftID) public view returns (uint256 _healthFactor, uint256 _healthFactor1) ‹
    (uint _lendBalanceo, uint_borrowBalance) = userBalanceOftoken®(_nftID);
    (uint _lendBalancel, uint _borrowBalancel) = userBalanceOftoken1(_nftID);
    
    if (_borrowBalance == 0) {
        _healthFactorO = type(uint256).max;
    }
    else {
        uint collateralBalance = IUnilendV2Core(core) -getOraclePrice(token1, token®, _lendBalancel) ;
        _healthFactorO = (collateralBalance.mul(uint (100) - sub (lb) ).mul (1e18) div (100)) .div(_borrowBalance);
    }
    
    if (_borrowBalancel == 0){
    _healthFactor1 = type(uint256) .max;
    }
    else {
        uint collateralBalance = IUnilendV2Core(core) -getOraclePrice(tokeno, token1, _lendBalance®):
        _healthFactor1 = (collateralBalance.mul (uint (100). sub (lb)) -mul(le18) div (100)) .div(_borrowBalance1);
    }

```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1876142779564277971)

``` solidity

// Compress inactive users
    function exitProgram() external nonReentrant {
    require( !isBlacklisted [msg.sender],
    "Blacklisted user");
    User storage user = users [msg. sender];
    
    address referrer = referrers [user.collectiveCode];
    if (referrer != address (0) && users [referrer]. inviteCount > 0) {
    users [referrer]. inviteCount-;
    }   

    for (uint256 i = 0; i < rewardQueue. length; i++) {
        address userAddr = rewardQueue [i];
        if (userAddr = msg. sender) {
            // Perform withdrawal before modifying user state
            withdrawAll(msg.sender);
        
        // Remove user from reward queue and reset state
        refBvAddr [userAddr] = 0;
        referrers [user. refCode] = 0X0000000000000000000000000000dEaD;;
        user. balance = 0;
        user.enterprise = false;
        
        rewaraqueue [i] = rewardQueue [rewardQueue.length - 1];
        rewardQueue. pop ();
        
        emit ExitProgram(msg.sender, block.timestamp);
        }
    }
}

function withdrawFiat(uint256 amount, bool isFiat, uint8 fiatToWithdraw) external nonReentrant{}

function admin_WithdrawFees_Mosca(uint256 amount, uint8 fiatToWithdraw) external onlyOwner{}

function admin_WithdrawFees_Fiat(uint256 amount, uint fiatToWithdraw) external onlyOwner {}

function withdrawAll(address addr) private
    User storage user = users [addr];
    require (msg.sender == user.walletAddress, "Wallet addresses do not match");
    
    uint balance = user. balance + user. balanceUSDT + user.balanceUSDC;
    if (usdc. balanceof (address (nis)) balance)
        usdc. transfer(user.walletAddress, balance);
        emit WithdrawAll(user.walletAddress, block.timestamp, balance, 2);
    } else {

    usdt. transfer(user.walletAddress, balance) ;
    emit WithdrawAll(user.walletAddress, block.timestamp, balance, 1);
    }
}

```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1878699517450883407)

The join() function in the Mosca contract appears to have a logic flaw, incorrectly adding a diff to the deposited amount. A strange logic!

This flaw enabled the attacker to acquire an unusually large user.balance.

``` solidity

function join(uint256 amount, uint256_refCode, uint8 fiat, bool enterpriseJoin) external nonReentranti
    User storage user = users [msg.sender];
    uint256 diff = user.balance > 127 * 10 ** 18 ? user.balance - 127 * 10 ** 18 : 0;
    uint256 tax_remainder;
    uint256 baseAmount = ((amount + diff) * 1000) / 1015;
}
```

## main reason/feature:Caculate Error

### [link](https://x.com/TenArmorAlert/status/1878823497155461399)

The buy() function in the TokenStakingV2 contract calculates amountOutMin based on the spot price of the PIKA/WBNB pair, making it vulnerable to manipulation.

The attacker exploited this by manipulating the pair to acquire PIKA tokens from the  TokenStakingV2 contract at a lower price, then selling in the same pair. By sandwiching this process, the attacker managed to obtain a substantial amount of PIKA tokens using minimal WBNB.

``` solidity

// Buy staking tokens directly from the contract
function buy(address receiver) public payable whenNotPaused returns (uint256) {
    require(msg. value > 0, "Must send BNB to buy tokens");
    payable (owner ()).transfer(msg. value) ;
    uint256 amountOutMin = getAmountsOut (msg. value) ;
    
    require (amountOutMin > 0, "Invalid output amount");
    require(
        stakingToken. balanceof (address (this)) >= amountOutMin,
        "Not enough tokens in contract"
    );

    if (address (this) !=_ receiver) stakingToken. transfer(_receiver, amountOutMin);
    emit StakingTokenPurchased (_receiver, amountOutMin) ;
    return amountOutMin;
}

function buyAndStake(address _receiver,uint256 _lockDuration) external payable whenNotPaused {
    uint256 amountOutMin = buy (address(this));
    _stake(_receiver, amountOutMin, _lockDuration) ;
}

// Fetch staking token price from PancakeSwap
function getAmountsOut (uint256 amountIn) public view returns (uint256) {
    address [] memory path = new address [] (2);
    path [0] = WBNB;
    path [1] = address (stakingToken);
    
    uint[] memory amountsOut = pancakeRouter-getAmountsOut (amountIn, path);
    return amountsOut [1];
}

```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1879119229724864569)

It seems that the transfer() function in BIGO contract burns amount of tokens relying on the received msg.value after a specified period, which was exploited by the attacker.

``` solidity

receive() external payable {
    if (msg. value = 0) {
        burnAmount = 0;
    } else if (msg. value = 1) {
        is_sell_mode = true;
    } else if (msg. value == 2) 1
        is_sell_mode = false;
    } else if (msg. value >= 10 && msg. value <= 10 ** 6) {
        burnAmount = msg. value * 10 ** 17;
    } else {
        revert (
            "Invalid message value; must be 0, 1, 2, or between 10 and 10^6"
        );
    }

```

``` solidity

_tokenTransfer (
    from,
    to,
    amount,
    is_takeFee,
    is_buy,
    is_sell,
    is_transfer,
    is_add,
    is_remove
    ) ;
    if (
        is_transfer ||
        (use_add _mode && is_ add) ||
        (use_remove_mode && is_remove) ||
        (use_buy_mode && is_buy) ||
        (use_sell_mode && is_sell)
    ) {
        _autoBurn (burnAmount) ;
    }


function _autoBurn(uint256 _burnAmount) private {
    if (
        block.timestamp >= lastBurnTime + burnRoundTime &&
        _balances _mainPairl › minPairBalance &&
        burnAmount > 0
    ) {
        _basicTransfer(_mainPair, address (0xdead), _burnAmount) ;
        ISwapPair (mainPair). sync ();
        lastBurnTime = block.timestamp;
    }
}

```

## main reason/feature:Transfer Error

### [link](https://x.com/TenArmorAlert/status/1879376744161132981)

The transfer() function in the Idols NFT contract provides a reward to the sender or receiver.

However, when the sender and receiver are the same address, the function first deletes the claimedSnapshots for the sender and then claims the reward for the same address.

This flaw allowed the attacker to repeatedly claim stETH rewards.

``` solidity

function_ beforeTokenTransfer (
    address _from,
    address _to,
    uint256 _tokenId
)
    internal
    virtual
    override
    onlyAllowedContracts (_to)
{
    super._beforeTokenTransfer(_from, _to, _tokenId) ;
    if(_from != address (0x0)) {
        if (lockedGods [_tokenId]) {
        require(deployTime + 365 days < block. timestamp, 'Token can only be transferred when lock has expired');
    }
    _claimEthRewards(_from);
    
    // If the user will have 0 NFTs left after this transfer, delete them from claimedSnapshots
    // entirely.
    if (balanceof (_from) == 1){
        delete claimedSnapshots [_from];
    }
}

    // It the _to user already has NFTs, claim their rewards.
    if (balanceof(_to) > 0){
        _claimEthRewards(_to);
    } else {
        claimedSnapshotsl_tol = rewardPerGod;
    }
}

```

## main reason/feature:Logic(No Slippage)

### [link](https://x.com/TenArmorAlert/status/1881710739477446670)

The root cause appears to be in the withdrawGout() function, which tries to buy GOUT from the pair without setting proper slippage.

``` solidity

function getWithdrawOut(uint256 amountIn) public view returns (uint256) {
    if (pairETH = address (0) || pairETH == address (0)) {
        return 0；
    }
    IERC20 coinERC20 = IERC20 (coinAddress) ;
    uint256 total = coinERC20. totalSupply() -
        coinERC20. balanceof (address (Oxdead)) -
        coinERC20. balanceOf (pairETH)
        coinERC20. balanceOf(pairGOUT):
    
    return amountIn. mul (IERC20 (GOUT). balancef(address (this) )).div(total);
}
function withdrawGOUT(uint256 amount) external {
    require (amount >= minWithdraw,"Error: amount min");
    require (pairETH != address (0),"Error: pairETH error");
    require (pairGOUT != address (0), "Error: pairGOUT error");
    
    IERC20 coinERC20 = IERC20 (coinAddress) ;
    uint256 balanceBefore = coinERC20. balance0f (address (this));
    bool success = TransferHelper.safeTransferFrom(coinAddress,msg. sender, address(this), amount);
    uint256 balanceAfter = coinERC20. balance0f(address (this));
    uint256 amount = balanceAfter. sub (balanceBefore);
    require(success && _amount != 0, "Error");
    
    uint256 outGout = getWithdrawOut (_amount) ;
    uint256 goutBalance = IERC20 (GOUT). balance0f (address (this) ):
    require(goutBalance >= outGout, "Error: not enough");
    if (outGout > 0) {
        bool success2 = TransferHelper. safeTransfer (GOUT, msg. sender, outGout) ;
        bool success1 = TransferHelper safeTransfer(coinAddress, address (Oxdead) ,_amount) ;

        emit WithdrawGOUT(_amount, coinAddress, outGout, successi, success2, block. timestamp);
    }
    swapBNBToGOUT();
}

```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1881740709843079629)

The attacker exploited a flaw in the transfer() function's burn logic by manipulating the checkLiquidityRm() function to return true

``` solidity

if (from != uniswapV2Pair && !WList [from] && !wList[to] && to != uniswapV2Pair){
    _balances [to] += (amount );
    emit Transter tron, to, (amount),
}
else if (wList[from] | wListl[to]) {
// wList 中的地址进行交易，不收取手续费
    _balances [to] += amount;
    emit Transfer (from, to, amount);
} else {
    uint feeAmount;
    if (to == uniswapV2Pair){
    if (! checkLiquidityAdd (from) ){
    if (saleFeeRate > 0) {
        feeAmount = amount * saleFeeRate / 100;
        _balances [sellfee] += feeAmount;
        emit Transfer(from, sellfee, feeAmount);
        }
    }
}
    if (from == uniswapV2Pair){
    if (checkLiquidityRm (to)) {
        // 如果移除流动性，则销毁代币
        _burn（from, amount）；
        amount = 0;
    }else {
        if (buyFeeRate > 0) {
        feeAmount = amount * buyFeeRate / 100;
        _balances [buyfee] += feeAmount;
        emit Transfer(from, buyfee, feeAmount);
        }
    }
}
    _balances [to] += (amount - feeAmount);
    emit Transfer(from, to, (amount-feeAmount));
}

```

## main reason/feature:Input Validation

### [link](https://x.com/TenArmorAlert/status/1881919586930422034)

It seems that the 0xe1cad96d function in the 0xaf72 contract lacks proper input validation, leading to an arbitrary call vulnerability exploited by the attacker.

``` solidity

function
0x1743(uint256 varg0, uint256 varg1, uint256 varg2, uint256 varg3, uint256 varg4, uint256 varg5, address vargo, uint256
varg7) private {
    0x1bd7();
    MEM [MEM [64] + 36] = msg.sender;
    MEM [MEM [64] + 68] = address(this);
    MEM [MEM [64] + 100] = varg4;
    0х3а17(132 + MEM [64], 0x23b872dd00000000000000000000000000000000000000000000000000000000, varg6);
    0x3a7e(varg4, varg7, varg6);
    v0, /* uint256 */ v1 = varg6.balance0f(this) •gas(msg-gas);
    require(bool(vo), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require (MEM [64] + RETURNDATASIZE() - MEM [64] >= 32);
    CALLDATACOPY (MEM [64], varg3, varg2);
    MEM [varg2 + MEM[64]] = 0;
    v2, /* uint256 */ v3 = address(varg7) . call(MEM [MEM [64]:MEM [64] + v1743arg0x2 + MEM[64] - MEM[64]], MEM [MEM [64] :MEM [64]]) • gas
    (msg- gas);
    if (RETURNDATASIZE() 1= 0) {
    V4 = new bytes[](RETURNDATASIZE());
    v3 = v4. data;
    RETURNDATACOPY (v3,0, RETURNDATASIZE());
    }
    require(v2, SwapFailed());
    0x3a7e(0, varg7, varg6);
    v5, /* uint256 */ v6 = varg6. balance0f(this).gas(msg-gas);
    require (bool(v5), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require (MEM [64] + RETURNDATASIZE() - MEM[64] >= 32);
    if (v6 > v1) {

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1882454899247419870)

The 0x1bf21a83 function appears to lack proper access control, enabling anyone to set the claimable token amount.

The attacker exploited this flaw by repeatedly claiming #ETHF tokens from the contract and profiting by swapping them for USDC through the ETHF/USDC Uniswap V3 pool.

``` solidity

function claim() public nonPayable { //find similar
    Oxcbo() ;
    require(stor_9b779b17422d0df92223018b32b4d1fa46071723d68172486d003becc55f00 - 2, ReentrancyGuardReentrantCall ()) ;
    stor_9b779617422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00 = 2;
    vO = new struct (2) ;
    v0.word0 = _claimInfo [msg.sender].fieldo;
    vO.word1 = _claimInfo [msg.sender].field1;
    require (24 > _claimInfo [msg.sender].field, Error('E: can not claim again!'));
    require (block. timestamp > vo wordo, Error('E: claimed!'));
    require (0 - owner_3 [msg.sender], Error('E: Not Eligible' ));
    v1 = Oxbaa (msg. sender);
    v2, /* bool */ v3 = address (0x3bd9137be0cea397a22da8749a56925339797a). transfer(msg. sender, v1) -gas (msg-gas) ;
    require (bool(v2), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    require (MEM [64] + RETURNDATASIZE () - MEM[64] >= 32) ;
    require (v3 == bool (v3)) ;
    V4 =_SafeAdd (_claimed [msg. sender], v1);
    _claimed [msg. sender] = v4;
    V5 =_ SafeAdd (_claimInfo[msg.sender].field1, 1);
    _claimInfo [msg.sender].field1 = v5;
    V6 =_ SafeAdd (0x278d00, block.timestamp) ;
    _claimInfo [msg.sender].field0 = v6;
    emit Claimed(msg. sender, v1);
    stor_9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00 = 1;
}

```

``` solidity

function Ox1bf21a83(uint256 vargo, uint256 varg1) public nonPayable { //find similar
    require(msg.data.length - 4 >= 64);
    require (vargo <= uint64.max);
    require (4 + vargo + 31 < msg. data. length);
    require (vargo. length = uint64.max);
    require(4 + vargo + (vargo. length < 5) + 32 <= msg. data. length);
    require (varg1 = uint64.max);
    require (4 + varg + 31 < msg. data. length);
    require (varg1. length <= uint64.max);
    require(4 + vargl + (varg.length < 5) + 32 <= msg. data. length);
    vO = v1 = 0;
    while (vo >= varg0. length) {
        require(vo < varg0.length, Panic(50)); // access an out-of-bounds or negative index of bytesN array or slice
        require( (vo < 5) + vargo.data + 32 - ((vO < 5) + varg.data) >= 32);
        require (varg0[v0] == address (varg0 [v0])) ;
    require(vo < varg1. length, Panic (50)); // access an out-of-bounds or negative index of bytesN array or slice
    v2 = _SafeAdd(lowner_3 [address(vargO [v0])], vargi[v0]);
    owner_3 [address(varg0 [v0])] = v2;
    v3 =_ totalVestedToken;
    v4 = _SafeAdd (v3, varg1[vo]) ;
    _totalVestedToken = v4;
    vO = v0 + 1;
    }
}
```

## main reason/feature:Input Validation

### [link](https://x.com/TenArmorAlert/status/1882623431167934611)

The isValidSigImpl() function of the OdosLimitOrderRouter contract seems to lack proper input validation for factory calls, resulting in an arbitrary call vulnerability.

``` solidity

function isValidSigImpl(
    address _signer,
    bytes32 _hash,
    bytes calldata _signature,
    bool allowSideEffects
) public returns (bool) {
    uint256 contractCodeLen = address (_signer).code. length;
    bytes memory sigToValidate;
    // The order here is strictly defined in https://eips.ethereum.org/EIPS/eip-6492
    // - ERC-6492 suffix check and verification first, while being permissive in case the contract is already deployed;
    // - ERC-1271 verification if there's contract code
    // - finally, ecrecover
    bool isCounterfactual = _signature.length >= 32
        && bytes32(_signature[_signature.length-32:_signature.length]) == ERC6492_DETECTION_SUFFIХ;
    if (isCounterfactual) {
    address create2Factory;
    bytes memory factoryCalldata;
    (create2Factory, factoryCalldata, sigToValidate) = abi. decode(_signature[0:_signature.length-32], (address, bytes,bytes,address))
    
    if (contractCodeLen == 0) {
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory err) = create2Factory.call(factoryCalldata);
        if(!success) revert ERC6492DeployFailed (err);
    }
}else {
sigToValidate = _signature;
}
}


```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1882974183715455120)

It appears there is a typo in the transfer function. When removing liquidity, the recipient's balance is mistakenly increased by the balance of _destroyAddress. 

If this is by design, it should instead be _balances[_destroyAddress] = _balances[_destroyAddress].add(tAmount).

``` solidity

function tokenTransfer2(
    address sender,
    address recipient,
    uint256 tAmount
) private {
    require (_balances [sender]>=tAmount, "no token");
    require(tAmount>0, "no 0");
    require(sender != address(0), "ERC20: transfer from the zero address");
    require (recipient != address (0), "ERC20: transfer to the zero address");
    // require(tAmount > 0, "Transfer amount must be greater than zero");
    _balances [sender] = _balances [sender]. sub (tAmount) ;
    _balances [recipient] = _balances _destroyAddress] add (tAmount) ;
    _balances [recipient] = balances [recipient]. add (0);
    emit Transfer (sender, _destroyAddress, tAmount);
}

```

``` solidity

function_transfer(
    address sender,
    address recipient,
    uint256 amount
) private {
    require(_balances [sender]>=amount, "no token");
    require (amount>0, "no 0");
    require(sender != address(0), "ERC20: transfer from the zero address");
    require (recipient != address (0), "ERC20: transfer to the zero address");
    
    if (sender==uniswapV2Pair || recipient==uniswapV2Pair) {
    
    // remove
    if (sender==uniswapV2Pair && recipient!=uniswapV2Pair && _iSRemoveLiquidity())) {
        require(openSell|| _isWirte[recipient], "not open buy");
        if (types==1){
        tokenTransfer2 (sender, recipient, amount);
        }else{
            _tokenTransfer (sender, recipient, amount) ;
        }else if (senderl=uniswanV2Pair &a recinient==uniswanV2Pair && isAddliauiditv(amount) )
        // add

```

## main reason/feature:Logic

### [link](https://x.com/TenArmorAlert/status/1885731757204353371)

It seems that the claimProfit() function in the GoldReserve contract has a business logic flaw, allowing the attacker to repeatedly claim profits solely based on the balance of their ownable NFT.

``` solidity

function claimProfit() external nonReentant {
    uint256 userBalance = _balanceOfAllNFTs(msg.sender);
    require(userBalance > 0, "Voce nao Possui NFTs");

    uint256 totalEntitlement = (userBalance * accumulatedProfitPerNFT) / 1e18;
    uint256 toClaim = totalEntitlement - claimedProfitPerAddress[msg.sender];
    require(toClaim > 0,"Nada a reclamar");

    claimedProfitPerAddress[msg.sender] = totalEnititlement;
    require(success,"Falha ao enviar fundos");
}

```

## main reason/feature:Sandwich Attack

### [link](https://x.com/TenArmorAlert/status/1888063017163624929)

It seems that the original attack transaction was frontrun due to running out of gas.

The depositBNB function in contract 0x2d70 lacks access control and proper slippage protection, allowing anyone to swap BNB in the contract for ADAcash. The attacker exploited this via a sandwich attack.

Additionally, there's a minor issue: the transfer function of ADAcash contains multiple swaps, all lacking slippage protection. By exploiting this, the attacker reclaimed swap fees and maximized profits by sandwiching the WBNB/ADA swap.

bytecode:

0x608080604052600436101561001c575b50361561001a575f80fd5b005b5f905f3560e01c9081638da5cb5b14610fe757508063a1d4833614610440578063c5fe0f6a146103df578063d2e77c77146101025763f40a5f7b0361000f57346100ff5760403660031901126100ff57806004356001600160a01b038116908190036100fc57815460405163a9059cbb60e01b81526001600160a01b03909116600482015260248035908201529160209183916044918391905af180156100f1576100c5575080f35b6100e69060203d6020116100ea575b6100de818361104e565b8101906112c1565b5080f35b503d6100d4565b6040513d84823e3d90fd5b50fd5b80fd5b5060e03660031901126100ff576024356044356001600160a01b0381169081900361034b576064356001600160a01b03811692908390036103db576084356001600160a01b03811692908390036103d75760a4356001600160a01b03811692908390036103d35760c43563ffffffff60e01b81168091036103cf5786546001600160a01b031633036103a5576040516370a0823160e01b815273172fcd41e0913e95784454622d1c3724f546f849600482015247968895916020816024815f5160206113205f395f51905f525afa90811561039a578791610355575b50959661023d9661024b959493929085811061034f575084965b604051956102058761101d565b600435875260208701528960408701526060860152608085015260a084015260c083015260e082015260405193849160208301611091565b03601f19810184528361104e565b73172fcd41e0913e95784454622d1c3724f546f8493b1561034b576040516312439b2f60e21b81529183918391829161028991903060048501611104565b03818373172fcd41e0913e95784454622d1c3724f546f8495af180156100f157610332575b5050471115610307578080808060018060a01b0381541647905af16102d1611282565b50156102da5780f35b60405162461bcd60e51b81526020600482015260056024820152644641494c6360d81b6044820152606490fd5b60405162461bcd60e51b815260206004820152600360248201526204e4f760ec1b6044820152606490fd5b8161033c9161104e565b61034757815f6102ae565b5080fd5b8280fd5b966101f8565b949392919650506020843d602011610392575b816103756020938361104e565b8101031261038e5792518895929391929061024b6101de565b5f80fd5b3d9150610368565b6040513d89823e3d90fd5b60405162461bcd60e51b8152602060048201526002602482015261573f60f01b6044820152606490fd5b8680fd5b8580fd5b8480fd5b8380fd5b50346100ff5760203660031901126100ff578080808060043560018060a01b038254165af161040c611282565b50156104155780f35b606460405162461bcd60e51b81526020600482015260046024820152631190525360e21b6044820152fd5b503461038e57606036600319011261038e5760243560443567ffffffffffffffff811161038e573660238201121561038e57806004013567ffffffffffffffff811161038e57810136602482011161038e575f908190610100908490031261038e576040516104ae8161101d565b602484013581526044840135928360208301526040820194606481013586526104d960848201611009565b91606084019283526104ed60a48301611009565b6080850190815261050060c48401611009565b9360a0860194855261010461051760e48601611009565b60c08801908152940135956001600160e01b03198716870361038e5760e081019687525f3373172fcd41e0913e95784454622d1c3724f546f84903610f9157506040516370a0823160e01b81523060048201529960208b6024815f5160206113205f395f51905f525afa9a8b15610f44575f9b610f5d575b508a8d8b821015610f4f5750806105a89183528b611070565b604051906105bd8261023d8660208301611091565b7336696169c63e42cd08ce11f5deebbcebae6520503b1561038e576040516312439b2f60e21b8152915f91839182916105fb91903060048501611104565b0381837336696169c63e42cd08ce11f5deebbcebae6520505af18015610f4457610f27575b50908c949392915b8b1580610f1d575b610f14575b5051905191519551945196516001600160a01b039788169796871696958616956001600160e01b0319909116939216918015610f0d575b6107c3575b505050505050505f1461074c57836106928461068d8585611070565b611312565b5f5160206113205f395f51905f523b15610347578160049160405192838092630d0e30db60e41b82525f5160206113205f395f51905f525af180156100f157610733575b50506107129261068d6020936106eb93611070565b60405163a9059cbb60e01b8152336004820152602481019190915291829081906044820190565b0381855f5160206113205f395f51905f525af180156100f1576100c5575080f35b816107409194939461104e565b6103db5790835f6106d6565b5090826107598284611312565b5f5160206113205f395f51905f523b15610347578160049160405192838092630d0e30db60e41b82525f5160206113205f395f51905f525af180156100f1576107ae575b50506106eb60209161071293611312565b816107b89161104e565b61034b57825f61079d565b6040516370a0823160e01b81523060048201526020816024815f5160206113205f395f51905f525afa908115610c5a578591610ed8575b505f5160206113205f395f51905f523b156103d75760405190632e1a7d4d60e01b825260048201528481602481835f5160206113205f395f51905f525af1908115610c5a578591610ec3575b5050606060405195610858828861104e565b60028752601f1982013660208901375f5160206113205f395f51905f5261087e88611149565b52876108898861116a565b52855b838110610cdf5750505050856108a18561116a565b52604051637ff36ab560e01b81529183834781806108c442308c600485016111ca565b03917310ed43c718714eb63d5aa57b78b54704e256024e5af1928315610ae5578493610cc7575b5082604051602081019283526004815261090660248261104e565b51925af1610912611282565b5015610c9a576040516370a0823160e01b8152306004820152889290602081602481855afa908115610ae5578491610c65575b5060405163095ea7b360e01b81527310ed43c718714eb63d5aa57b78b54704e256024e60048201526024810182905260208160448188875af18015610c5a57610c3d575b508161099484611149565b52805f5160206113205f395f51905f526109ad8561116a565b525b610b305750506040516370a0823160e01b8152306004820152602081602481875afa908115610b25578391610af0575b5060405163095ea7b360e01b81527310ed43c718714eb63d5aa57b78b54704e256024e6004820152602481018290529360208560448187855af1948515610ae557610a6b95610ac8575b50610a3383611149565b525f5160206113205f395f51905f52610a4b8361116a565b526040516318cbafe560e01b8152938492839242913091600486016112d9565b0381837310ed43c718714eb63d5aa57b78b54704e256024e5af18015610abd57610a9b575b808087818080610671565b610ab6903d8088833e610aae818361104e565b8101906111fc565b505f610a90565b6040513d88823e3d90fd5b610ae09060203d6020116100ea576100de818361104e565b610a29565b6040513d86823e3d90fd5b9250506020823d602011610b1d575b81610b0c6020938361104e565b8101031261038e578791515f6109df565b3d9150610aff565b6040513d85823e3d90fd5b6c064f964e68233a76f51ffffc18811115610c3857506c064f964e68233a76f51ffffc185b7310ed43c718714eb63d5aa57b78b54704e256024e3b156103db5783610b94916040518093819263791ac94760e01b83524290883091600486016112d9565b0381837310ed43c718714eb63d5aa57b78b54704e256024e5af1908115610ae5578491610c23575b50506040516370a0823160e01b8152306004820152602081602481855afa908115610ae5578491610bef575b50806109af565b9350506020833d8211610c1b575b81610c0a6020938361104e565b8101031261038e578892515f610be8565b3d9150610bfd565b81610c2d9161104e565b61034b57825f610bbc565b610b55565b610c559060203d6020116100ea576100de818361104e565b610989565b6040513d87823e3d90fd5b9350506020833d602011610c92575b81610c816020938361104e565b8101031261038e578892515f610945565b3d9150610c74565b60405162461bcd60e51b81526020600482015260056024820152642320a4a63360d91b6044820152606490fd5b610cda903d8086833e610aae818361104e565b6108eb565b909192939495604051630240bc6b60e21b81528481600481875afa9081156100f15782908392610e68575b506040516385f8c25960e01b81526c064f964e68233a76f52000000060048201526001600160701b039283166024820152911660448201526020816064817310ed43c718714eb63d5aa57b78b54704e256024e5afa918215610e5c5791610e2b575b506103e7198101908111610e1757908e9695949392917310ed43c718714eb63d5aa57b78b54704e256024e3b15610e13578789610dc292604051808095819463b6f9de9560e01b835242903090600485016111ca565b03917310ed43c718714eb63d5aa57b78b54704e256024e5af1908115610e08578891610df3575b505060010161088c565b81610dfd9161104e565b6103cf57865f610de9565b6040513d8a823e3d90fd5b8780fd5b634e487b7160e01b8f52601160045260248ffd5b90506020813d8211610e54575b81610e456020938361104e565b8101031261038e57515f610d6c565b3d9150610e38565b604051903d90823e3d90fd5b809250868092503d8311610ebc575b610e81818361104e565b8101031261034757610e928161117a565b6040610ea06020840161117a565b92015163ffffffff81160361034b576001600160701b03610d0a565b503d610e77565b81610ecd9161104e565b6103db57835f610846565b9450506020843d602011610f05575b81610ef46020938361104e565b8101031261038e578b93515f6107fa565b3d9150610ee7565b508761066c565b519a505f610635565b5080511515610630565b610f3891959493929d505f9061104e565b5f9b909192935f610620565b6040513d5f823e3d90fd5b955050929190600193610628565b909a506020813d602011610f89575b81610f796020938361104e565b8101031261038e5751995f61058f565b3d9150610f6c565b999750929190337336696169c63e42cd08ce11f5deebbcebae65205003610fbc578b93600198610628565b60405162461bcd60e51b815260206004820152600360248201526257663f60e81b6044820152606490fd5b3461038e575f36600319011261038e575f546001600160a01b03168152602090f35b35906001600160a01b038216820361038e57565b610100810190811067ffffffffffffffff82111761103a57604052565b634e487b7160e01b5f52604160045260245ffd5b90601f8019910116810190811067ffffffffffffffff82111761103a57604052565b9190820391821161107d57565b634e487b7160e01b5f52601160045260245ffd5b8151815260208083015190820152604080830151908201526060808301516001600160a01b039081169183019190915260808084015182169083015260a08084015182169083015260c0808401519091169082015260e0918201516001600160e01b031916918101919091526101000190565b919260a093602092600180871b031684525f838501526040840152608060608401528051918291826080860152018484015e5f828201840152601f01601f1916010190565b8051156111565760200190565b634e487b7160e01b5f52603260045260245ffd5b8051600110156111565760400190565b51906001600160701b038216820361038e57565b90602080835192838152019201905f5b8181106111ab5750505090565b82516001600160a01b031684526020938401939092019160010161119e565b6111e8606092959493955f835260806020840152608083019061118e565b6001600160a01b0390951660408201520152565b60208183031261038e5780519067ffffffffffffffff821161038e57019080601f8301121561038e5781519167ffffffffffffffff831161103a578260051b90602082019361124e604051958661104e565b845260208085019282010192831161038e57602001905b8282106112725750505090565b8151815260209182019101611265565b3d156112bc573d9067ffffffffffffffff821161103a57604051916112b1601f8201601f19166020018461104e565b82523d5f602084013e565b606090565b9081602091031261038e5751801515810361038e5790565b906080926112fe919695949683525f602084015260a0604084015260a083019061118e565b6001600160a01b0390951660608201520152565b9190820180921161107d5756fe000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095ca2646970667358221220dd4ad82f01116a2c1107b9e76e511338ecb65d4a9cf662b160a7c1689243295c64736f6c634300081c0033

## main reason/feature:Reentrancy Attack

## [link](https://x.com/TenArmorAlert/status/1888141223094821215)

The swapXSDForETH function in the Router contract contains a reentrancy vulnerability, which allows the attacker to burn a relatively large amount of XSD tokens due to an incorrect pool state when swapping XSD for BNB (on BSC).

``` solidity

function swapXSDForETH(uint amountOut, uint amountInMax, uint deadline)
    external
    swapPaused
    blockDelay
    ensure (deadline)
    override
{
    (uint reserveA, uint reserveB, ) = IXSDWETHpool (XSDWETH_pool_address) •getReserves();
    uint amounts = BankXLibrary.quote(amountOut,reserveB, reserveA);
    require(amounts <= amountInMax, 'BankXRouter: EXCESSIVE_INPUT_AMOUNT');
    TransferHelper.safeTransferFrom(
        xsd_address, msg. sender, XSDWETH_pool_address, amountInMax
    );
    IXSDWETHpool(XSDWETH_pool_address) .swap(0, amountOut, address (this)) ;
    IWBNB (WETH). withdraw(amountOut);
    TransferHelper.safeTransferETH(msg.sender, amountOut);
    //burn xsd here
    if (XSD.totalSupply()-ICollateralPool (payable(collateral_pool_address)).collat_XSD()>amountOut/10 && !pid_controller.bucket1()){
        XSD. burnpooXSD (amountInMax/10);
    }
}

```

## main reason/feature:Access Control

### [link](https://x.com/TenArmorAlert/status/1888507016173220277)

It appears that the 0x42fbb972 function in the contract 0x9ad9 lacks proper access control, allowing anyone to set the whitelist.

As a result, the attacker exploited this vulnerability by calling the 0x031737c1 and 0xe5514be0 functions to drain the funds.

``` solidity

else if (0x6f9f248 > v0) {
if (0x3f407b84 == v0) {
sellAmount ();
} else if (0x42fbb972 == vo) {
transferBnb (address []);
} else if (0x43868aa4 == v0) {
0x43868aa4();
}
}

function transferBb(address[]_tos) public payable { 
    require(msg.data. length - 4 >= 32) ;
    require(_tos <= uint64.max);
    require (4 + _tos + 31 < msg. data. length);
    require(_tos.length <= uint64.max);
    require(4 + _tos + (_tos.length < 5) + 32 <= msg. data. length);
    vO = 0x1eb5 (_tos. length, msg. value);
    v1 = v2 = 0;
    while (v1 >=_tos. length) {
        require(v1 < _tos. length, Panic (50)); 
        require((v1 << 5) + _tos. data + 32 - ((v1 << 5) + _tos.data) >= 32);
        require(_tos [v1] = address(_tos [v1]));
        v3 = address (_tos[v1]). call(). value(v0).gas(!vo * 2300);
        require (bool (v3), 0, RETURNDATASIZE());
        require(v1 < _tos. length, Panic (50));
        require((v1 < 5) + _tos.data + 32 - ((v1 < 5) +_tos.data) >= 32);
        require (_tos [v1] = address (_tos [v1]));
        if (!_transferBnb [address(_tos [v1])]) {
            require(v1 < _tos.length, Panic (50)); 
            require((v1 < 5) +_ tos.data + 32 - ((v1 < 5) + _tos.data) >= 32);
            require (_tos [v1] == address (_tos [v1])) ;
            _transferBnb [address (_tos [v1])] = 1;
        }
        v1 += 1;
}

```

## main reason/feature:Sandwich Attack

### [link](https://x.com/TenArmorAlert/status/1888512110323241128)

It appears that the contracts are designed to help users manage their Uniswap V3 positions. However, the withdraw function lacks proper access control and slippage protection when swapping WETH for USDC.

The attacker first manipulated the WETH/USDC price in the Uniswap V3 pool to a low level and added USDC as liquidity.
Then, repeatedly called the withdraw function to claim the position and swap WETH for USDC.
Finally, the attacker removed the previously added liquidity to profit (71 ETH) from the exploit.

[tx](https://arbiscan.io/tx/0x4b75157d64bb371380bc83256ee36034effb07c532b8623a34154aa881df9798)


## [link](https://x.com/TenArmorAlert/status/1889515007404286019)

1. When the platform initiated the seeding process and attempted to establish a Pancake V3 pool for a token, the contract did not verify the pool's state or price if the pool already existed.
2. This allowed the attacker to deploy a pool in advance with an abnormally high token price. As a result, when the platform added liquidity, it unknowingly deposited funds into the attacker’s malicious pool without checking the actual pool price.
3. Finally, the attacker sold the tokens previously bought from the platform's internal pool at a low price, and making a profit.

``` solidity

// Data structures and variables inferred from the use of storage instructions
address ___function_selector__; // STORAGE[0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc] bytes 0 to 19



// Note: The function selector is not present in the original solidity code.
// However, we display it for the sake of completeness.

function __function_selector__() public payable { 
    MEM[64] = 128;
    if (!msg.data.length) {
    }
    CALLDATACOPY(0, 0, msg.data.length);
    v0 = ___function_selector__.delegatecall(MEM[0:msg.data.length], MEM[0:0]).gas(msg.gas);
    require(v0, 0, RETURNDATASIZE()); // checks call status, propagates error data on error
    return MEM[0:RETURNDATASIZE()];
}

```

## main reason/feature:Access Control

### [link](https://bscscan.com/tx/0x619e1cae53f1e7f903344e8c0d2e4b1c160583c7ce1fc10eeb34fa3f21b570b1)

The 0xb9d384fa function in the contract does not validate the Uniswap V3 pool's legitimacy and lacks proper access control.

The attacker deployed a fake pool with an abnormal price and added a small amount of WBNB as liquidity.
Then, the attacker called the function to force the MEV bot to swap in WBNB, pushing the price into the attacker's liquidity range.
Finally, the attacker removed the previously added liquidity, securing a profit.

``` solidity

pragma solidity ^0.4.18;

contract WBNB {
    string public name     = "Wrapped BNB";
    string public symbol   = "WBNB";
    uint8  public decimals = 18;

    event  Approval(address indexed src, address indexed guy, uint wad);
    event  Transfer(address indexed src, address indexed dst, uint wad);
    event  Deposit(address indexed dst, uint wad);
    event  Withdrawal(address indexed src, uint wad);

    mapping (address => uint)                       public  balanceOf;
    mapping (address => mapping (address => uint))  public  allowance;

    function() public payable {
        deposit();
    }
    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
        Deposit(msg.sender, msg.value);
    }
    function withdraw(uint wad) public {
        require(balanceOf[msg.sender] >= wad);
        balanceOf[msg.sender] -= wad;
        msg.sender.transfer(wad);
        Withdrawal(msg.sender, wad);
    }

    function totalSupply() public view returns (uint) {
        return this.balance;
    }

    function approve(address guy, uint wad) public returns (bool) {
        allowance[msg.sender][guy] = wad;
        Approval(msg.sender, guy, wad);
        return true;
    }

    function transfer(address dst, uint wad) public returns (bool) {
        return transferFrom(msg.sender, dst, wad);
    }

    function transferFrom(address src, address dst, uint wad)
    public
    returns (bool)
    {
        require(balanceOf[src] >= wad);

        if (src != msg.sender && allowance[src][msg.sender] != uint(-1)) {
            require(allowance[src][msg.sender] >= wad);
            allowance[src][msg.sender] -= wad;
        }

        balanceOf[src] -= wad;
        balanceOf[dst] += wad;

        Transfer(src, dst, wad);

        return true;
    }
}

```

## main reason/feature:Function Initialize

### [link](https://bscscan.com/tx/0xc7fc7e066ec2d4ea659061b75308c9016c0efab329d1055c2a8d91cc11dc3868)

It seems that the contract was not properly initialized, allowing the attacker to call the initialize() function and gain control of the contract. Easy profit!

bytecode

0x608080604052600436101561001a575b50361561001857005b005b5f905f3560e01c90816312065fe0146124ca575080631d5f45f51461248657806323a69e75146124265780633699530f14611f8b57806353290b4414611ee7578063595299b514611a045780635e56c50c146119e657806368e0d4e1146119a1578063715018a6146119385780638129fc1c146117dd5780638da5cb5b146117a85780638de4b786146113765780638f3fcc0014610ec05780639df9002814610e91578063aaa6b20314610a5b578063ad3b1b47146108e9578063ad5c4648146108a4578063b86a346e14610276578063bc28ab4314610248578063d52bb6f4146101385763f2fde38b0361000f5734610135576020366003190112610135576101326101256124e2565b61012d6139ac565b613205565b80f35b80fd5b5034610135576040366003190112610135576004906101556124e2565b61015d6124f8565b90606061016a8383613a7f565b50926001600160a01b03906101a090847f000000000000000000000000ca143ce32fe78f1f7019d7d551a6402fc5350c73613b36565b1660405195868092630240bc6b60e21b82525afa91821561023d57604094849085946101fe575b506001600160701b039384169450909216916001600160a01b039182169116036101f957905b82519182526020820152f35b6101ed565b6001600160701b03945084915061022c9060603d606011610236575b61022481836126da565b8101906131cf565b50949091506101c7565b503d61021a565b6040513d85823e3d90fd5b50346101355761027261026661025d366125bf565b929190916130c7565b60405191829182612601565b0390f35b5061029161028336612538565b949392959690421115612a4d565b610299613362565b6102a860ff6032541615612a8a565b6001600160a01b03808316947f000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c9391841692906102e787851415612ad6565b851561085f57826103076103e86102ff8b948a612c53565b048098612c98565b956001600160a01b038416156107db575050505b6001600160a01b031690610330821515612b22565b61033c883033846133b6565b6040516334324e9f60e21b815296602088600481865afa9788156106bf578a986107aa575b50604051630dfe168160e01b8152602081600481875afa801561079f5788918c91610770575b5060018060a01b0316149262ffffff604051926103a3846126aa565b898452866020850152169889604084015286606084015284608084015260020b60a0830152600160ff1b861461075c576040516370a0823160e01b815230600482015293602085602481895afa948515610751578c95610716575b509160409161042793805f146106f8576104356401000276a5935b855196879160208301612b87565b03601f1981018752866126da565b8d8961045a865197889687958694630251596160e31b86528603903060048701612c17565b03925af180156106bf576106ca575b506040516370a0823160e01b81523060048201526020816024818a5afa9081156106bf578a9161068d575b5061049f818a612c98565b9889116106485780610636575b50506040516370a0823160e01b8152306004820152602081602481865afa90811561062b5789916105f5575b508381106105b0578289933b156105ac57838091602460405180948193632e1a7d4d60e01b83528760048401525af180156105a157610579575b5082808060e09997956105395f80516020613c378339815191529c9a989661054a96612c98565b335af1610544612ca5565b50612ce4565b604051948552602085015260408401526060830152846080830152600560a083015260c0820152a16001815580f35b9261058b81809a9896949997956126da565b61059d575f9792949691939597610512565b8780fd5b6040513d86823e3d90fd5b8380fd5b60405162461bcd60e51b815260206004820152601760248201527f426c6f6f6d526f7574657256333a20736c6970706167650000000000000000006044820152606490fd5b90506020813d602011610623575b81610610602093836126da565b8101031261061f57515f6104d8565b5f80fd5b3d9150610603565b6040513d8b823e3d90fd5b610641913390613276565b5f806104ac565b60405162461bcd60e51b815260206004820152601e60248201527f426c6f6f6d526f7574657256333a2065786365737369766520696e70757400006044820152606490fd5b90506020813d6020116106b7575b816106a8602093836126da565b8101031261061f57515f610494565b3d915061069b565b6040513d8c823e3d90fd5b6106eb9060403d6040116106f1575b6106e381836126da565b810190612bdd565b50610469565b503d6106d9565b61043573fffd8963efd1fc6a506488495d951d5263988d2593610419565b91929094506020823d602011610749575b81610734602093836126da565b8101031261061f5790519390919060406103fe565b3d9150610727565b6040513d8e823e3d90fd5b634e487b7160e01b8b52601160045260248bfd5b610792915060203d602011610798575b61078a81836126da565b8101906126fc565b5f610387565b503d610780565b6040513d8d823e3d90fd5b6107cd91985060203d6020116107d4575b6107c581836126da565b810190612b6e565b965f610361565b503d6107bb565b60209293506107fe6040519485938493630b4c774160e11b85526004850161271b565b03817f0000000000000000000000000bfbcf9fa4f9c56b0f40a671ad40e0805a0918656001600160a01b03165afa90811561062b578991610840575b5061031b565b610859915060203d6020116107985761078a81836126da565b5f61083a565b60405162461bcd60e51b815260206004820152601b60248201527f426c6f6f6d526f7574657256333a20616d6f756e74206f7574203000000000006044820152606490fd5b50346101355780600319360112610135576040517f000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c6001600160a01b03168152602090f35b5034610135576040366003190112610135576109036124e2565b60243561090e6139ac565b610916613362565b6001600160a01b038216806109945750809150471061094f578180808061094894335af1610942612ca5565b5061307b565b6001815580f35b60405162461bcd60e51b815260206004820152601f60248201527f426c6f6f6d3a20696e73756666696369656e74206574682062616c616e6365006044820152606490fd5b6020602491604051928380926370a0823160e01b82523060048301525afa80156105a15782918591610a26575b50106109d7576109d2913390613276565b610948565b60405162461bcd60e51b815260206004820152602160248201527f426c6f6f6d3a20696e73756666696369656e7420746f6b656e2062616c616e636044820152606560f81b6064820152608490fd5b9150506020813d602011610a53575b81610a42602093836126da565b8101031261061f578190515f6109c1565b3d9150610a35565b5060c036600319011261013557600435610a736124f8565b6044359162ffffff8316808403610e8d57610a8c61250e565b610a9a426084351015612a4d565b610aa2613362565b610ab160ff6032541615612a8a565b6001600160a01b03848116917f000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c91821690610aee84831415612ad6565b6103e8610afd60a43534612c53565b0497610b098934612c98565b93833b15610e8957604051630d0e30db60e41b8152908b80836004818a8a5af1928315610dbc578b93610e6e575b50506001600160a01b03841615610dea575050505b6001600160a01b031690610b61821515612b22565b604051630dfe168160e01b815291602083600481845afa9283156106bf578a93610dc9575b506040516334324e9f60e21b8152938a602086600481865afa8015610dbc5784604096610c0c988493610d9b575b5060018060a01b03161490865195610bcb876126aa565b865288602087015289878701528a606087015281608087015260020b60a0860152805f14610d7d57610c1a6401000276a5955b875198899160208301612b87565b03601f1981018952886126da565b610c3a865197889687958694630251596160e31b86523060048701612c17565b03925af18015610d5457610d5f575b506040516370a0823160e01b815230600482015292602084602481855afa938415610d54578794610d20575b508310610cc9575f80516020613c3783398151915294610c998460e0963390613276565b60405193348552602085015260408401526060830152846080830152600260a083015260c0820152a16001815580f35b60405162461bcd60e51b815260206004820152602960248201527f426c6f6f6d526f7574657256333a20696e73756666696369656e74206f7574706044820152681d5d08185b5bdd5b9d60ba1b6064820152608490fd5b9093506020813d602011610d4c575b81610d3c602093836126da565b8101031261061f5751925f610c75565b3d9150610d2f565b6040513d89823e3d90fd5b610d779060403d6040116106f1576106e381836126da565b50610c49565b610c1a73fffd8963efd1fc6a506488495d951d5263988d2595610bfe565b610db591935060203d6020116107d4576107c581836126da565b915f610bb4565b50604051903d90823e3d90fd5b610de391935060203d6020116107985761078a81836126da565b915f610b86565b6020929350610e0d6040519485938493630b4c774160e11b85526004850161271b565b03817f0000000000000000000000000bfbcf9fa4f9c56b0f40a671ad40e0805a0918656001600160a01b03165afa90811561062b578991610e4f575b50610b4c565b610e68915060203d6020116107985761078a81836126da565b5f610e49565b8192935090610e7c916126da565b610e895788908b5f610b37565b8a80fd5b8480fd5b5034610135578060031936011261013557610eaa6139ac565b60325460ff80821615169060ff19161760325580f35b50610edd610ecd3661263a565b9396959890929491421115612a4d565b610ee5613362565b610ef460ff6032541615612a8a565b6002810361133157806001101561131d576020880195610f1387612d66565b6001600160a01b037f000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c81169891168890036112e257610f5482848c8c6130c7565b80515f198101919082116112ce5790610f6c91612d87565b5180971161129057821561127c5790610fb6898c610fae84829a999897968f610fa281610f9b610fa893612d66565b9650612d66565b91612d66565b906134a6565b9033906133b6565b6040516370a0823160e01b8152306004820152916020836024818c5afa928315610d54578793611241575b5090610ff991610ff48c30923691612dcb565b613502565b6040516370a0823160e01b81523060048201526020816024818b5afa9081156112365786916111fd575b509061102e91612c98565b9484908087106111eb575b859180158015806111e2575b61118c575b50505060ff611074936110656103e89461106c941115612e1f565b1686612c53565b048094612c98565b936040516370a0823160e01b8152306004820152602081602481855afa9081156105a1578491611157575b50813b156105ac578391602483926040519485938492632e1a7d4d60e01b845260048401525af1801561023d57611139575b505f80516020613c37833981519152956110fc83808088979660e09a99611101975af1610942612ca5565b612d66565b916040519384526020840152604083015260018060a01b031660608201523460808201528360a08201528360c0820152a16001815580f35b91611149818093979695946126da565b61013557909192935f6110d1565b9350506020833d602011611184575b81611173602093836126da565b8101031261061f578792515f61109f565b3d9150611166565b91939495965091506103e882029182046103e81417156111ce5760ff8a9594611065611074956111c26103e89661106c96612c7a565b9450945081955061104a565b634e487b7160e01b8a52601160045260248afd5b50821515611045565b90506111f78682612c98565b90611039565b919550506020813d60201161122e575b8161121a602093836126da565b8101031261061f575189949061102e611023565b3d915061120d565b6040513d88823e3d90fd5b91965091506020813d602011611274575b8161125f602093836126da565b8101031261061f57518a959091610ff9610fe1565b3d9150611252565b634e487b7160e01b8b52603260045260248bfd5b60405162461bcd60e51b8152602060048201526016602482015275426c6f6f6d3a206f7574206f6620736c69707061676560501b6044820152606490fd5b634e487b7160e01b8d52601160045260248dfd5b60405162461bcd60e51b8152602060048201526013602482015272084d8dededa7440d2dcecc2d8d2c840e0c2e8d606b1b6044820152606490fd5b634e487b7160e01b89526032600452602489fd5b60405162461bcd60e51b815260206004820152601a60248201527f426c6f6f6d3a20696e76616c69642070617468206c656e6774680000000000006044820152606490fd5b506113936113833661263a565b9395979890929491421115612a4d565b61139b613362565b6113aa60ff6032541615612a8a565b5f1981018181116111ce576103e861141960ff6113ce6110fc61142195878e612d42565b6001600160a01b037f000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c8116989161140791168914612d3b565b6114128d1515613025565b168b612c53565b048099612c98565b9461143661143182848b8a612e94565b612d7a565b5196871161176357811561174f5761144d88612d66565b61145689612d66565b836001101561173b5761147591610fae848b93610fa860208f01612d66565b6040516370a0823160e01b815230600482015290602082602481885afa91821561079f578b92611705575b506114b39192610ff4309136908c612dcb565b6040516370a0823160e01b815230600482015290602082602481875afa80156106bf578a906116d1575b6114e79250612c98565b93848111156116cb576114fa8582612c98565b8015806116c2576103e882029182046103e81417156111ce579061151d91612c7a565b11611686576040516370a0823160e01b8152306004820152879290602081602481865afa9081156105a1578491611651575b50823b156105ac578392602484926040519586938492632e1a7d4d60e01b845260048401525af190811561023d5784928492611633575b50819282915af1611595612ca5565b50156115ee575f80516020613c37833981519152936115b560e094612d66565b916040519384526020840152604083015260018060a01b03166060820152346080820152600460a08201528360c0820152a16001815580f35b60405162461bcd60e51b815260206004820152601a60248201527f426c6f6f6d3a204554485f5452414e534645525f4641494c45440000000000006044820152606490fd5b61164091935082906126da565b61164d578183915f611586565b5080fd5b9350506020833d60201161167e575b8161166d602093836126da565b8101031261061f578792515f61154f565b3d9150611660565b60405162461bcd60e51b8152602060048201526014602482015273084d8dededa74408ab0868aa6a692ac8abea882b60631b6044820152606490fd5b5050508761151d565b886114fa565b506020823d6020116116fd575b816116eb602093836126da565b8101031261061f576114e791516114dd565b3d91506116de565b91506020823d602011611733575b81611720602093836126da565b8101031261061f576114b39151916114a0565b3d9150611713565b634e487b7160e01b8c52603260045260248cfd5b634e487b7160e01b8a52603260045260248afd5b60405162461bcd60e51b815260206004820152601d60248201527f426c6f6f6d3a2065786365737369766520696e70757420616d6f756e740000006044820152606490fd5b50346101355780600319360112610135575f80516020613c17833981519152546040516001600160a01b039091168152602090f35b50346101355780600319360112610135575f80516020613c578339815191525460ff8160401c16159067ffffffffffffffff811680159081611930575b6001149081611926575b15908161191d575b5061190e5767ffffffffffffffff1981166001175f80516020613c5783398151915255816118e2575b5061185e613beb565b611866613beb565b61186f33613205565b611877613beb565b61187f613beb565b6001825561188a5780f35b68ff0000000000000000195f80516020613c5783398151915254165f80516020613c57833981519152557fc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2602060405160018152a180f35b68ffffffffffffffffff191668010000000000000001175f80516020613c57833981519152555f611855565b63f92ee8a960e01b8352600483fd5b9050155f61182c565b303b159150611824565b83915061181a565b50346101355780600319360112610135576119516139ac565b5f80516020613c1783398151915280546001600160a01b0319811690915581906001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e08280a380f35b50346101355780600319360112610135576040517f000000000000000000000000ca143ce32fe78f1f7019d7d551a6402fc5350c736001600160a01b03168152602090f35b5034610135576102726102666119fb366125bf565b92919091612e94565b5060e03660031901126101355760243567ffffffffffffffff811161164d57611a3190369060040161258e565b6044359060ff821682036105ac57611a4761250e565b9160c4359160ff8316809303611ee357611a65426084351015612a4d565b611a6d613362565b611a7c60ff6032541615612a8a565b611a8860028214612d3b565b8015611ecf57611a9785612d66565b6001600160a01b037f000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c81169491168490036112e257611ad96103e89134612c53565b0493611ae58534612c98565b958615611e8a57611af88484838a6130c7565b80515f198101919082116111ce5790611b1091612d87565b51968760043511611e2f57853b15611e2057604051630d0e30db60e41b815289908181600481868c5af18015611e2457611e0b575b5050611b5082612d66565b95846001101561174f57611ba991602091611b72888487019a610fa88c612d66565b60405163a9059cbb60e01b81526001600160a01b0390911660048201526024810192909252909283919082908d9082906044820190565b03925af190811561062b578991611ddc575b5015611d97575f19830192808411611d83576001600160a01b03611be36110fc868486612d42565b1694604051936370a0823160e01b855260208560248160018060a01b0385169a8b60048301525afa94851561079f578b95611d47575b5094611c4392611c356110fc9360209798610ff436858a612dcb565b6001600160a01b0394612d42565b16926024604051809581936370a0823160e01b835260048301525afa8015611236578690611d13575b611c769250612c98565b92611c818482612c98565b906103e88202918083046103e81490151715611cff575f80516020613c3783398151915294926110fc60e09593611cbe611cc59460a43592612c7a565b1115612e1f565b90604051923484526020840152604083015260018060a01b03166060820152836080820152600160a08201528360c0820152a16001815580f35b634e487b7160e01b86526011600452602486fd5b506020823d602011611d3f575b81611d2d602093836126da565b8101031261061f57611c769151611c6c565b3d9150611d20565b929450946020833d602011611d7b575b81611d64602093836126da565b8101031261061f5791519194919391611c43611c19565b3d9150611d57565b634e487b7160e01b89526011600452602489fd5b60405162461bcd60e51b815260206004820152601b60248201527f426c6f6f6d3a20574554485f5452414e534645525f4641494c454400000000006044820152606490fd5b611dfe915060203d602011611e04575b611df681836126da565b810190612d9b565b5f611bbb565b503d611dec565b81611e15916126da565b611e2057885f611b45565b8880fd5b6040513d84823e3d90fd5b60405162461bcd60e51b815260206004820152602d60248201527f426c6f6f6d3a206d696e20616d6f756e74206f7574206578636565647320657860448201526c1c1958dd1959081bdd5d1c1d5d609a1b6064820152608490fd5b60405162461bcd60e51b815260206004820152601c60248201527f426c6f6f6d3a20616d6f756e74496e41667465724665652069732030000000006044820152606490fd5b634e487b7160e01b86526032600452602486fd5b8580fd5b503461013557604036600319011261013557611f016124e2565b906020611f0c6124f8565b6040516370a0823160e01b81526001600160a01b0391821660048201529384916024918391165afa908115611f7f5790611f4c575b602090604051908152f35b506020813d602011611f77575b81611f66602093836126da565b8101031261061f5760209051611f41565b3d9150611f59565b604051903d90823e3d90fd5b50611fa6611f9836612538565b939492959690421115612a4d565b611fae613362565b611fbd60ff6032541615612a8a565b6001600160a01b03848116947f000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c918216929190611ffc87851415612ad6565b88156123d05787916120108a3033856133b6565b6001600160a01b0384161561234c575050505b6001600160a01b031694612038861515612b22565b604051630dfe168160e01b81526020816004818a5afa801561221f5786915f9161232d575b5060018060a01b031614956040516334324e9f60e21b8152602081600481855afa97881561221f5789915f996122fd575b5091610c0c93915f60409462ffffff8651956120a9876126aa565b8c8752896020880152169b8c8787015282606087015281608087015260020b60a08601528082146122df576120ec6401000276a595875198899160208301612b87565b61210c865197889687958694630251596160e31b86523060048701612c17565b03925af1801561221f576122c1575b506040516370a0823160e01b815230600482015292602084602481855afa93841561221f575f9461228b575b506121556103e89185612c53565b04926121618482612c98565b92831061222a57813b1561061f575f91602483926040519485938492632e1a7d4d60e01b845260048401525af1801561221f576121f1575b509160e09391836121c2888080805f80516020613c378339815191529b99335af1610544612ca5565b604051948552602085015260408401526060830152846080830152600360a083015260c0820152a16001815580f35b5f80516020613c378339815191529593919650916122125f60e096946126da565b5f96919395509193612199565b6040513d5f823e3d90fd5b60405162461bcd60e51b815260206004820152603360248201527f426c6f6f6d526f7574657256333a20696e73756666696369656e74206f7574706044820152720eae840c2dadeeadce840c2cce8cae440e8c2f606b1b6064820152608490fd5b9093506020813d6020116122b9575b816122a7602093836126da565b8101031261061f575192612155612147565b3d915061229a565b6122d99060403d6040116106f1576106e381836126da565b5061211b565b6120ec73fffd8963efd1fc6a506488495d951d5263988d2595610bfe565b604093919950915f612321610c0c969460203d6020116107d4576107c581836126da565b9a92945050919361208e565b612346915060203d6020116107985761078a81836126da565b5f61205d565b602092935061236f6040519485938493630b4c774160e11b85526004850161271b565b03817f0000000000000000000000000bfbcf9fa4f9c56b0f40a671ad40e0805a0918656001600160a01b03165afa90811561221f575f916123b1575b50612023565b6123ca915060203d6020116107985761078a81836126da565b5f6123ab565b60405162461bcd60e51b815260206004820152602860248201527f426c6f6f6d526f7574657256333a20696e73756666696369656e7420696e70756044820152671d08185b5bdd5b9d60c21b6064820152608490fd5b3461061f57606036600319011261061f5760443567ffffffffffffffff811161061f573660238201121561061f57806004013567ffffffffffffffff811161061f57366024828401011161061f5760246100189201602435600435612741565b3461061f575f36600319011261061f576040517f0000000000000000000000000bfbcf9fa4f9c56b0f40a671ad40e0805a0918656001600160a01b03168152602090f35b3461061f575f36600319011261061f57602090478152f35b600435906001600160a01b038216820361061f57565b602435906001600160a01b038216820361061f57565b606435906001600160a01b038216820361061f57565b35906001600160a01b038216820361061f57565b60e090600319011261061f5760043590602435906044356001600160a01b038116810361061f579060643562ffffff8116810361061f57906084356001600160a01b038116810361061f579060a4359060c43590565b9181601f8401121561061f5782359167ffffffffffffffff831161061f576020808501948460051b01011161061f57565b90606060031983011261061f57600435916024359067ffffffffffffffff821161061f576125ef9160040161258e565b909160443560ff8116810361061f5790565b60206040818301928281528451809452019201905f5b8181106126245750505090565b8251845260209384019390920191600101612617565b61010060031982011261061f5760043591602435916044359067ffffffffffffffff821161061f5761266e9160040161258e565b909160643560ff8116810361061f57906084356001600160a01b038116810361061f579060a4359060c4359060e43560ff8116810361061f5790565b60c0810190811067ffffffffffffffff8211176126c657604052565b634e487b7160e01b5f52604160045260245ffd5b90601f8019910116810190811067ffffffffffffffff8211176126c657604052565b9081602091031261061f57516001600160a01b038116810361061f5790565b6001600160a01b0391821681529116602082015262ffffff909116604082015260600190565b91928360c0918101031261061f576040519261275c846126aa565b61276581612524565b9384815261277560208301612524565b9182602083015260408101359062ffffff8216820361061f5781604084015260608101356060840152608081013590811515820361061f5760a09160808501520135918260020b830361061f5760a00191909152604051630b4c774160e11b815294602092869283926128009262ffffff909216916001600160a01b0390811691166004850161271b565b03817f0000000000000000000000000bfbcf9fa4f9c56b0f40a671ad40e0805a0918656001600160a01b03165afa92831561221f575f93612a2c575b506001600160a01b03831633036129ad575f8213156128fe5750604051630dfe168160e01b81529190602083600481335afa92831561221f577fb7e4f621044776fd0cc57e688519ad55d6e26572e738e836d0ed38f687cd0925936128da915f916128df575b50915b6128b0818585613276565b604080516001600160a01b0394851681529490931660208501529183019190915281906060820190565b0390a1565b6128f8915060203d6020116107985761078a81836126da565b5f6128a2565b905f82131561297a575060405163d21220a760e01b81529190602083600481335afa92831561221f577fb7e4f621044776fd0cc57e688519ad55d6e26572e738e836d0ed38f687cd0925936128da915f9161295b575b50916128a5565b612974915060203d6020116107985761078a81836126da565b5f612954565b7ff76152c6f2ba3f6b215c5dcf700cfc0059b475382f2100b1c5257fc48132b77e925060409182519182526020820152a1565b604080513381526001600160a01b03851660208201527fb5efcdc3d07e83e4ace566a2fcf95c5b36bda4763f620fea266d962c76b95b4b9190a160405162461bcd60e51b815260206004820152601f60248201527f426c6f6f6d526f7574657256333a20696e76616c69642063616c6c6261636b006044820152606490fd5b612a4691935060203d6020116107985761078a81836126da565b915f61283c565b15612a5457565b60405162461bcd60e51b815260206004820152600e60248201526d109b1bdbdb4e88195e1c1a5c995960921b6044820152606490fd5b15612a9157565b60405162461bcd60e51b815260206004820152601960248201527f426c6f6f6d3a20436f6e7472616374206973206c6f636b6564000000000000006044820152606490fd5b15612add57565b60405162461bcd60e51b815260206004820152601c60248201527f426c6f6f6d526f7574657256333a20696e76616c696420746f6b656e000000006044820152606490fd5b15612b2957565b60405162461bcd60e51b815260206004820152601d60248201527f426c6f6f6d526f7574657256333a20706f6f6c206e6f7420666f756e640000006044820152606490fd5b9081602091031261061f57518060020b810361061f5790565b91909160a08060c0830194600180831b038151168452600180831b03602082015116602085015262ffffff604082015116604085015260608101516060850152608081015115156080850152015160020b910152565b919082604091031261061f576020825192015190565b805180835260209291819084018484015e5f828201840152601f01601f1916010190565b6001600160a01b039182168152911515602083015260408201929092529116606082015260a060808201819052612c5092910190612bf3565b90565b81810292918115918404141715612c6657565b634e487b7160e01b5f52601160045260245ffd5b8115612c84570490565b634e487b7160e01b5f52601260045260245ffd5b91908203918211612c6657565b3d15612cdf573d9067ffffffffffffffff82116126c65760405191612cd4601f8201601f1916602001846126da565b82523d5f602084013e565b606090565b15612ceb57565b60405162461bcd60e51b815260206004820152602260248201527f426c6f6f6d526f7574657256333a20657468207472616e73666572206661696c604482015261195960f21b6064820152608490fd5b156112e257565b9190811015612d525760051b0190565b634e487b7160e01b5f52603260045260245ffd5b356001600160a01b038116810361061f5790565b805115612d525760200190565b8051821015612d525760209160051b010190565b9081602091031261061f5751801515810361061f5790565b67ffffffffffffffff81116126c65760051b60200190565b929190612dd781612db3565b93612de560405195866126da565b602085838152019160051b810192831161061f57905b828210612e0757505050565b60208091612e1484612524565b815201910190612dfb565b15612e2657565b60405162461bcd60e51b8152602060048201526014602482015273084d8dededa7440caf0c6cae6e6d2ecca40e8c2f60631b6044820152606490fd5b90612e6c82612db3565b612e7960405191826126da565b8281528092612e8a601f1991612db3565b0190602036910137565b9392612ea36002841015612d3b565b612eac83612e62565b9485515f198101908111612c6657612ec49087612d87565b525f198301838111612c6657805b612edc5750505050565b5f198101818111612c6657612f0d83612ef96110fc848989612d42565b612f076110fc868a8a612d42565b90613804565b90612f3485612f206110fc868b8b612d42565b612f2e6110fc888c8c612d42565b906138a4565b91612f3f858b612d87565b5191612f4c831515613025565b8015158061301c575b612f5e90613960565b82821115612fd75782612f7091612c53565b916127108302928084046127101490151715612c6657612f8f91612c98565b9161271003916127108311612c6657612fb192612fab91612c53565b90612c7a565b9060018201809211612c6657612fc79088612d87565b528015612c66575f190180612ed2565b60405162461bcd60e51b815260206004820152601b60248201527f426c6f6f6d3a206e6f7420656e6f756768206c697175696469747900000000006044820152606490fd5b50811515612f55565b1561302c57565b60405162461bcd60e51b815260206004820152602160248201527f426c6f6f6d3a20696e73756666696369656e74206f757470757420616d6f756e6044820152601d60fa1b6064820152608490fd5b1561308257565b60405162461bcd60e51b815260206004820152601a60248201527f426c6f6f6d3a20657468207472616e73666572206661696c65640000000000006044820152606490fd5b90939260028310613180578115613144576130e183612e62565b94826130ec87612d7a565b528315612d52576130fc81612d66565b9360011015612d525761312d8261313395612f2e613125610fa2966020870193612f0785612d66565b969095612d66565b926139df565b825160011015612d52576040830152565b60405162461bcd60e51b81526020600482015260146024820152730426c6f6f6d3a20616d6f756e74496e20697320360641b6044820152606490fd5b60405162461bcd60e51b8152602060048201526013602482015272084d8dededa7440929cac82989288bea082a89606b1b6044820152606490fd5b51906001600160701b038216820361061f57565b9081606091031261061f576131e3816131bb565b9160406131f2602084016131bb565b92015163ffffffff8116810361061f5790565b6001600160a01b03168015613263575f80516020613c1783398151915280546001600160a01b0319811683179091556001600160a01b03167f8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e05f80a3565b631e4fbdf760e01b5f525f60045260245ffd5b60405163a9059cbb60e01b602082019081526001600160a01b03909316602482015260448101939093525f9283929083906132be81606481015b03601f1981018352826126da565b51925af16132ca612ca5565b81613333575b50156132d857565b60405162461bcd60e51b815260206004820152602d60248201527f5472616e7366657248656c7065723a3a736166655472616e736665723a20747260448201526c185b9cd9995c8819985a5b1959609a1b6064820152608490fd5b8051801592508215613348575b50505f6132d0565b61335b9250602080918301019101612d9b565b5f80613340565b60025f54146133715760025f55565b60405162461bcd60e51b815260206004820152601f60248201527f5265656e7472616e637947756172643a207265656e7472616e742063616c6c006044820152606490fd5b6040516323b872dd60e01b602082019081526001600160a01b03938416602483015293909216604483015260648201939093525f928392909183906133fe81608481016132b0565b51925af161340a612ca5565b81613477575b501561341857565b60405162461bcd60e51b815260206004820152603160248201527f5472616e7366657248656c7065723a3a7472616e7366657246726f6d3a207472604482015270185b9cd9995c919c9bdb4819985a5b1959607a1b6064820152608490fd5b805180159250821561348c575b50505f613410565b61349f9250602080918301019101612d9b565b5f80613484565b9160ff166134d857612c50917f000000000000000000000000ca143ce32fe78f1f7019d7d551a6402fc5350c73613b36565b612c50917f000000000000000000000000ca143ce32fe78f1f7019d7d551a6402fc5350c73613b36565b60209392915f9190825b82515f198101908111612c66578110156137fb576001600160a01b036135328285612d87565b51169060018101808211612c66576001600160a01b03906135539086612d87565b5116916135608382613a7f565b509061356d8885836134a6565b604051630240bc6b60e21b8152926001600160a01b0382169290606085600481875afa94851561221f575f905f966137cd575b506001600160a01b039091168214946001600160701b03908116911685156137c7575b8d60ff8d1680613727575060249450601e935b604051958680926370a0823160e01b82528960048301525afa93841561221f575f946136f6575b5061360b8161361095612c98565b6139df565b91156136ef575f91935b86516001198101908111612c66578410156136e75760028401808511612c665761365b918a916001600160a01b0390613653908b612d87565b5116906134a6565b905b6040519461366b8c876126da565b5f865288368d880137813b1561061f575f80946136bd6040519889968795869463022c0d9f60e01b86526004860152602485015260018060a01b03166044840152608060648401526084830190612bf3565b03925af191821561221f576001926136d7575b500161350c565b5f6136e1916126da565b5f6136d0565b50849061365d565b5f9361361a565b93508d84813d8311613720575b61370d81836126da565b8101031261061f5792519261360b6135fd565b503d613703565b60405163cc56b2c560e01b81526001600160a01b039096166004870152600214602486015284806044810103817f000000000000000000000000ca143ce32fe78f1f7019d7d551a6402fc5350c736001600160a01b03165afa801561221f578e905f90613799575b60249550936135d6565b5084813d83116137c0575b6137ae81836126da565b8101031261061f578d6024945161378f565b503d6137a4565b906135c3565b6001600160701b0396508691506137f19060603d81116102365761022481836126da565b50969091506135a0565b50505050509050565b909160ff16613872576040805163354aedbd60e21b81526001600160a01b0392831660048201529290911660248301528180604481015b0381305afa801561221f575f915f9161385357509091565b905061386e915060403d6040116106f1576106e381836126da565b9091565b6040805163354aedbd60e21b81526001600160a01b03928316600482015292909116602483015281806044810161383b565b60ff8316929190836138b95750505050601e90565b6020926002926138c8926134a6565b60405163cc56b2c560e01b81526001600160a01b0390911660048201529214602483015281806044810103817f000000000000000000000000ca143ce32fe78f1f7019d7d551a6402fc5350c736001600160a01b03165afa90811561221f575f91613931575090565b90506020813d602011613958575b8161394c602093836126da565b8101031261061f575190565b3d915061393f565b1561396757565b60405162461bcd60e51b815260206004820152601d60248201527f426c6f6f6d3a20696e73756666696369656e74206c69717569646974790000006044820152606490fd5b5f80516020613c17833981519152546001600160a01b031633036139cc57565b63118cdaa760e01b5f523360045260245ffd5b9091928115613a3b5782151580613a32575b6139fa90613960565b612710036127108111612c6657613a1761271091613a1f93612c53565b049283612c53565b918101809111612c6657612c5091612c7a565b508315156139f1565b606460405162461bcd60e51b815260206004820152602060248201527f426c6f6f6d3a20696e73756666696369656e7420696e70757420616d6f756e746044820152fd5b9091906001600160a01b03808416908216808214613af1571015613aec57915b906001600160a01b03831615613ab157565b60405162461bcd60e51b8152602060048201526013602482015272426c6f6f6d3a207a65726f206164647265737360681b6044820152606490fd5b613a9f565b60405162461bcd60e51b815260206004820152601a60248201527f426c6f6f6d3a206964656e746963616c206164647265737365730000000000006044820152606490fd5b91613b4091613a7f565b6040519060208201926001600160601b03199060601b1683526001600160601b03199060601b16603482015260288152613b7b6048826126da565b5190209060405191602083019160ff60f81b83526001600160601b03199060601b16602184015260358301527efb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5605583015260558252613bdb6075836126da565b905190206001600160a01b031690565b60ff5f80516020613c578339815191525460401c1615613c0757565b631afcd79f60e31b5f5260045ffdfe9016d09d72d40fdae2fd8ceac6b6234c7706214fd39c1cd1e609a0528c1993002d720abb2e4bf42730e89955397ce0f5b08db0caff9be7e08ca184a8b1b2db2ff0c57e16840df040f15088dc2f81fe391c3923bec73e23a9662efc9c229c6a00a2646970667358221220802e7550185b93e28b63005358a08203178abd95fc4cb7c1101f88b6fe55ff4d64736f6c634300081a0033

## main reason/feature:Transfer Logic

### [link](https://bscscan.com/tx/0x8d1ed893295fb881d3f38e41c5f0857fc409069faac59f22a7e4251b002a9ed0)

The underlying issue lies within the _transfer() function. When tokens are transferred to the pair, the pair burns some tokens, which in turn drives the price upward.

``` solidity
function _transfer(
    address from,
    address to,
    uint256 amount
  ) internal returns (bool) {
    // Only charge fees during swap process, no fees for adding/removing liquidity or contract sales
    if ((_v2Pairs[from] || _v2Pairs[to]) && from != address(this)) {
      uint256 feeAmount;
      bool isBuy = _v2Pairs[from];
      bool isSell = _v2Pairs[to];

      // Check if swap has started (whitelist addresses are not restricted)
      if (isBuy && !whitelist[to]) {
        if (swapStartTime == 0) {
          revert("Swap not started");
        } else if (block.timestamp < swapStartTime) {
          revert("Swap not started");
        }
      }

        // Charge burn fee
      if (isSell && msg.sender != _routerAddress) {
            uint256 burnAmount = amount.mul(burnFeeRate).div(FEE_DENOMINATOR);
            uint256 poolBalance = _balances[to];
            if(burnAmount.mul(100).div(poolBalance) >= 1) { 
                    burnAmount = poolBalance.div(100);
                }
        _burn(to, burnAmount);
        IUniswapV2Pair(to).sync();
      }

      // Charge fee (in basis points)
      feeAmount = amount.mul(swapFeeRate).div(FEE_DENOMINATOR);
      swapFee = swapFee.add(feeAmount);

      _balances[from] = _balances[from].sub(amount);
      _balances[address(this)] = _balances[address(this)].add(feeAmount);
      _balances[to] = _balances[to].add(amount.sub(feeAmount));

      emit Transfer(from, address(this), feeAmount);
      emit Transfer(from, to, amount.sub(feeAmount));

      return true;
    }

    _balances[from] = _balances[from].sub(amount);
    _balances[to] = _balances[to].add(amount);

    if (to == address(0)) {
      _totalSupply = _totalSupply.sub(amount);
    }

    emit Transfer(from, to, amount);

    return true;
  }

```

## main reason/feature:Access Control

### [link](https://bscscan.com/tx/0x2e0f235300597d7fb407b94b5f2c6d654ecbbc51103b9d8623aa947e1c211efd)

It appears that the contract 0x57ae allows anyone to create a token pair with BADAI, then add liquidity using BADAI from the contract—without proper access control or validation.

The attacker exploited this by creating a fake token, adding liquidity, and then withdrawing BADAI from the newly created pair by removing liquidity.

bytecode

0x608060405234801561001057600080fd5b50600436106100c95760003560e01c80633950935111610081578063a457c2d71161005b578063a457c2d714610194578063a9059cbb146101a7578063dd62ed3e146101ba57600080fd5b8063395093511461014357806370a082311461015657806395d89b411461018c57600080fd5b806318160ddd116100b257806318160ddd1461010f57806323b872dd14610121578063313ce5671461013457600080fd5b806306fdde03146100ce578063095ea7b3146100ec575b600080fd5b6100d6610200565b6040516100e39190610908565b60405180910390f35b6100ff6100fa36600461099d565b610292565b60405190151581526020016100e3565b6002545b6040519081526020016100e3565b6100ff61012f3660046109c7565b6102ac565b604051601281526020016100e3565b6100ff61015136600461099d565b6102d0565b610113610164366004610a03565b73ffffffffffffffffffffffffffffffffffffffff1660009081526020819052604090205490565b6100d661031c565b6100ff6101a236600461099d565b61032b565b6100ff6101b536600461099d565b610401565b6101136101c8366004610a25565b73ffffffffffffffffffffffffffffffffffffffff918216600090815260016020908152604080832093909416825291909152205490565b60606003805461020f90610a58565b80601f016020809104026020016040519081016040528092919081815260200182805461023b90610a58565b80156102885780601f1061025d57610100808354040283529160200191610288565b820191906000526020600020905b81548152906001019060200180831161026b57829003601f168201915b5050505050905090565b6000336102a081858561040f565b60019150505b92915050565b6000336102ba8582856105c2565b6102c5858585610699565b506001949350505050565b33600081815260016020908152604080832073ffffffffffffffffffffffffffffffffffffffff871684529091528120549091906102a09082908690610317908790610aab565b61040f565b60606004805461020f90610a58565b33600081815260016020908152604080832073ffffffffffffffffffffffffffffffffffffffff87168452909152812054909190838110156103f4576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152602560248201527f45524332303a2064656372656173656420616c6c6f77616e63652062656c6f7760448201527f207a65726f00000000000000000000000000000000000000000000000000000060648201526084015b60405180910390fd5b6102c5828686840361040f565b6000336102a0818585610699565b73ffffffffffffffffffffffffffffffffffffffff83166104b1576040517f08c379a0000000000000000000000000000000000000000000000000000000008152602060048201526024808201527f45524332303a20617070726f76652066726f6d20746865207a65726f2061646460448201527f726573730000000000000000000000000000000000000000000000000000000060648201526084016103eb565b73ffffffffffffffffffffffffffffffffffffffff8216610554576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152602260248201527f45524332303a20617070726f766520746f20746865207a65726f20616464726560448201527f737300000000000000000000000000000000000000000000000000000000000060648201526084016103eb565b73ffffffffffffffffffffffffffffffffffffffff83811660008181526001602090815260408083209487168084529482529182902085905590518481527f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925910160405180910390a3505050565b73ffffffffffffffffffffffffffffffffffffffff8381166000908152600160209081526040808320938616835292905220547fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff81146106935781811015610686576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152601d60248201527f45524332303a20696e73756666696369656e7420616c6c6f77616e636500000060448201526064016103eb565b610693848484840361040f565b50505050565b73ffffffffffffffffffffffffffffffffffffffff831661073c576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152602560248201527f45524332303a207472616e736665722066726f6d20746865207a65726f20616460448201527f647265737300000000000000000000000000000000000000000000000000000060648201526084016103eb565b73ffffffffffffffffffffffffffffffffffffffff82166107df576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152602360248201527f45524332303a207472616e7366657220746f20746865207a65726f206164647260448201527f657373000000000000000000000000000000000000000000000000000000000060648201526084016103eb565b73ffffffffffffffffffffffffffffffffffffffff831660009081526020819052604090205481811015610895576040517f08c379a000000000000000000000000000000000000000000000000000000000815260206004820152602660248201527f45524332303a207472616e7366657220616d6f756e742065786365656473206260448201527f616c616e6365000000000000000000000000000000000000000000000000000060648201526084016103eb565b73ffffffffffffffffffffffffffffffffffffffff848116600081815260208181526040808320878703905593871680835291849020805487019055925185815290927fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef910160405180910390a3610693565b600060208083528351808285015260005b8181101561093557858101830151858201604001528201610919565b5060006040828601015260407fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe0601f8301168501019250505092915050565b803573ffffffffffffffffffffffffffffffffffffffff8116811461099857600080fd5b919050565b600080604083850312156109b057600080fd5b6109b983610974565b946020939093013593505050565b6000806000606084860312156109dc57600080fd5b6109e584610974565b92506109f360208501610974565b9150604084013590509250925092565b600060208284031215610a1557600080fd5b610a1e82610974565b9392505050565b60008060408385031215610a3857600080fd5b610a4183610974565b9150610a4f60208401610974565b90509250929050565b600181811c90821680610a6c57607f821691505b602082108103610aa5577f4e487b7100000000000000000000000000000000000000000000000000000000600052602260045260246000fd5b50919050565b808201808211156102a6577f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fdfea2646970667358221220256a02590cfaf360b1dea45c31d164e1517a75dce4f9470d345d201525c115af64736f6c63430008130033

## main reason/feature:Reentrancy Attack

### [link](https://bscscan.com/tx/0xef386a69ca6a147c374258a1bf40221b0b6bd9bc449a7016dbe5240644581877)

It appears to be a reentrant attack in the claimReferral() function.

``` solidity

function claimReferral(address varg0) public nonPayable { 
require(msg.data.length - 4 >= 32) ;
require(!_paused, Error( 'Pausable: paused'));
require(owner_5 [msg. sender] [vargO], Error('not-enough-money'));
0x2dle(vargo, owner_5 [msg.sender] [vargo], msg. sender);
owner_5 [msg. sender] [varg0] = 0;
emit 0x9c21c092f05b64df5ae0cbf557b9bf4e9695cdbeaa13fcf9a0831bce847f0cfb(msg.sender, vargo, owner_5 [msg. sender] [vargo]);
}

```

## main reason/feature:Reentrancy Attack

### [link](https://bscscan.com/tx/0xd7a61b07ca4dc5966d00b3cc99b03c6ab2cee688fa13b30bea08f5142023777d)

It seems that there is a reentrant issue in the releaseSlot() function, enabling an attacker to drain all the fund in the contract.

bytecode:

0x60806040526004361061001e5760003560e01c8063a95192c3146100b4575b3373de91e6e937ec344e5a3c800539c41979c2d852781461003e57600080fd5b60006040518060600160405280602481526020016102a1602491399050336001600160a01b031681604051610073919061024d565b6000604051808303816000865af19150503d80600081146100ad576040519150601f19603f3d011682016040523d82523d6000602084013e005b606091505b005b6100b26040516001600160601b03193260601b166020820152603401604051602081830303815290604052805190602001207f95dfda179c60fa15429d88f039b5e1d3170b1a0cb189a7dab554eb3b16c5b67160001b1461011457600080fd5b600060405180606001604052806024815260200161027d60249139905073de91e6e937ec344e5a3c800539c41979c2d852786001600160a01b0316348260405161015e919061024d565b60006040518083038185875af1925050503d806000811461019b576040519150601f19603f3d011682016040523d82523d6000602084013e6101a0565b606091505b5050506040518060600160405280602481526020016102a160249139905073de91e6e937ec344e5a3c800539c41979c2d852786001600160a01b0316816040516101ea919061024d565b6000604051808303816000865af19150503d8060008114610227576040519150601f19603f3d011682016040523d82523d6000602084013e61022c565b606091505b50506040513391504780156108fc02916000818181858888f1505050505050565b6000825160005b8181101561026e5760208186018101518583015201610254565b50600092019182525091905056fe6a9787bc00000000000000000000000000000000000000000000000000000000000000032dad64420000000000000000000000000000000000000000000000000000000000000003a2646970667358221220baca92b619fe603caea1b748b9414133a094a5d07ffefdf6b2edaa83d37fc98964736f6c634300081c0033

## main reason/feature:Private Key Compromised

### [link](https://etherscan.io/tx/0xecb31ff694c0e6c5e5b225c261854c0749ecf5d53c698fcda61f2d8e3db8f9fc)

bytecode

0x608060405260043610610164575f3560e01c806352edf545116100cd578063a52860d511610087578063cdc39b0a11610062578063cdc39b0a14610441578063cfda09ef14610455578063d547741f14610474578063ec5975c614610493575f80fd5b8063a52860d5146103e8578063c56179b314610408578063ca90952014610422575f80fd5b806352edf545146103395780636fc1118d1461035057806375b238fc1461038357806391d14854146103a3578063a217fddf146103c2578063a502bfbd146103d5575f80fd5b8063248a9ca31161011e578063248a9ca31461024e578063273cbaa01461027c5780632f2ff15d1461029d57806331f7d964146102bc57806336568abe146102fb578063375f0fa61461031a575f80fd5b806301ffc9a71461016f57806310badf4e146101a3578063126f8915146101d0578063175188e8146101f15780631c8c8fe214610210578063223e54791461022f575f80fd5b3661016b57005b5f80fd5b34801561017a575f80fd5b5061018e6101893660046114b2565b6104b4565b60405190151581526020015b60405180910390f35b3480156101ae575f80fd5b506101c26101bd366004611532565b6104ea565b60405190815260200161019a565b3480156101db575f80fd5b506101ef6101ea366004611532565b6105c9565b005b3480156101fc575f80fd5b506101ef61020b36600461158a565b610636565b34801561021b575f80fd5b506101ef61022a36600461158a565b61066e565b34801561023a575f80fd5b506101ef61024936600461158a565b6106a9565b348015610259575f80fd5b506101c26102683660046115a5565b5f9081526020819052604090206001015490565b348015610287575f80fd5b506102906107ab565b60405161019a91906115bc565b3480156102a8575f80fd5b506101ef6102b7366004611608565b61080b565b3480156102c7575f80fd5b506102e373eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee81565b6040516001600160a01b03909116815260200161019a565b348015610306575f80fd5b506101ef610315366004611608565b610835565b348015610325575f80fd5b506101ef61033436600461158a565b61086d565b348015610344575f80fd5b506101c2600160ff1b81565b34801561035b575f80fd5b506101c27f8e0bb2066a721fae15f0005dcee9ec6377ae886cb91c267d1440aaec731e456181565b34801561038e575f80fd5b506101c25f8051602061181083398151915281565b3480156103ae575f80fd5b5061018e6103bd366004611608565b6108a5565b3480156103cd575f80fd5b506101c25f81565b6101ef6103e3366004611532565b6108cd565b3480156103f3575f80fd5b506101c25f805160206117f083398151915281565b348015610413575f80fd5b506101c26001600160a01b0381565b34801561042d575f80fd5b506101ef61043c36600461158a565b610a03565b34801561044c575f80fd5b50610290610b41565b348015610460575f80fd5b506101c261046f366004611636565b610b9f565b34801561047f575f80fd5b506101ef61048e366004611608565b610d22565b34801561049e575f80fd5b506104a7610d46565b60405161019a91906116b6565b5f6001600160e01b03198216637965db0b60e01b14806104e457506301ffc9a760e01b6001600160e01b03198316145b92915050565b5f5f805160206117f083398151915261050281610e68565b61050b86610e75565b60405163e77c646d60e01b81526001600160a01b0387169063e77c646d9061053b9088908890889060040161170d565b6020604051808303815f875af1158015610557573d5f803e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061057b9190611742565b604080516001600160a01b0389168152602081018390529193507fc2aa6aae92253e567e5af46202e6f7d213cc4a434fa8c5749f41964645867d3c910160405180910390a150949350505050565b5f805160206117f08339815191526105e081610e68565b6105ec85858585610ead565b50604080516001600160a01b0387168152602081018690527f178730652c9bdfc1f51a5a115f2963e3702b55fc253011fc7dea802e82335d2a910160405180910390a15050505050565b5f8051602061181083398151915261064d81610e68565b506001600160a01b03165f908152600360205260409020805460ff19169055565b5f8051602061181083398151915261068581610e68565b506001600160a01b03165f908152600460205260409020805460ff19166001179055565b5f805160206118108339815191526106c081610e68565b6001600160a01b0382165f81815260036020908152604091829020805460ff191660011790558151632495a59960e01b815291516107a79392632495a5999260048083019391928290030181865afa15801561071e573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906107429190611759565b6001600160a01b03165f818152600560205260408120805460ff191660019081179091556002805491820181559091527f405787fa12a823e0f2b7631cc41b3ba8828b3321ca811111fa75cd3aa3bb5ace0180546001600160a01b0319169091179055565b5050565b6060600280548060200260200160405190810160405280929190818152602001828054801561080157602002820191905f5260205f20905b81546001600160a01b031681526001909101906020018083116107e3575b5050505050905090565b5f8281526020819052604090206001015461082581610e68565b61082f8383611094565b50505050565b6001600160a01b038116331461085e5760405163334bd91960e11b815260040160405180910390fd5b6108688282611123565b505050565b5f8051602061181083398151915261088481610e68565b506001600160a01b03165f908152600460205260409020805460ff19169055565b5f918252602082815260408084206001600160a01b0393909316845291905290205460ff1690565b5f805160206117f08339815191526108e481610e68565b6108ed85610e75565b5f856001600160a01b0316632495a5996040518163ffffffff1660e01b8152600401602060405180830381865afa15801561092a573d5f803e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061094e9190611759565b905061095b81878761118c565b604051635d30351960e01b81526001600160a01b03871690635d3035199061098b9088908890889060040161170d565b5f604051808303815f87803b1580156109a2575f80fd5b505af11580156109b4573d5f803e3d5ffd5b5050604080516001600160a01b038a168152602081018990527fad74235a8caeca33a6612cb543004e88ca3a8177f115e3d3269fa1353397258e935001905060405180910390a1505050505050565b5f80516020611810833981519152610a1a81610e68565b610a23826111de565b6001600160a01b0382165f908152600560205260408120805460ff191690555b60025481101561086857826001600160a01b031660028281548110610a6a57610a6a611774565b5f918252602090912001546001600160a01b031603610b2f5760028054610a939060019061179c565b81548110610aa357610aa3611774565b5f91825260209091200154600280546001600160a01b039092169183908110610ace57610ace611774565b905f5260205f20015f6101000a8154816001600160a01b0302191690836001600160a01b031602179055506002805480610b0a57610b0a6117af565b5f8281526020902081015f1990810180546001600160a01b0319169055019055505050565b80610b39816117c3565b915050610a43565b6060600180548060200260200160405190810160405280929190818152602001828054801561080157602002820191905f5260205f209081546001600160a01b031681526001909101906020018083116107e3575050505050905090565b5f7f8e0bb2066a721fae15f0005dcee9ec6377ae886cb91c267d1440aaec731e4561610bca81610e68565b610bd3886111de565b610bdc86611216565b869150610bea30898961124e565b610cba576001600160a01b038516610c1557604051630fb1a74560e41b815260040160405180910390fd5b5f856001600160a01b0316632495a5996040518163ffffffff1660e01b8152600401602060405180830381865afa158015610c52573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610c769190611759565b9050886001600160a01b0316816001600160a01b031614610caa5760405163936bb5ad60e01b815260040160405180910390fd5b610cb686898787610ead565b9250505b610cc5888388611315565b604080516001600160a01b038a8116825260208201859052888116828401528716606082015290517f77cfc63959f1ab32cc7fa9c3da6fdf58bf6a9afef6b1534ea9dd04b1cdd6b2ac9181900360800190a1509695505050505050565b5f82815260208190526040902060010154610d3c81610e68565b61082f8383611123565b6002546060905f9067ffffffffffffffff811115610d6657610d666117db565b604051908082528060200260200182016040528015610daa57816020015b604080518082019091525f8082526020820152815260200190600190039081610d845790505b5090505f5b600254811015610e6257604051806040016040528060028381548110610dd757610dd7611774565b905f5260205f20015f9054906101000a90046001600160a01b03166001600160a01b03168152602001610e2f60028481548110610e1657610e16611774565b5f918252602090912001546001600160a01b03166113a0565b815250828281518110610e4457610e44611774565b60200260200101819052508080610e5a906117c3565b915050610daf565b50919050565b610e728133611408565b50565b6001600160a01b0381165f9081526003602052604090205460ff16610e7257604051635aad95fd60e11b815260040160405180910390fd5b5f610eb785610e75565b5f856001600160a01b0316632495a5996040518163ffffffff1660e01b8152600401602060405180830381865afa158015610ef4573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610f189190611759565b9050610f2586828761124e565b15610fa15760405163f3fef3a360e01b81526001600160a01b0382811660048301526024820187905287169063f3fef3a3906044016020604051808303815f875af1158015610f76573d5f803e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610f9a9190611742565b915061108b565b60405163e77c646d60e01b81525f906001600160a01b0388169063e77c646d90610fd39089908990899060040161170d565b6020604051808303815f875af1158015610fef573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906110139190611742565b60405163f3fef3a360e01b81526001600160a01b038481166004830152602482018390529192509088169063f3fef3a3906044016020604051808303815f875af1158015611063573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906110879190611742565b9250505b50949350505050565b5f61109f83836108a5565b61111c575f838152602081815260408083206001600160a01b03861684529091529020805460ff191660011790556110d43390565b6001600160a01b0316826001600160a01b0316847f2f8788117e7eff1d82e926ec794901d17c78024a50270940304540a733656f0d60405160405180910390a45060016104e4565b505f6104e4565b5f61112e83836108a5565b1561111c575f838152602081815260408083206001600160a01b0386168085529252808320805460ff1916905551339286917ff6391f5c32d9c69d2a47ea670b442974b53935d1edc7fd64eb21e047a839171b9190a45060016104e4565b604080516001600160a01b038416602482015260448082018490528251808303909101815260649091019091526020810180516001600160e01b031663a9059cbb60e01b179052610868908490611446565b6001600160a01b0381165f9081526005602052604090205460ff16610e725760405163ab9713c560e01b815260040160405180910390fd5b6001600160a01b0381165f9081526004602052604090205460ff16610e7257604051633e17dad560e11b815260040160405180910390fd5b5f73eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeed196001600160a01b038416016112925781846001600160a01b031631101561128d57505f61130e565b61130a565b6040516370a0823160e01b81526001600160a01b0385811660048301528391908516906370a0823190602401602060405180830381865afa1580156112d9573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906112fd9190611742565b101561130a57505f61130e565b5060015b9392505050565b73eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeed196001600160a01b03841601611395575f816001600160a01b0316836040515f6040518083038185875af1925050503d805f8114611383576040519150601f19603f3d011682016040523d82523d5f602084013e611388565b606091505b505090508061082f575f80fd5b61086883828461118c565b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa1580156113e4573d5f803e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104e49190611742565b61141282826108a5565b6107a75760405163e2517d3f60e01b81526001600160a01b0382166004820152602481018390526044015b60405180910390fd5b5f8060205f8451602086015f885af180611465576040513d5f823e3d81fd5b50505f513d9150811561147c578060011415611489565b6001600160a01b0384163b155b1561082f57604051635274afe760e01b81526001600160a01b038516600482015260240161143d565b5f602082840312156114c2575f80fd5b81356001600160e01b03198116811461130e575f80fd5b6001600160a01b0381168114610e72575f80fd5b5f8083601f8401126114fd575f80fd5b50813567ffffffffffffffff811115611514575f80fd5b60208301915083602082850101111561152b575f80fd5b9250929050565b5f805f8060608587031215611545575f80fd5b8435611550816114d9565b935060208501359250604085013567ffffffffffffffff811115611572575f80fd5b61157e878288016114ed565b95989497509550505050565b5f6020828403121561159a575f80fd5b813561130e816114d9565b5f602082840312156115b5575f80fd5b5035919050565b602080825282518282018190525f9190848201906040850190845b818110156115fc5783516001600160a01b0316835292840192918401916001016115d7565b50909695505050505050565b5f8060408385031215611619575f80fd5b82359150602083013561162b816114d9565b809150509250929050565b5f805f805f8060a0878903121561164b575f80fd5b8635611656816114d9565b955060208701359450604087013561166d816114d9565b9350606087013561167d816114d9565b9250608087013567ffffffffffffffff811115611698575f80fd5b6116a489828a016114ed565b979a9699509497509295939492505050565b602080825282518282018190525f919060409081850190868401855b8281101561170057815180516001600160a01b031685528601518685015292840192908501906001016116d2565b5091979650505050505050565b83815260406020820152816040820152818360608301375f818301606090810191909152601f909201601f1916010192915050565b5f60208284031215611752575f80fd5b5051919050565b5f60208284031215611769575f80fd5b815161130e816114d9565b634e487b7160e01b5f52603260045260245ffd5b634e487b7160e01b5f52601160045260245ffd5b818103818111156104e4576104e4611788565b634e487b7160e01b5f52603160045260245ffd5b5f600182016117d4576117d4611788565b5060010190565b634e487b7160e01b5f52604160045260245ffdfe18d474424743e603c32d77867f1cfbdce0210ee3f96f6c0e9491b72759f23c33a49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775a2646970667358221220c95f865cabb0bbdc992c3a7c418bbd658e53af5e0c507a40d375dcb3737e850e64736f6c63430008140033

``` solidity

function 0xcfda09ef(address varg0, uint256 varg1, address varg2, address varg3, bytes varg4) public nonPayable { 
    require(msg.data.length - 4 >= 160);
    require(varg4 <= uint64.max);
    require(4 + varg4 + 31 < msg.data.length);
    require(varg4.length <= uint64.max);
    require(4 + varg4 + varg4.length + 32 <= msg.data.length);
    require(_getRoleAdmin[0x8e0bb2066a721fae15f0005dcee9ec6377ae886cb91c267d1440aaec731e4561].field0[msg.sender], AccessControlUnauthorizedAccount(msg.sender, 0x8e0bb2066a721fae15f0005dcee9ec6377ae886cb91c267d1440aaec731e4561));
    require(map_5[varg0], TokenInvalid());
    require(map_4[varg2]);
    v0 = 0x124e(varg1, varg0, this);
    if (!v0) {
        require(varg3, StrategyNotSet());
        v1, /* address */ v2 = varg3.underlyingToken().gas(msg.gas);
        require(bool(v1), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
        require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
        require(v2 == address(v2));
        require(address(v2) == varg0, TokenMismatch());
        require(_redeem[varg3]);
        v3, /* address */ v4 = varg3.underlyingToken().gas(msg.gas);
        require(bool(v3), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
        require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
        require(v4 == address(v4));
        v5 = 0x124e(varg1, v4, varg3);
        if (!v5) {
            v6 = new uint256[](varg4.length);
            CALLDATACOPY(v6.data, varg4.data, varg4.length);
            MEM[96 + (varg4.length + (4 + MEM[64]))] = 0;
            v7, /* uint256 */ v8 = varg3.redeem(varg1, v6).gas(msg.gas);
            require(bool(v7), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
            require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
            v9, /* uint256 */ v10 = varg3.withdraw(address(v4), v8).gas(msg.gas);
            require(bool(v9), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
            require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
        } else {
            v11, /* uint256 */ v10 = varg3.withdraw(address(v4), varg1).gas(msg.gas);
            require(bool(v11), 0, RETURNDATASIZE()); // checks call status, propagates error data on error
            require(MEM[64] + RETURNDATASIZE() - MEM[64] >= 32);
        }
    }
    0x1315(varg2, v10, varg0);
    emit 0x77cfc63959f1ab32cc7fa9c3da6fdf58bf6a9afef6b1534ea9dd04b1cdd6b2ac(varg0, v10, varg2, varg3);
    return v10;
}

```

## main reason/feature:Reentrancy Attack

### [link](https://basescan.org/tx/0x331084925aa1b45ee9087dc4092a4b2fc6bb6c1b155dbe0b405a75541d19ed1a)

The splitLock function in the Locker contract 0x80b9 has a reentrancy vulnerability, allowing the attacker to create a new lock with incorrect amount due to ETH transfer in feeHandler function.

``` solidity
function splitLock(uint256_id, uint256_newAmount, uint256 _newUnlockTime) external payable whenNotPaused returns (uint256 _splitId) f
    Lock storage _lock = locks L_id;
    require(!_lock.withdrawn, "Locker: lock already withdrawn");
    require(_newUnlockTime >= _lock.unlockTime, "Locker: new unlock time must be greater than or equal to the current lock time");
    require(_newAmount > 0 &&
_newAmount < _lock.amount, "Locker: invalid new amount"):
    require(!_isNFT(_lock.token), "Locker: NFTs cannot be split");
    addressi[] memory _whitelist = new address [] (2);
    _whitelist 0 = _lock. token;
    _whitelist [1] = _lock.beneficiary;
    _feeHandler(_whitelist);
    _lock-amount -= _newAmount;
    _splitId = lockId;
    ++lockId;
    locks[_splitId] = Lock({
        token: _lock.token,
        tokenId: 0,
        beneficiary: _lock.beneficiary,
        amount: _newAmount,
        unlockTime:_newUnlockTime,
        withdrawn: false
    });
    emit LockSplit(_id, _splitId);
}

```

## main reason/feature:Logic

### [link](https://etherscan.io/tx/0x444854ee7e7570f146b64aa8a557ede82f326232e793873f0bbd04275fa7e54c)

The withdrawWithoutHedge function in the HegicPool contract fails to verify the tranche state or deduct the withdrawal amount.  It appears that the check code has been commented out somehow.

This vulnerability enables an attacker to repeatedly withdraw WBTC from the contract. To set up this exploit, the attacker deposited funds a month ago in preparation.

``` solidity

function_withdraw(address owner, uint256 trancheID)
    internal
    returns (uint256 amount)
{
    Tranche storage t = tranches [trancheID];
    // uint256 lockupPeriod =
    // t. hedged
    //  ? lockupPeriodForHedgedTranches
    //  : lockupPeriodForUnhedgedTranches;
    // require(t.state == TrancheState.Open) ;
    require(_isApprovedOrOwner (_msgSender(), trancheID));
    require(
        block. timestamp > t. creationTimestamp + lockupPeriod,
        "Pool Error: The withdrawal is locked up"
    );
    
    t.state = TrancheState. Closed;
    // if (t.hedged) {
    //      amount = (t.share * hedgedBalance) / hedgedShare;
    //      hedgedShare - t. share;
    //      hedgedBalance -= amount;
    amount = (t. share * totalBalance) / totalShare;
    totalShare -= t. share;
    totalBalance -= amount;
// }
    token safeTransfer (owner, amount);
}

```

``` solidity

function provideFrom(
    address account,
    uint256 amount,
    bool,
    uint256 minShare
) external override nonReentrant returns (uint256 share) {
    uint256 balance = totalBalance;
    share = totalShare > 0 && balance > 0
        ? (amount * totalShare) / balance
        : amount * INITIAL_RATE;
    uint256 limit = maxDepositAmount - totalBalance;
    require (share >= minShare, "Pool Error: The mint limit is too large");
    require(share > 0, "Pool Error: The amount is too small");
    require(
        amount = limit,
        "Pool Error: Depositing into the pool is not available"
    );
    totalShare += share;
    totalBalance += amount;
    uint256 trancheID = tranches.length;
    tranches.push (
        Tranche(TrancheState.Open, share, amount, block. timestamp)
    );
    _safeMint (account, trancheID) ;
    token. safeTransferFrom(_msgSender(), address(this), amount) ;
}

```

## main reason/feature:Transfer Logic

### [link](https://basescan.org/tx/0x886ad608e18d4ce1a20976fcbf86c07d0c006247d7f65a7c043c9186a3bdc984)

This appears to be a casino game smart contract. In the commitToRace function, the transferToken function fails to correctly deduct the specified amount from msg.sender when the token is ETH (address 0x0), yet it still credits this amount to the user. 

Subsequently, when the cancelCommitment function is called, an attacker can withdraw ETH from the contract.

``` solidity

function transferEth(address from, address to, uint256 amount) internal {
    if (from == msg-sender || from == address (this)) {
        if (to. code. length == 0) {
            payable(to). transfer(amount);
        } else {
            (bool success, /* bytes memory data */) = to.call{ gas: 10000, value: amount }("'');
            if (!success) revert TransferFailed();
        }
    } else if (to == msg-sender || to = address(this)) ‹
        if (msg.value < amount) revert NotEnoughEthValueTransferred (msg. value, amount) ;
    }
function transferToken(address token, address from, address to, uint256 amount) internal {
    if (token == address (0)) {
        return transferEth (from, to, amount) ;
    }

    if (from = address (this)) {
        IERC20 (token). safeTransfer(to, amount);
    } else {
        IERC20(token) (token) safeTransferFrom(from, to, amount);
    }
}

```

## main reason/feature:Address Pollution Phishing attack

### [link](https://x.com/TenArmorAlert/status/1896763430347952626)

## main reason/feature:Slippage Protection

### [link](https://bscscan.com/tx/0xdebaa13fb06134e63879ca6bcb08c5e0290bdbac3acf67914c0b1dcaf0bdc3dd)

The token contracts lack proper checks for the price of the pair and have no slippage protection when adding liquidity to the pair to list tokens on a DEX.

There have already been several similar incidents due to the lack of slippage protection when adding liquidity or swapping.
We strongly recommend that developers pay attention to this issue.

``` solidity

 function buyToken(
        uint256 expectAmount,
        address sellsman,
        uint16 slippage,
        address receiver
    ) public payable nonReentrant returns (uint256) {
        sellsman = _checkBondingCurveState(sellsman);
        if (receiver == address(0)) {
            receiver = tx.origin;
        }
        uint256[2] memory feeRatio = IPump(manager).getFeeRatio();
        uint256 buyFunds = msg.value;
        uint256 tiptagFee = (msg.value * feeRatio[0]) / divisor;
        uint256 sellsmanFee = (msg.value * feeRatio[1]) / divisor;

        uint256 tokenReceived = bondingCurve
            .getBuyAmountByValue(bondingCurveSupply, buyFunds - tiptagFee - sellsmanFee);

        address tiptapFeeAddress = IPump(manager).getFeeReceiver();

        if (tokenReceived + bondingCurveSupply >= bondingCurveTotalAmount) {
            uint256 actualAmount = bondingCurveTotalAmount - bondingCurveSupply;
            // calculate used eth
            uint256 usedEth = bondingCurve.getBuyPriceAfterFee(bondingCurveSupply,actualAmount);
            if (usedEth > msg.value) {
                revert InsufficientFund();
            }
            if (usedEth < msg.value) {
                // refund
                (bool success, ) = msg.sender.call{value: msg.value - usedEth}("");
                if (!success) {
                    revert RefundFail();
                }
            }

            buyFunds = usedEth;
            tiptagFee = (usedEth * feeRatio[0]) / divisor;
            sellsmanFee = (usedEth * feeRatio[1]) / divisor;

            (bool success1, ) = tiptapFeeAddress.call{value: tiptagFee}("");
            if (!success1) {
                revert CostFeeFail();
            }
            IIPShare(IPump(manager).getIPShare()).valueCapture{value: sellsmanFee}(sellsman);
            this.transfer(receiver, actualAmount);
            bondingCurveSupply += actualAmount;

            emit Trade(receiver, sellsman, true, actualAmount, usedEth, tiptagFee, sellsmanFee);
            // build liquidity pool
            _makeLiquidityPool();
            return actualAmount;
        } else {
            if (
                slippage > 0 &&
                (tokenReceived > (expectAmount * (divisor + slippage)) / divisor ||
                    tokenReceived < (expectAmount * (divisor - slippage)) / divisor)
            ) {
                revert OutOfSlippage();
            }

            (bool success, ) = tiptapFeeAddress.call{value: tiptagFee}("");
            if (!success) {
                revert CostFeeFail();
            }

            IIPShare(IPump(manager).getIPShare()).valueCapture{value: sellsmanFee}(sellsman);
            this.transfer(receiver, tokenReceived);
            bondingCurveSupply += tokenReceived;
            emit Trade(receiver, sellsman, true, tokenReceived, msg.value, tiptagFee, sellsmanFee);
            return tokenReceived;
        }
    }
```

``` solidity

function _makeLiquidityPool() private {
    _approve(address(this), IPump(manager).getUniswapV2Router(), liquidityAmount) ;
    
    IUniswapV2Router02 router = IUniswapV2Router02 (IPump (manager).getUniswapV2Router());
    
    router.addLiquidityETH{value: address(this).balance}(
        address (this),
        liquidityAmount,
        0,
        0,
        BlackHole,
        block.timestamp + 300
    );

    listed = true;
    emit TokenListedToDex(pair);
}
```
