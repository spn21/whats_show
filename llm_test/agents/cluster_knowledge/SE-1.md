## [H-18]  "Vault rewards can be gamed"

The _deposit function increases the member's weight by _weight = iUTILS(UTILS()).calcValueInBase(iSYNTH(_synth).TOKEN(), _amount); which is the swap output amount when trading the deposited underlying synth amount.
Notice that anyone can create synths of custom tokens by calling Pools.deploySynth(customToken).
Therefore an attacker can deposit valueless custom tokens and inflate their member weight as follows:

Create a custom token and issue lots of tokens to the attacker
Create synth of this token
Add liquidity for the TOKEN <> BASE pair by providing a single wei of TOKEN and 10^18 BASE tokens. This makes the TOKEN price very expensive.
Mint some synths by paying BASE to the pool
Deposit the fake synth, _weight will be very high because the token pool price is so high.

Call harvest(realSynth) with a synth with actual value. This will increase the synth balance and it can be withdrawn later.
Anyone can inflate their member weight through depositing a custom synth and earn almost all vault rewards by calling harvest(realSynth) with a valuable "real" synth.
The rewards are distributed pro rata to the member weight which is independent of the actual synth deposited.
The calcReward function completely disregards the synth parameter which seems odd.
Recommend thinking about making the rewards based on the actual synths deposited instead of a "global" weight tracker.
Alternatively, whitelist certain synths that count toward the weight, or don't let anyone create synths.
strictly-scarce (vader) confirmed:

This is a valid attack path.
The counter is two fold:
1) In the vault, require(isCurated(token)) this will only allow synths of curated tokens to be deposited for rewards. The curation logic  does a check for liquidity depth, so only deep pools can become synths. Thus an attacker would need to deposit a lot of BASE.
2) In the vaults, use _weight = iUTILS(UTILS()).calcSwapValueInBase(iSYNTH(_synth).TOKEN(), _amount);, which computes the weight with respect to slip, so a small manipulated pool cannot be eligible. The pool would need to be deep.

The Vault converts all synths back to common accounting asset - USDV, so member weight can be tracked.
strictly-scarce (vader) commented:
Disagree with severity, since the daily rewards can be claimed by anyone in a fee-bidding war but no actual extra inflation occurs.
Severity: 2



## [H-04]  "NFTXLPStaking Is Subject To A Flash Loan Attack That Can Steal Nearly All Rewards/Fees That Have Accrued For A Particular Vault"

The LPStaking contract does not require that a stake be locked for any period of time. The LPStaking contract also does not track how long your stake has been locked. So an attacker Alice can stake, claim rewards, and unstake, all in one transaction. If Alice utilizes a flash loan, then she can claim nearly all of the rewards for herself, leaving very little left for the legitimate stakers.
The fact that the NFTXVaultUpgradeable contract contains a native flashLoan function makes this attack that much easier, although it would still be possible even without that due to flashloans on Uniswap, or wherever else the nftX token is found.
Since a flash loan will easily dwarf all of the legitimate stakers' size of stake, the contract will erroneously award nearly all of the rewards to Alice.

Wait until an NFTX vault has accrued any significant amount of fees/rewards
FlashLoanBorrow a lot of ETH using any generic flash loan provider
FlashLoanBorrow a lot of nftx-vault-token using NFTXVaultUpgradeable.flashLoan()
Deposit the ETH and nftx-vault-token's into Uniswap for Uniswap LP tokens by calling Uniswap.addLiquidity()
Stake the Uniswap LP tokens in NFTXLPStaking by calling NFTXLPStaking.deposit()
Claim nearly all of the rewards that have accrued for this vault due to how large the flashLoaned deposit is relative to all of the legitimate stakes by calling NFTXLPStaking.claimRewards()
Remove LP tokens from NFTXLPStaking by calling NFTXLPStaking.exit();
Withdraw ETH and nftx-vault-token's by calling Uniswap.removeLiquidity();
Pay back nftx-vault-token flash loan
Pay back ETH flash loan

See GitHub issue page for an in-depth  example.
Recommend requiring that staked LP tokens be staked for a particular period of time before they can be removed. Although a very short time frame (a few blocks) would avoid flash loan attacks, this attack could still be performed over the course of a few blocks less efficiently. Ideally, you would want the rewards to reflect the product of the amount staked and the duration that they've been staked, as well as having a minimum time staked.
Alternatively, if you really want to allow people to have the ability to remove their stake immediately, then only allow rewards to be claimed for stakes that have been staked for a certain period of time. Users would still be able to remove their LP tokens, but they could no longer siphon off rewards immediately.
0xKiwi (NFTX) disputed:

After looking at the code, this is not possible. The dividend token code takes into consideration the current unclaimed rewards and when a deposit is made that value is deducted.

cemozer (Judge) commented:

@0xKiwi do you mind showing where in code that occurs?

Medium Risk Findings (8)


## [H-01]  "A previously timelocked NFT token becomes permanently stuck in vault if it’s ever moved back into the vault"

Submitted by 0xRajeev, also found by pauliax
Let’s consider a scenario where a particular NFT token was timelocked for a certain duration by the owner using timeLockERC721() with a delegate as the recipient and then transferred out of the vault by the delegate via transferERC721() but without unlocking it explicitly using timeUnlockERC721().
This is possible because transferERC721() does all the timelock checks on expires/block.timestamp and recipient/msg.sender as is done in timeUnlockERC721(). But it misses deleting timelockERC721s[key] for that NFT tokenID (as done in L572 of timeUnlockERC721()).
Because of this missing deletion, if that same NFT is ever put back into the vault later but this time without a timelock, the vault logic still thinks it is a timelocked NFT with the older/stale recipient from earlier because of the missing deletion. So now the owner who makes the transferERC721() call will not match the older/stale recipient address and will fail the check on L510 (unless they control that stale recipient address from the earlier timelock).
The impact is that, without access/control to the earlier timelock recipient, this NFT token is now locked in the vault forever.

Alice time locks a particular NFT token with delegate Eve as recipient using timeLockERC721()
Eve transfers NFT to Bob using transferERC721() but without calling timeUnlockERC721() first
Alice buys the same NFT back from Bob (e.g. because it is now considered rare and more valuable) and again puts it back in her vault but this time without locking/delegating it to any recipient i.e. intending to control it herself.
Because this NFT's timelock data and delegate approval for Eve is never removed after Step 2, the NFT is still treated as timelocked in the vault with previous delegate Eve as the recipient (because of stale data in timelockERC721s and nftApprovals)
Alice now cannot withdraw her own NFT without Eve’s help because the check on L510 will only allow Eve to transfer this NFT out of the vault.
If Eve is no longer trusted/accessible then the NFT is locked in the vault forever.

Recommend adding delete timelockERC721s [timelockERC721Keys[nftContract][i]]; after L510.
xyz-ctrl (Visor) confirmed:
ztcrypto (Visor) patched:

patch link



## [H-03]  "Last person to withdraw his tokens might not be able to do this

Submitted by gpersoon.
Impact
Suppose a Crowdsale is successful and enough commitments are made before the marketInfo.endTime.
Suppose marketStatus.commitmentsTotal  == marketInfo.totalTokens -1      // note this is an edge case, but can be constructed by an attacker
Then the function auctionEnded() returns true
Assume auctionSuccessful() is also true (might depend on the config of marketPrice.goal and marketInfo.totalTokens)
Then an admin can call finalize() to finalize the Crowdsale.
The function finalize distributes the funds and the unsold tokens and sets status.finalized = true so that finalized cannot be called again.
Now we have "marketInfo.totalTokens -1" tokens left in the contract
However commitEth() or commitTokens() can still be called (they give no error message that the auction has ended)
Then functions call calculateCommitment, which luckily prevent from buying too much, however 1 token can still be bought
These functions also call \_addCommitment(), which only checks for marketInfo.endTime, which hasn't passed yet.
Now an extra token is sold and the contract has 1 token short. So the last person to withdraw his tokens cannot withdraw them (because you cannot specify how much you want to withdraw)
Also the revenues for the last token cannot be retrieved as finalize() cannot be called again.
Proof of Concept
https://github.com/sushiswap/miso/blob/master/contracts/Auctions/Crowdsale.sol#L374
```js
 function finalize() public nonReentrant {
        require(hasAdminRole(msg.sender) || wallet == msg.sender || hasSmartContractRole(msg.sender) || finalizeTimeExpired(),"Crowdsale: sender must be an admin"); // can be called by admin
        MarketStatus storage status = marketStatus;
        require(!status.finalized, "Crowdsale: already finalized");
        MarketInfo storage info = marketInfo;
        require(auctionEnded(), "Crowdsale: Has not finished yet");    // is true if enough sold, even if this is before marketInfo.endTime
    if (auctionSuccessful()) {          
        /// @dev Transfer contributed tokens to wallet.
        /// @dev Transfer unsold tokens to wallet.
    } else {
        /// @dev Return auction tokens back to wallet.
    }
    status.finalized = true;

function auctionEnded() public view returns (bool) {
        return block.timestamp > uint256(marketInfo.endTime) || 
        _getTokenAmount(uint256(marketStatus.commitmentsTotal) + 1) >= uint256(marketInfo.totalTokens); // is true if enough sold, even if this is before marketInfo.endTime
    }
function auctionSuccessful() public view returns (bool) {
        return uint256(marketStatus.commitmentsTotal) >= uint256(marketPrice.goal);
}
function commitEth(address payable _beneficiary, bool readAndAgreedToMarketParticipationAgreement ) public payable nonReentrant  {
       ...
        uint256 ethToTransfer = calculateCommitment(msg.value);
       ...
       _addCommitment(_beneficiary, ethToTransfer);
function calculateCommitment(uint256 _commitment) public view returns (uint256 committed) { // this prevents buying too much
        uint256 tokens = _getTokenAmount(_commitment);
        uint256 tokensCommited =_getTokenAmount(uint256(marketStatus.commitmentsTotal));
        if ( tokensCommited.add(tokens) > uint256(marketInfo.totalTokens)) {
            return _getTokenPrice(uint256(marketInfo.totalTokens).sub(tokensCommited));
        }
        return _commitment;
    }
function _addCommitment(address _addr, uint256 _commitment) internal {
        require(block.timestamp >= uint256(marketInfo.startTime) && block.timestamp <= uint256(marketInfo.endTime), "Crowdsale: outside auction hours"); // doesn't check auctionEnded() nor status.finalized
        ...
        uint256 newCommitment = commitments[_addr].add(_commitment);
        ...
        commitments[_addr] = newCommitment;
function withdrawTokens(address payable beneficiary) public   nonReentrant  {  
        if (auctionSuccessful()) {
            ...
            uint256 tokensToClaim = tokensClaimable(beneficiary);
            ...
            claimed[beneficiary] = claimed[beneficiary].add(tokensToClaim);
            _safeTokenPayment(auctionToken, beneficiary, tokensToClaim);    // will fail is last token is missing
        } else {


## [H-03]  "VADER contains a Fee-On-Transfer"

Submitted by jayjonah8, also found by rfa, shri4net, and xYrYuYx
Impact
The whitepaper says that the Vader token contains a Fee-On-Transfer so in XVader.sol, an attacker may be able to keep calling enter() and leave() while being credited more tokens than the contract actually receives eventually draining it.
Proof of Concept

Attacker deposits 500 Vader
Attacker receives credit for 500 while the xVader contract gets the 500 - fee.

Attacker calls leave() leaving the contract with a difference of the fee.


https://www.financegates.net/2021/07/28/another-polygon-yield-farm-crashes-to-zero-after-exploit/


https://github.com/code-423n4/2021-11-vader/blob/main/contracts/x-vader/XVader.sol


https://www.vaderprotocol.io/whitepaper


Tools Used
Manually code review
Recommended Mitigation Steps
There should be pre and post checks on balances to get the real amount
0xstormtrooper (Vader) acknowledged:

Vader fee on transfer will be removed



## [H-30]  "Newly Registered Assets Skew Consultation Results"

Submitted by leastwood
Impact
The TwapOracle.consult() function iterates over all token pairs which belong to either VADER or USDV` and then calculates the price of the respective asset by using both UniswapV2 and Chainlink price data. This helps to further protect against price manipulation attacks as the price is averaged out over the various registered token pairs.
If a new asset is added by first registering the token pair and aggregator, the consultation result for that token pair will remain skewed until the next update interval. This is due to the fact that the native asset amount will return 0 due to the default price1Average value being used. However, the Chainlink oracle will return a valid result. As a result, the query will be skewed in favour of sumUSD resulting in incorrect consultations.
I'd classify this issue as high risk as the oracle returns false results upon being consulted. This can lead to issues in other areas of the protocol that use this data in performing sensitive actions.
Proof of Concept

https://github.com/code-423n4/2021-11-vader/blob/main/contracts/twap/TwapOracle.sol#L115-L157
https://github.com/code-423n4/2021-11-vader/blob/main/contracts/twap/TwapOracle.sol#L314
https://github.com/code-423n4/2021-11-vader/blob/main/contracts/twap/TwapOracle.sol#L322-L369

Tools Used
Manual code review.
Recommended Mitigation Steps
Consider performing proper checks to ensure that if pairData.price1Average._x == 0, then the Chainlink aggregator is not queried and not added to sumUSD. Additionally, it may be useful to fix the current check to assert that the pairData.price1Average.mul(1).decode144() result is not 0, found here. require(sumNative != 0) is used to assert this, however, this should be require(pairData.price1Average.mul(1).decode144() != 0) instead.
SamSteinGG (Vader) confirmed

The TWAP oracle module has been completely removed and redesigned from scratch as LBTwap that is subject of the new audit.



## [H-02]  "Wrong design/implementation of freeTrial allows attacker to steal funds from the protocol"

Submitted by WatchPug
The current design/implementation of freeTrial allows users to get full refund before the freeTrial ends. Plus, a user can transfer partial of their time to another user using shareKey.
This makes it possible for the attacker to steal from the protocol by transferring freeTrial time from multiple addresses to one address and adding up to expirationDuration and call refund to steal from the protocol.
Proof of Concept
Given:

keyPrice is 1 ETH;
expirationDuration is 360 days;
freeTrialLength is 31 days.

The attacker can create two wallet addresses: Alice and Bob.

Alice calls purchase(), transfer 30 days via shareKey() to Bob, then calls cancelAndRefund() to get full refund; Repeat 12 times;
Bob calls cancelAndRefund() and get 1 ETH.

Recommendation
Consider disabling cancelAndRefund() for users who transferred time to another user.
julien51 (Unlock Protocol) confirmed and commented:

I think this is valid! The free trial approach is indeed a risk on that front and we need to "warn" lock managers about this more.
For lock manager who still want to offer free trials, the best approach would probably be to set a high transfer fee to make sure that free trials cannot be transfered.
As a consequence of this, I am not sure this is as critical as indicated by the submitter.

0xleastwood (judge) commented:

Nice find!
From what I can tell at least, this does seem like a viable attack vector. Can I ask why this should not be treated as high risk? @julien51 

julien51 (Unlock Protocol) commented:

Sorry for the long delay here.
In short: this is valid, but only an issue for locks which are enabling free trials (no one has done it) and we would make sure our UI shows this as a potential issue.
In other words: a lock manager would need to explicitly enable free trials, despite our warning to put their own funds at risk. For that reason I don't think this is "High".

0xleastwood (judge) commented:

While this is a valid issue pertaining only to lock managers who explicitly enable free trials, this may still lead to a loss of funds if cancelAndRefund is called by a user who has transferred their time to another account. I still believe this deserves a high severity rating.
In my honest opinion, a warning isn't sufficient to prevent such abuse. I think on-chain enforcement ideal in this situation.



## [H-08]  "Possibility to drain SavingsAccount contract assets"

Submitted by kemmio
Impact
A malicious actor can manipulate switchStrategy() function in a way to withdraw tokens that are locked in SavingsAccount contract
(the risk severity should be reviewed)
Proof of Concept
Firstly an attacker need to deploy a rogue strategy contract implementing IYield.getSharesForTokens() and IYield.unlockTokens() functions
and calling switchStrategy() with _currentStrategy = ROGUE_CONTRACT_ADDRESS (_newStrategy can be any valid strategy e.g. NoYield)
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L160
solidity
require(_amount != 0, 'SavingsAccount::switchStrategy Amount must be greater than zero');
Bypass this check by setting _amount > 0, since it will be overwritten in line
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L162
solidity
_amount = IYield(_currentStrategy).getSharesForTokens(_amount, _token);
getSharesForTokens() should be implemented to always return 0, hence to bypass the overflow in lines
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L164-L167
solidity
balanceInShares[msg.sender][_token][_currentStrategy] = balanceInShares[msg.sender][_token][_currentStrategy].sub(
_amount,
'SavingsAccount::switchStrategy Insufficient balance'
);
since balanceInShares[msg.sender][_token][_currentStrategy] == 0 and 0-0 will not overflow
The actual amount to be locked is saved in line
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L169
solidity
uint256 _tokensReceived = IYield(_currentStrategy).unlockTokens(_token, _amount);
the rouge unlockTokens() can check asset balance of the contract and return the full amount
After that some adjustment are made to set approval for the token or to handle native assets case
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L171-L177
solidity
uint256 _ethValue;
if (_token != address(0)) {
    IERC20(_token).safeApprove(_newStrategy, _tokensReceived);
} else {
    _ethValue = _tokensReceived;
}
_amount = _tokensReceived;
Finally the assets are locked in the locked strategy and shares are allocated on attackers acount
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L179-L181
```solidity
uint256 _sharesReceived = IYield(_newStrategy).lockTokens{value: _ethValue}(address(this), _token, _tokensReceived);
balanceInShares[msg.sender][_token][_newStrategy] = balanceInShares[msg.sender][_token][_newStrategy].add(_sharesReceived);
```
Proof of Concept
```solidity
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
contract Attacker{
    function getSharesForTokens(uint256 amount, address token) external payable  returns(uint256){
        return 0;
    }
    function unlockTokens(address token, uint256 amount) external payable returns(uint256){
        uint256 bal;
        if(token == address(0))
            bal = msg.sender.balance;
        else
            bal = IERC20(token).balanceOf(msg.sender);
        return bal;
    }
}
```
Recommended Mitigation Steps
Add a check for _currentStrategy to be from strategy list like the one in line
https://github.com/code-423n4/2021-12-sublime/blob/main/contracts/SavingsAccount/SavingsAccount.sol#L159
require(IStrategyRegistry(strategyRegistry).registry(_newStrategy), 'SavingsAccount::_newStrategy do not exist');

ritik99 (Sublime) disputed:

The savings account contract doesn't hold any tokens, so it is not possible to lock tokens in a new strategy, hence this attack will not work. Nevertheless it is something we will explore further to limit unexpected state changes

0xean (judge) commented:

Based on the review of the warden I believe this is a valid attack path.  This line would need to change to the amount of tokens that are to be "stolen" but otherwise this does seem accurate. 
solidity
bal = IERC20(token).balanceOf(msg.sender);



## [H-02]  "Transferring quoteToken to the exchange pool contract will cause future liquidity providers to lose funds"

Submitted by WatchPug
In the current implementation, the amount of LP tokens to be minted when addLiquidity() is calculated based on the ratio between the amount of newly added quoteToken and the current wallet balance of quoteToken in the Exchange contract.
However, since anyone can transfer quoteToken to the contract, and make the balance of quoteToken to be larger than _internalBalances.quoteTokenReserveQty, existing liquidity providers can take advantage of this by donating quoteToken and make future liquidity providers receive fewer LP tokens than expected and lose funds.
https://github.com/code-423n4/2022-01-elasticswap/blob/d107a198c0d10fbe254d69ffe5be3e40894ff078/elasticswap/src/libraries/MathLib.sol#L578-L582
solidity
liquidityTokenQty = calculateLiquidityTokenQtyForDoubleAssetEntry(
    _totalSupplyOfLiquidityTokens,
    quoteTokenQty,
    _quoteTokenReserveQty // IERC20(quoteToken).balanceOf(address(this))
);
PoC
Given:


The Exchange pool is new;


Alice addLiquidity() with 1e18 baseToken and 1e18 quoteToken, recived 1e18 LP token;

Alice transfer 99e18 quoteToken to the Exchange pool contract;
Bob addLiquidity() with 1e18 baseToken and 1e18 quoteToken;
Bob removeLiquidity() with all the LP token in balance.

Expected Results: Bob recived 1e18 baseToken and >= 1e18 quoteToken.
Actual Results: Bob recived \~0.02e18 baseToken and \~1e18 quoteToken.
Alice can now removeLiquidity() and recive \~1.98e18 baseToken and \~100e18 quoteToken.
As a result, Bob suffers a fund loss of 0.98e18 baseToken.
Recommendation
Change to:
solidity
liquidityTokenQty = calculateLiquidityTokenQtyForDoubleAssetEntry(
    _totalSupplyOfLiquidityTokens,
    quoteTokenQty,
    _internalBalances.quoteTokenReserveQty
);
0xean (ElasticSwap) confirmed and commented:

This does appear to be correct after attempting a POC. Thank you WatchPug! 

Alex the Entreprenerd (judge) commented:

The warden identified a way to exploit the protocol math to devalue future liquidity provision at the advantage of early liquidity providers.
The exploit is extractive in nature, however, because this is reliably performable and effectively breaks the protocol's goals and mechanics, I believe High Severity to be appropriate.

0xean (ElasticSwap) resolved

Medium Risk Findings (1)


## [H-01]  "Malicious Users Can Duplicate Protocol Earned Yield By Transferring wCVX Tokens To Another Account"

Submitted by leastwood, also found by kenzo
ConvexYieldWrapper.sol is a wrapper contract for staking convex tokens on the user's behalf, allowing them to earn rewards on their deposit. Users will interact with the Ladle.sol contract's batch() function which:

Approves Ladle to move the tokens.
Transfers the tokens to ConvexYieldWrapper.sol.
Wraps/stakes these tokens.
Updates accounting and produces debt tokens within Ladle.sol.

During wrap() and unwrap() actions, _checkpoint() is used to update the rewards for the from_ and to_ accounts. However, the reference contract implements a _beforeTokenTransfer() function which has been removed from Yield Protocol's custom implementation.
As a result, it is possible to transfer wCVX tokens to another account after an initial checkpoint has been made. By manually calling user_checkpoint() on the new account, this user is able to update its deposited balance of the new account while the sender's balance is not updated. This can be repeated to effectively replicate a user's deposited balance over any number of accounts. To claim yield generated by the protocol, the user must only make sure that the account calling getReward() holds the tokens for the duration of the call.
Proof of Concept
The exploit can be outlined through the following steps:

Alice receives 100 wCVX tokens from the protocol after wrapping their convex tokens.
At that point in time, _getDepositedBalance() returns 100 as its result. A checkpoint has also been made on this balance, giving Alice claim to her fair share of the rewards.
Alice transfers her tokens to her friend Bob who then manually calls user_checkpoint() to update his balance.
Now from the perspective of the protocol, both Alice and Bob have 100 wCVX tokens as calculated by the _getDepositedBalance() function.
If either Alice or Bob wants to claim rewards, all they need to do is make sure the 100 wCVX tokens are in their account upon calling getReward(). Afterwards, the tokens can be transferred out.

Tools Used
Manual code review.
Discussion/confirmation with the Yield Protocol team.
Recommended Mitigation Steps
Consider implementing the _beforeTokenTransfer() function as shown in the reference contract. However, it is important to ensure the wrapper contract and collateral vaults are excluded from the checkpointing so they are not considered in the rewards calculations.
alcueca (Yield) confirmed and commented:

Confirmed. The fact that rewards can be drained also means that users lose on their expected rewards, so I think that Sev 3 is right.

iamsahu (Yield) resolved
Alex the Entreprenerd (judge) commented:

In systems that track growing rewards, anytime a user balances changes, it's important to recalculate their balances as to properly distribute pending rewards and to influence the future-rate at which rewards will be distributed (process generally called accruing)
In the case of the ConvexYieldWrapper, the warden has shown that because the wCVX token doesn't perform a _checkpoint on each transfer, a malicious attacker could repeatedly transfer their tokens in order to reuse the same balance in multiple accounts, effectively sybil attacking the protocol.
The fix seems to be straightforward, however the impact of the finding breaks the accounting of the protocol, as such I believe High Severity to be appropraite

Alex the Entreprenerd (judge) commented:

The sponsor has mitigated in a subsequent PR by overriding the _transfer function




## [H-02]  "Malicious Users Can Transfer Vault Collateral To Other Accounts To Extract Additional Yield From The Protocol"

Submitted by leastwood
ConvexYieldWrapper.sol is a wrapper contract for staking convex tokens on the user's behalf, allowing them to earn rewards on their deposit. Users will interact with the Ladle.sol contract's batch() function which:

Approves Ladle to move the tokens.
Transfers the tokens to ConvexYieldWrapper.sol.
Wraps/stakes these tokens.
Updates accounting and produces debt tokens within Ladle.sol.

_getDepositedBalance() takes into consideration the user's total collateral stored in all of their owned vaults. However, as a vault owner, you are allowed to give the vault to another user, move collateral between vaults and add/remove collateral. Therefore, it is possible to manipulate the result of this function by checkpointing one user's balance at a given time, transferring ownership to another user and then create a new checkpoint with this user.
As a result, a user is able to generate protocol yield multiple times over on a single collateral amount. This can be abused to effectively extract all protocol yield.
Proof of Concept
Consider the following exploit scenario:

Alice owns a vault which has 100 tokens worth of collateral.
At that point in time, _getDepositedBalance() returns 100 as its result. A checkpoint has also been made on this balance, giving Alice claim to her fair share of the rewards.
Alice then calls Ladle.give(), transferring the ownership of the vault to Bob and calls ConvexYieldWrapper.addVault().
Bob is able to call user_checkpoint() and effectively update their checkpointed balance.
At this point in time, both Alice and Bob have claim to any yield generated by the protocol, however, there is only one vault instance that holds the underlying collateral.

https://github.com/code-423n4/2022-01-yield/blob/main/contracts/ConvexYieldWrapper.sol#L100-L120
```solidity
function getDepositedBalance(address account) internal view override returns (uint256) {
    if (account_ == address(0) || account_ == collateralVault) {
        return 0;
    }
bytes12[] memory userVault = vaults[account_];

//add up all balances of all vaults registered in the wrapper and owned by the account
uint256 collateral;
DataTypes.Balances memory balance;
uint256 userVaultLength = userVault.length;
for (uint256 i = 0; i < userVaultLength; i++) {
    if (cauldron.vaults(userVault[i]).owner == account_) {
        balance = cauldron.balances(userVault[i]);
        collateral = collateral + balance.ink;
    }
}

//add to balance of this token
return _balanceOf[account_] + collateral;

}
```
Tools Used
Manual code review.
Discussion/confirmation with the Yield Protocol team.
Recommended Mitigation Steps
Ensure that any change to a vault will correctly checkpoint the previous and new vault owner. The affected actions include but are not limited to; transferring ownership of a vault to a new account, transferring collateral to another vault and adding/removing collateral to/from a vault.
iamsahu (Yield) confirmed
Alex the Entreprenerd (judge) commented:

The warden identified a way to sidestep the accounting in the ConvexYieldWrapper.
Because ConvexYieldWrapper takes lazy accounting, transferring vaults at the Ladle level allows to effectively register the same vault under multiple accounts, which ultimately allow to steal more yield than expected.
While the loss of yield can be classified as a medium severity, the fact that the warden was able to break the accounting invariants of the ConvexYieldWrapper leads me to raise the severity to high
Ultimately mitigation will require to _checkpoint also when vault operations happen (especially transfer), this may require a rethinking at the Ladle level as the reason why the warden was able to sidestep the checkpoint is because the Ladle doesn't notify the Wrapper of any vault transfers

alcueca (Yield) commented:

Yes, that's right. To fix this issue we will deploy a separate Ladle to deal specifically with convex tokens. The fix will probably involve removing stir and give instead of notifying the wrapper, but we'll see.


Medium Risk Findings (2)


## [H-02]  "Cooldown and redeem windows can be rendered useless"

Submitted by ShippooorDAO
Cooldown and redeem windows can be rendered useless.
Proof of Concept

Given an account that has not staked sNOTE.
Account calls sNOTE.startCooldown
Account waits for the duration of the cooldown period. Redeem period starts.
Account can then deposit and redeem as they wish, making the cooldown useless.
Multiple accounts could be used to "hop" between redeem windows by transfering between them, making the redeem window effictively useless.

Could be used for voting power attacks using flash loan if voting process is not monitored
https://www.coindesk.com/tech/2020/10/29/flash-loans-have-made-their-way-to-manipulating-protocol-elections/
Tools Used

VS Code

Recommended Mitigation Steps
A few ways to mitigate this problem:
Option A: Remove the cooldown/redeem period as it's not really preventing much in current state.
Option B: Let the contract start the cooldown on mint, and bind the cooldown/redeem window to the amount that was minted at that time by the account. Don't make sNOTE.startCooldown() available externally. Redeem should verify amount of token available using this new logic.
jeffywu (Notional) confirmed and commented:

Propose to increase the severity of this [from Low] to High.
This image is a better way to understand the potential attack.



pauliax (judge) increased severity to high and commented:

Great find. Agree with the sponsor, the severity can be upgraded because it destroys the cooldown/redeem protection.
Could this be mitigated by including an amount (up to the whole user's balance) when starting a cooldown, and then redeem can't withdraw more than specified during the cooldown init?

jeffywu (Notional) commented:

We've prevented this by refactoring how the redemption window is defined.




## [H-02]  "Creators can steal sale revenue from owners’ sales"

Submitted by IllIllI
NFTMarketCreators.sol#L158-L160
NFTMarketCreators.sol#L196-L198
NFTMarketCreators.sol#L97-L99
According to the README.md:

All sales in the Foundation market will pay the creator 10% royalties on secondary sales. This is not specific to NFTs minted on Foundation, it should work for any NFT. If royalty information was not defined when the NFT was originally deployed, it may be added using the Royalty Registry which will be respected by our market contract.

Using the Royalty Registry an owner can decide to change the royalty information right before the sale is complete, affecting who gets what.
Impact
By updating the registry to include the seller as one of the royalty recipients, the creator can steal the sale price minus fees. This is because if code finds that the seller is a royalty recipient the royalties are all passed to the creator regardless of whether the owner is the seller or not.
Proof of Concept
solidity
          // 4th priority: getRoyalties override
          if (recipients.length == 0 && nftContract.supportsERC165Interface(type(IGetRoyalties).interfaceId)) {
            try IGetRoyalties(nftContract).getRoyalties{ gas: READ_ONLY_GAS_LIMIT }(tokenId) returns (
              address payable[] memory _recipients,
              uint256[] memory recipientBasisPoints
            ) {
              if (_recipients.length > 0 && _recipients.length == recipientBasisPoints.length) {
                bool hasRecipient;
                for (uint256 i = 0; i < _recipients.length; ++i) {
                  if (_recipients[i] != address(0)) {
                    hasRecipient = true;
                    if (_recipients[i] == seller) {
                      return (_recipients, recipientBasisPoints, true);
https://github.com/code-423n4/2022-02-concur/blob/72b5216bfeaa7c52983060ebfc56e72e0aa8e3b0/contracts/MasterChef.sol#L127-L154
When true is returned as the final return value above, the following code leaves ownerRev as zero because isCreator is true.
```solidity
      uint256 ownerRev
    )
  {
    bool isCreator;
    (creatorRecipients, creatorShares, isCreator) = _getCreatorPaymentInfo(nftContract, tokenId, seller);
// Calculate the Foundation fee
uint256 fee;
if (isCreator && !_nftContractToTokenIdToFirstSaleCompleted[nftContract][tokenId]) {
  fee = PRIMARY_FOUNDATION_FEE_BASIS_POINTS;
} else {
  fee = SECONDARY_FOUNDATION_FEE_BASIS_POINTS;
}

foundationFee = (price * fee) / BASIS_POINTS;

if (creatorRecipients.length > 0) {
  if (isCreator) {
    // When sold by the creator, all revenue is split if applicable.
    creatorRev = price - foundationFee;
  } else {
    // Rounding favors the owner first, then creator, and foundation last.
    creatorRev = (price * CREATOR_ROYALTY_BASIS_POINTS) / BASIS_POINTS;
    ownerRevTo = seller;
    ownerRev = price - foundationFee - creatorRev;
  }
} else {
  // No royalty recipients found.
  ownerRevTo = seller;
  ownerRev = price - foundationFee;
}

}
```
In addition, if the index of the seller in _recipients is greater than MAX_ROYALTY_RECIPIENTS_INDEX, then the seller is omitted from the calculation and gets zero (_sendValueWithFallbackWithdraw() doesn't complain when it sends zero).
solidity
        uint256 maxCreatorIndex = creatorRecipients.length - 1;
        if (maxCreatorIndex > MAX_ROYALTY_RECIPIENTS_INDEX) {
          maxCreatorIndex = MAX_ROYALTY_RECIPIENTS_INDEX;
        }
https://github.com/code-423n4/2022-02-foundation/blob/4d8c8931baffae31c7506872bf1100e1598f2754/contracts/mixins/NFTMarketFees.sol#L76-L79
This issue does a lot of damage because the creator can choose whether and when to apply it on a sale-by-sale basis. Two other similar, but separate, exploits are available for the other blocks in _getCreatorPaymentInfo() that return arrays but they either require a malicious NFT implementation or can only specify a static seller for which this will affect things. In all cases, not only may the seller get zero dollars for the sale, but they'll potentially owe a lot of taxes based on the 'sale' price. The attacker may or may not be the creator - creators can be bribed with kickbacks.
Recommended Mitigation Steps
Always calculate owner/seller revenue separately from royalty revenue.
NickCuso (Foundation) confirmed and commented:

This is a great discovery and a creative way for creators to abuse the system, stealing funds from a secondary sale. Thank you for reporting this.
It's a difficult one for us to address. We want to ensure that NFTs minted on our platform as a split continue to split revenue from the initial sale. We were using isCreator from _getCreatorPaymentInfo as our way of determining if all the revenue from a sale should go to the royalty recipients, which is a split contract for the use case we are concerned about here.
The royalty override makes it easy for a creator to choose to abuse this feature at any time. So that was our primary focus for this fix.
This is the change we have made in _getFees:
```solidity
    bool isCreator = false;
    // lookup for tokenCreator
    try ITokenCreator(nftContract).tokenCreator{ gas: READ_ONLY_GAS_LIMIT }(tokenId) returns (
      address payable _creator
    ) {
      isCreator = _creator == seller;
    } catch // solhint-disable-next-line no-empty-blocks
    {
      // Fall through
    }
(creatorRecipients, creatorShares) = _getCreatorPaymentInfo(nftContract, tokenId);

```
Since the royalty override is only considered in _getCreatorPaymentInfo we are no longer vulnerable to someone adding logic after the NFT has been released to try and rug pull the current owner(s).
It is still possible for someone to try and abuse this logic, but to do so they must have built into the NFT contract itself a way to lie about who the tokenCreator is before the time of a sale. If we were to detect this happening, we would moderate that collection from the Foundation website. Additionally we will think about a longer term solution here so that this type of attack is strictly not possible with our market contract.




## [H-03]  "Withdrawal delay can be circumvented"

Submitted by cmichel, also found by IllIllI and leastwood
Collateral.sol#L97
After initiating a withdrawal with initiateWithdrawal, it's still possible to transfer the collateral tokens.
This can be used to create a second account, transfer the accounts to them and initiate withdrawals at a different time frame such that one of the accounts is always in a valid withdrawal window, no matter what time it is.
If the token owner now wants to withdraw they just transfer the funds to the account that is currently in a valid withdrawal window.
Also, note that each account can withdraw the specified amount. Creating several accounts and circling & initiating withdrawals with all of them allows withdrawing larger amounts even at the same block as they are purchased in the future.
I consider this high severity because it breaks core functionality of the Collateral token.
Proof of Concept
For example, assume the _delayedWithdrawalExpiry = 20 blocks. Account A owns 1000 collateral tokens, they create a second account B.

At block=0, A calls initiateWithdrawal(1000). They send their balance to account B.
At block=10, B calls initiateWithdrawal(1000). They send their balance to account A.
They repeat these steps, alternating the withdrawal initiation every 10 blocks.
One of the accounts is always in a valid withdrawal window (initiationBlock < block && block <= initiationBlock + 20). They can withdraw their funds at any time.

Recommended Mitigation Steps
If there's a withdrawal request for the token owner (_accountToWithdrawalRequest[owner].blockNumber > 0), disable their transfers for the time.
solidity
// pseudo-code not tested
beforeTransfer(from, to, amount) {
  super();
  uint256 withdrawalStart =  _accountToWithdrawalRequest[from].blockNumber;
  if(withdrawalStart > 0 && withdrawalStart + _delayedWithdrawalExpiry < block.number) {
    revert(); // still in withdrawal window
  }
}
ramenforbreakfast (prePO) commented:

This is a valid claim.

gzeon (judge) commented:

Agree with sponsor.


Medium Risk Findings (5)


## [H-02]  "System could be wrapped and made useless without contract whitelisting"

Submitted by Picodes
HolyPaladinToken.sol#L253
HolyPaladinToken.sol#L284
HolyPaladinToken.sol#L268
Anyone could create a contract or a contract factory "PAL Locker" with a fonction to deposit PAL tokens through a contract, lock them and delegate the voting power to the contract owner. Then, the ownership of this contract could be sold. By doing so, locked hPAL would be made liquid and transferrable again. This would eventually break the overall system of hPAL, where the idea is that you have to lock them to make them non liquid to get a boosted voting power and reward rate.
Paladin should expect this behavior to happen as we've seen it happening with veToken models and model implying locking features (see https://lockers.stakedao.org/ and https://www.convexfinance.com/).
This behavior could eventually be beneficial to the original DAO (ex. https://www.convexfinance.com/ for Curve and Frax), but the original DAO needs to at least be able to blacklist / whitelist such contracts and actors to ensure their interests are aligned with the protocol.
Proof of Concept
To make locked hPAL liquid, Alice could create a contact C. Then, she can deposit hPAL through the contract, lock them and delegate voting power to herself. She can then sell or tokenize the ownership of the contract C.
Recommended Mitigation Steps
Depending on if Paladin wants to be optimistic or pessimistic, implement a whitelisting / blacklisting system for contracts.
See:
Curve-Dao-Contracts/VotingEscrow.vy#L185
FraxFinance/veFXS_Solidity.sol.old#L370
Kogaroshi (Paladin) confirmed, resolved, and commented:

Changes were made to use a Whitelist similar to the veCRV & veANGLE (changes in this PR: PaladinFinance/Paladin-Tokenomics#12).
The checker will only block for Locking, allowing smart contracts to stake and use the basic version of hPAL without locking.


Medium Risk Findings (15)


